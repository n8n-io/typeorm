/**
 * Database's table index options.
 */
export interface TableIndexOptions {
    // -------------------------------------------------------------------------
    // Public Properties
    // -------------------------------------------------------------------------

    /**
     * Constraint name.
     */
    name?: string

    /**
     * Columns included in this index.
     */
    columnNames: string[]

    /**
     * Indicates if this index is unique.
     */
    isUnique?: boolean

    /**
     * If true, creates a GiST index for spatial data types.
     * Works only in PostgreSQL.
     */
    isSpatial?: boolean

    /**
     * Builds the index using the concurrently option.
     * This options is only supported for postgres database.
     */
    isConcurrent?: boolean

    /**
     * NULL_FILTERED indexes are particularly useful for indexing sparse columns, where most rows contain a NULL value.
     * In these cases, the NULL_FILTERED index can be considerably smaller and more efficient to maintain than
     * a normal index that includes NULL values.
     *
     * Works only in Spanner.
     */
    isNullFiltered?: boolean

    /**
     * Index filter condition.
     */
    where?: string
}
