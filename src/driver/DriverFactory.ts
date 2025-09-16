import type { Driver, DriverConstructor } from "./Driver"
import type { DataSource } from "../data-source/DataSource"
import { MissingDriverError } from "../error/MissingDriverError"

const getDriver = async (
    type: DataSource["options"]["type"],
): Promise<DriverConstructor> => {
    switch (type) {
        case "mysql":
        case "mariadb":
            return (await import("./mysql/MysqlDriver")).MysqlDriver
        case "postgres":
            return (await import("./postgres/PostgresDriver")).PostgresDriver
        case "sqlite":
            return (await import("./sqlite/SqliteDriver")).SqliteDriver
        case "sqlite-pooled":
            return (await import("./sqlite-pooled/SqliteReadWriteDriver"))
                .SqliteReadWriteDriver
        default:
            throw new MissingDriverError(type, [
                "mariadb",
                "mysql",
                "postgres",
                "sqlite",
                "sqlite-pooled",
            ])
    }
}

/**
 * Helps to create drivers.
 */
export class DriverFactory {
    /**
     * Creates a new driver depend on a given connection's driver type.
     */
    static async create(connection: DataSource): Promise<Driver> {
        const { type } = connection.options
        return new (await getDriver(type))(connection)
    }
}
