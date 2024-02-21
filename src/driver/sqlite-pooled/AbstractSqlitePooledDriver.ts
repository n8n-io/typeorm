import { DataSource } from "../../data-source/DataSource"
import { QueryRunner } from "../../query-runner/QueryRunner"
import { ReplicationMode } from "../types/ReplicationMode"
import { Pool } from "tarn"
import { AbstractSqlitePooledConnectionOptions } from "./AbstractSqlitePooledConnectionOptions"
import { AbstractSqliteDriver } from "../sqlite-abstract/AbstractSqliteDriver"

export abstract class AbstractSqlitePooledDriver<
    TSQLiteLib,
    TDbImpl extends object,
> extends AbstractSqliteDriver {
    // -------------------------------------------------------------------------
    // Public Properties
    // -------------------------------------------------------------------------

    queryRunner?: never
    databaseConnection: never

    /**
     * SQLite underlying library.
     */
    sqlite: TSQLiteLib

    /**
     * Pool for the database.
     */
    pool: Pool<TDbImpl>

    // -------------------------------------------------------------------------
    // Public Implemented Properties
    // -------------------------------------------------------------------------

    /**
     * Connection options.
     */
    options: AbstractSqlitePooledConnectionOptions

    /**
     * Represent transaction support by this driver
     */
    transactionSupport: "simple" | "none" = "simple"

    /**
     * We store all created query runners because we need to release them.
     */
    connectedQueryRunners: QueryRunner[] = []

    // -------------------------------------------------------------------------
    // Protected Properties
    // -------------------------------------------------------------------------

    /**
     * Connetions that are marked as invalid and are destroyed
     */
    protected readonly invalidConnections = new WeakSet<TDbImpl>()

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(connection: DataSource) {
        super(connection)

        this.options =
            connection.options as AbstractSqlitePooledConnectionOptions
    }

    // -------------------------------------------------------------------------
    // Public Abstract
    // -------------------------------------------------------------------------

    /**
     * Creates a query runner used to execute database queries.
     */
    abstract createQueryRunner(mode: ReplicationMode): QueryRunner

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Performs connection to the database.
     */
    async connect(): Promise<void> {
        this.pool = await this.createPool()
    }

    /**
     * Closes connection with database.
     */
    async disconnect(): Promise<void> {
        await this.closePool()
    }

    async obtainDatabaseConnection(): Promise<TDbImpl> {
        const dbConnection = await this.pool.acquire().promise

        return dbConnection
    }

    releaseDatabaseConnection(dbConnection: TDbImpl) {
        this.pool.release(dbConnection)
    }

    /**
     * Marks the connection as invalid, so it's not usable anymore and is
     * eventually destroyed
     */
    invalidateDatabaseConnection(dbConnection: TDbImpl) {
        this.invalidConnections.add(dbConnection)
    }

    /**
     * Returns true if driver supports RETURNING / OUTPUT statement.
     */
    isReturningSqlSupported(): boolean {
        return false
    }

    //#region Pool

    /**
     * Creates connection with the database.
     */
    protected abstract createDatabaseConnection(): Promise<TDbImpl>

    protected abstract destroyDatabaseConnection(
        dbConnection: TDbImpl,
    ): Promise<void>

    protected validateDatabaseConnection(dbConnection: TDbImpl) {
        return !this.invalidConnections.has(dbConnection)
    }

    private async createPool(): Promise<Pool<TDbImpl>> {
        const pool = new Pool<TDbImpl>({
            create: async () => {
                return await this.createDatabaseConnection()
            },
            validate: (dbConnection) => {
                return this.validateDatabaseConnection(dbConnection)
            },
            destroy: async (dbConnection) => {
                this.invalidConnections.delete(dbConnection)

                return await this.destroyDatabaseConnection(dbConnection)
            },
            min: this.options.minPoolSize ?? 1,
            max: this.options.maxPoolSize ?? 4,
        })

        return pool
    }

    private async closePool(): Promise<void> {
        while (this.connectedQueryRunners.length) {
            await this.connectedQueryRunners[0].release()
        }

        await this.pool.destroy()
    }

    //#endregion Pool
}
