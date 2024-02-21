import type { sqlite3, Database as Sqlite3Database } from "sqlite3"
import { DataSource } from "../../data-source/DataSource"
import { QueryRunner } from "../../query-runner/QueryRunner"
import { PlatformTools } from "../../platform/PlatformTools"
import { DriverPackageNotInstalledError } from "../../error/DriverPackageNotInstalledError"
import { SqlitePooledQueryRunner } from "./SqlitePooledQueryRunner"
import { mkdirp } from "mkdirp"
import path, { isAbsolute } from "path"
import { AbstractSqlitePooledDriver } from "./AbstractSqlitePooledDriver"
import { ColumnType } from "../types/ColumnTypes"
import { filepathToName } from "../../util/PathUtils"
import { SqlitePooledConnectionOptions } from "./SqlitePooledConnectionOptions"

/**
 * Database driver for sqlite that uses sqlite3 npm package and
 * pooled database connections.
 */
export class SqlitePooledDriver extends AbstractSqlitePooledDriver<
    sqlite3,
    Sqlite3Database
> {
    // -------------------------------------------------------------------------
    // Public Properties
    // -------------------------------------------------------------------------

    /**
     * Connection options.
     */
    options: SqlitePooledConnectionOptions

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(connection: DataSource) {
        super(connection)

        // load sqlite package
        this.loadDependencies()
    }

    /**
     * Creates a query runner used to execute database queries.
     */
    createQueryRunner(): QueryRunner {
        return new SqlitePooledQueryRunner(this)
    }

    normalizeType(column: {
        type?: ColumnType
        length?: number | string
        precision?: number | null
        scale?: number
    }): string {
        if ((column.type as any) === Buffer) {
            return "blob"
        }

        return super.normalizeType(column)
    }

    async afterConnect(): Promise<void> {
        return this.attachDatabases()
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    protected async createDatabaseConnection(): Promise<Sqlite3Database> {
        if (
            this.options.flags === undefined ||
            !(this.options.flags & this.sqlite.OPEN_URI)
        ) {
            await this.createDatabaseDirectory(this.options.database)
        }

        const databaseConnection: Sqlite3Database = await new Promise(
            (ok, fail) => {
                if (this.options.flags === undefined) {
                    const connection = new this.sqlite.Database(
                        this.options.database,
                        (err: any) => {
                            if (err) return fail(err)
                            ok(connection)
                        },
                    )
                } else {
                    const connection = new this.sqlite.Database(
                        this.options.database,
                        this.options.flags,
                        (err: any) => {
                            if (err) return fail(err)
                            ok(connection)
                        },
                    )
                }
            },
        )

        // Internal function to run a command on the connection and fail if an error occured.
        function run(line: string): Promise<void> {
            return new Promise((ok, fail) => {
                databaseConnection.run(line, (err: any) => {
                    if (err) return fail(err)
                    ok()
                })
            })
        }
        // in the options, if encryption key for SQLCipher is setted.
        // Must invoke key pragma before trying to do any other interaction with the database.
        if (this.options.key) {
            await run(`PRAGMA key = ${JSON.stringify(this.options.key)}`)
        }

        if (this.options.enableWAL) {
            await run(`PRAGMA journal_mode = WAL`)
        }

        if (
            this.options.busyTimeout &&
            typeof this.options.busyTimeout === "number" &&
            this.options.busyTimeout > 0
        ) {
            await run(`PRAGMA busy_timeout = ${this.options.busyTimeout}`)
        }

        // we need to enable foreign keys in sqlite to make sure all foreign key related features
        // working properly. this also makes onDelete to work with sqlite.
        await run(`PRAGMA foreign_keys = ON`)

        return databaseConnection
    }

    protected destroyDatabaseConnection(
        dbConnection: Sqlite3Database,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            dbConnection.close((err: any) => (err ? reject(err) : resolve()))
        })
    }

    /**
     * If driver dependency is not given explicitly, then try to load it via "require".
     */
    protected loadDependencies(): void {
        try {
            const sqlite = this.options.driver || PlatformTools.load("sqlite3")
            this.sqlite = sqlite.verbose()
        } catch (e) {
            throw new DriverPackageNotInstalledError("SQLite", "sqlite3")
        }
    }

    /**
     * Auto creates database directory if it does not exist.
     */
    protected async createDatabaseDirectory(fullPath: string): Promise<void> {
        await mkdirp(path.dirname(fullPath))
    }

    /**
     * For SQLite, the database may be added in the decorator metadata. It will be a filepath to a database file.
     */
    buildTableName(
        tableName: string,
        _schema?: string,
        database?: string,
    ): string {
        if (!database) return tableName
        if (this.getAttachedDatabaseHandleByRelativePath(database))
            return `${this.getAttachedDatabaseHandleByRelativePath(
                database,
            )}.${tableName}`

        if (database === this.options.database) return tableName

        // we use the decorated name as supplied when deriving attach handle (ideally without non-portable absolute path)
        const identifierHash = filepathToName(database)
        // decorated name will be assumed relative to main database file when non absolute. Paths supplied as absolute won't be portable
        const absFilepath = isAbsolute(database)
            ? database
            : path.join(this.getMainDatabasePath(), database)

        this.attachedDatabases[database] = {
            attachFilepathAbsolute: absFilepath,
            attachFilepathRelative: database,
            attachHandle: identifierHash,
        }

        return `${identifierHash}.${tableName}`
    }

    /**
     * Performs the attaching of the database files. The attachedDatabase should have been populated during calls to #buildTableName
     * during EntityMetadata production (see EntityMetadata#buildTablePath)
     *
     * https://sqlite.org/lang_attach.html
     */
    protected async attachDatabases() {
        // @todo - possibly check number of databases (but unqueriable at runtime sadly) - https://www.sqlite.org/limits.html#max_attached
        for await (const {
            attachHandle,
            attachFilepathAbsolute,
        } of Object.values(this.attachedDatabases)) {
            await this.createDatabaseDirectory(attachFilepathAbsolute)
            await this.connection.query(
                `ATTACH "${attachFilepathAbsolute}" AS "${attachHandle}"`,
            )
        }
    }

    protected getMainDatabasePath(): string {
        const optionsDb = this.options.database
        return path.dirname(
            isAbsolute(optionsDb)
                ? optionsDb
                : path.join(process.cwd(), optionsDb),
        )
    }
}
