import { AbstractSqliteConnectionOptions } from "../sqlite-abstract/AbstractSqliteConnectionOptions"

export interface AbstractSqlitePooledConnectionOptions
    extends AbstractSqliteConnectionOptions {
    /**
     * Database type.
     */
    readonly type: "sqlite-pooled"

    readonly minPoolSize?: number

    readonly maxPoolSize?: number
}
