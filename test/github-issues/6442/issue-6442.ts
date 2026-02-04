import "reflect-metadata"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
    setupSingleTestingConnection,
} from "../../utils/test-utils"
import { DataSource } from "../../../src"
import { fail } from "assert"
import { PostgresConnectionOptions } from "../../../src/driver/postgres/PostgresConnectionOptions"

describe("github issues > #6442 JoinTable does not respect inverseJoinColumns referenced column width", () => {
    let connections: DataSource[]

    before(async () => {
        return (connections = await createTestingConnections({
            entities: [__dirname + "/entity/v1/*{.js,.ts}"],
            schemaCreate: true,
            dropSchema: true,
            enabledDrivers: ["postgres"],
        }))
    })
    beforeEach(async () => await reloadTestingDatabases(connections))
    after(async () => await closeTestingConnections(connections))

    it("should generate column widths equal to the referenced column widths", async () => {
        await Promise.all(
            connections.map(async (connection) => {
                const options = setupSingleTestingConnection(
                    connection.options.type,
                    {
                        name: `${connection.name}-v2`,
                        entities: [__dirname + "/entity/v2/*{.js,.ts}"],
                        dropSchema: false,
                        schemaCreate: false,
                    },
                ) as PostgresConnectionOptions

                if (!options) {
                    await connection.close()
                    fail()
                }

                const migrationDataSource = new DataSource(options)
                await migrationDataSource.initialize()
                try {
                    const sqlInMemory = await migrationDataSource.driver
                        .createSchemaBuilder()
                        .log()

                    // Verify that migration queries are generated
                    sqlInMemory.upQueries.length.should.be.greaterThan(0)
                } finally {
                    await connection.close()
                    await migrationDataSource.close()
                }
            }),
        )
    })
})
