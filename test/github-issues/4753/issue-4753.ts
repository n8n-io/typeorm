import { DataSource } from "../../../src/data-source/DataSource"
import { PostgresConnectionOptions } from "../../../src/driver/postgres/PostgresConnectionOptions"
import {
    closeTestingConnections,
    getTypeOrmConfig,
    TestingConnectionOptions,
} from "../../utils/test-utils"
import { User } from "./entity/User"

function isPostgres(v: TestingConnectionOptions): v is PostgresConnectionOptions {
    return v.type === "postgres"
}

describe("github issues > #4753 Replication Config", () => {
    let dataSources: DataSource[] = []
    after(() => closeTestingConnections(dataSources))

    it("should connect without error when using replication", async () => {
        const connectionOptions: PostgresConnectionOptions | undefined =
            getTypeOrmConfig()
                .filter((v) => !v.skip)
                .find(isPostgres)

        if (!connectionOptions) {
            // Skip if Postgres tests aren't enabled at all
            return
        }
        const dataSource = new DataSource({
            type: "postgres",
            replication: {
                master: {
                    host: connectionOptions.host,
                    username: connectionOptions.username,
                    password: connectionOptions.password,
                    database: connectionOptions.database,
                },
                slaves: [
                    {
                        host: connectionOptions.host,
                        username: connectionOptions.username,
                        password: connectionOptions.password,
                        database: connectionOptions.database,
                    },
                ],
            },
            entities: [User],
        })

        dataSources.push(dataSource)
        await dataSource.connect()
        dataSource.isInitialized.should.be.true
    })
})
