/**
 * Column types used for @PrimaryGeneratedColumn() decorator.
 */
export type PrimaryGeneratedColumnType =
    | "int" // postgres, sqlite
    | "int2" // postgres, sqlite
    | "int4" // postgres
    | "int8" // postgres, sqlite
    | "integer" // postgres, sqlite
    | "tinyint" // sqlite
    | "smallint" // postgres, sqlite
    | "mediumint" // sqlite
    | "bigint" // postgres, sqlite
    | "decimal" // postgres, sqlite
    | "numeric" // postgres, sqlite

/**
 * Column types where spatial properties are used.
 */
export type SpatialColumnType =
    | "geometry" // postgres
    | "geography" // postgres

/**
 * Column types where precision and scale properties are used.
 */
export type WithPrecisionColumnType =
    | "float" // postgres, sqlite
    | "double" // sqlite
    | "decimal" // postgres, sqlite
    | "numeric" // postgres, sqlite
    | "real" // postgres, sqlite
    | "double precision" // postgres, sqlite
    | "datetime" // sqlite
    | "time" // postgres
    | "time with time zone" // postgres
    | "time without time zone" // postgres
    | "timestamp" // postgres
    | "timestamp without time zone" // postgres
    | "timestamp with time zone" // postgres

/**
 * Column types where column length is used.
 */
export type WithLengthColumnType =
    | "character varying" // postgres
    | "varying character" // sqlite
    | "nvarchar" // sqlite
    | "character" // postgres, sqlite
    | "native character" // sqlite
    | "varchar" // postgres, sqlite
    | "char" // postgres
    | "nchar" // sqlite
    | "nvarchar2" // sqlite
    | "string" // all supported dbs

/**
 * All other regular column types.
 */
export type SimpleColumnType =
    | "simple-array" // typeorm-specific, automatically mapped to string
    // |"string" // typeorm-specific, automatically mapped to varchar depend on platform
    | "simple-json" // typeorm-specific, automatically mapped to string
    | "simple-enum" // typeorm-specific, automatically mapped to string

    // numeric types
    | "int" // postgres, sqlite
    | "int2" // postgres, sqlite
    | "int4" // postgres
    | "int8" // postgres, sqlite
    | "int64" // cockroachdb
    | "integer" // postgres, sqlite
    | "tinyint" // sqlite
    | "smallint" // postgres, sqlite
    | "mediumint" // sqlite
    | "bigint" // postgres, sqlite
    | "unsigned big int" // sqlite
    | "float" // postgres, sqlite
    | "float4" // postgres
    | "float8" // postgres
    | "money" // postgres

    // boolean types
    | "boolean" // postgres, sqlite
    | "bool" // postgres

    // text/binary types
    | "blob" // sqlite
    | "text" // postgres, sqlite
    | "citext" // postgres
    | "hstore" // postgres
    | "bytea" // postgres
    | "clob" // sqlite

    // date types
    | "timetz" // postgres
    | "timestamptz" // postgres
    | "date" // postgres, sqlite
    | "interval" // postgres

    // geometric types
    | "point" // postgres
    | "line" // postgres
    | "lseg" // postgres
    | "box" // postgres
    | "circle" // postgres
    | "path" // postgres
    | "polygon" // postgres
    | "geometry" // postgres

    // range types
    | "int4range" // postgres
    | "int8range" // postgres
    | "numrange" // postgres
    | "tsrange" // postgres
    | "tstzrange" // postgres
    | "daterange" // postgres

    // multirange types
    | "int4multirange" // postgres
    | "int8multirange" // postgres
    | "nummultirange" // postgres
    | "tsmultirange" // postgres
    | "tstzmultirange" // postgres
    | "datemultirange" // postgres

    // other types
    | "enum" // postgres
    | "cidr" // postgres
    | "inet" // postgres
    | "macaddr" // postgres
    | "bit" // postgres
    | "bit varying" // postgres
    | "varbit" // postgres
    | "tsvector" // postgres
    | "tsquery" // postgres
    | "uuid" // postgres
    | "xml" // postgres
    | "json" // postgres, sqlite
    | "jsonb" // postgres
    | "cube" // postgres
    | "ltree" // postgres

/**
 * Any column type column can be.
 */
export type ColumnType =
    | WithPrecisionColumnType
    | WithLengthColumnType
    | SpatialColumnType
    | SimpleColumnType
    | BooleanConstructor
    | DateConstructor
    | NumberConstructor
    | StringConstructor
