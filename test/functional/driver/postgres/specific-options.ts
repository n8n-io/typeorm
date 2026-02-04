import "reflect-metadata"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { DataSource } from "../../../../src/data-source/DataSource"
import { expect } from "chai"

describe("postgres specific options", () => {
    describe("applicationName", () => {
        let connections: DataSource[]
        before(
            async () =>
                (connections = await createTestingConnections({
                    enabledDrivers: ["postgres"],
                    driverSpecific: {
                        applicationName: "some test name",
                    },
                })),
        )
        beforeEach(() => reloadTestingDatabases(connections))
        after(() => closeTestingConnections(connections))

        it("should set application_name", () =>
            Promise.all(
                connections.map(async (connection) => {
                    const result = await connection.query(
                        "select current_setting('application_name') as application_name",
                    )
                    expect(result.length).equals(1)
                    expect(result[0].application_name).equals("some test name")
                }),
            ))
    })

    // No reloadTestingDatabases needed - these tests only run queries without database setup
    describe("statementTimeout", () => {
        let connections: DataSource[]
        before(
            async () =>
                (connections = await createTestingConnections({
                    enabledDrivers: ["postgres"],
                    driverSpecific: {
                        statementTimeout: 1,
                    },
                })),
        )
        after(() => closeTestingConnections(connections))

        it("should timeout statements that exceed the limit", () =>
            Promise.all(
                connections.map(async (connection) => {
                    await expect(
                        connection.query("SELECT pg_sleep(1)"),
                    ).to.be.rejectedWith(/canceling statement due to statement timeout/)
                }),
            ))
    })

    describe("queryTimeout", () => {
        let connections: DataSource[]
        before(
            async () =>
                (connections = await createTestingConnections({
                    enabledDrivers: ["postgres"],
                    driverSpecific: {
                        queryTimeout: 1,
                    },
                })),
        )
        after(() => closeTestingConnections(connections))

        it("should timeout queries that exceed the limit", () =>
            Promise.all(
                connections.map(async (connection) => {
                    await expect(
                        connection.query("SELECT pg_sleep(1)"),
                    ).to.be.rejectedWith(/Query read timeout/)
                }),
            ))
    })
})
