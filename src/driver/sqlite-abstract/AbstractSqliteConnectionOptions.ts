import { BaseDataSourceOptions } from "../../data-source/BaseDataSourceOptions"

export interface AbstractSqliteConnectionOptions extends BaseDataSourceOptions {
    /**
     * Database type.
     */
    readonly type: "sqlite" | "better-sqlite3" | "libsql"

    /**
     * Storage type or path to the storage.
     */
    readonly database: string

    /**
     * The driver object
     * This defaults to require("sqlite3")
     */
    readonly driver?: any

    /**
     * Encryption key for for SQLCipher.
     */
    readonly key?: string

    /**
     * Enables WAL mode. By default its disabled.
     *
     * @see https://www.sqlite.org/wal.html
     */
    readonly enableWAL?: boolean

    /**
     * Maximum number of clients in the pool. When left undefined (=default),
     * the driver will NOT use a pool but instead just create a single
     * connection and single query runner that will be shared across all
     * usages (i.e. no blocking).
     */
    readonly poolSize?: number
}
