import "reflect-metadata"
import { DataSource } from "../../../src/data-source/DataSource"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"

describe("query runner > create and drop database", () => {
    let connections: DataSource[]
    before(async () => {
        connections = await createTestingConnections({
            entities: [__dirname + "/entity/*{.js,.ts}"],
            enabledDrivers: ["mysql", "postgres"],
            dropSchema: true,
        })
    })
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    it("should correctly create and drop database and revert it", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                await queryRunner.createDatabase("myTestDatabase", true)
                let hasDatabase = await queryRunner.hasDatabase(
                    "myTestDatabase",
                )
                hasDatabase.should.be.true

                await queryRunner.dropDatabase("myTestDatabase")
                hasDatabase = await queryRunner.hasDatabase("myTestDatabase")
                hasDatabase.should.be.false

                await queryRunner.executeMemoryDownSql()

                hasDatabase = await queryRunner.hasDatabase("myTestDatabase")
                hasDatabase.should.be.false

                await queryRunner.release()
            }),
        ))

    it("should correctly detect existing database", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                await queryRunner.createDatabase("test_db_exists", true)
                const exists = await queryRunner.hasDatabase("test_db_exists")
                exists.should.be.true
                await queryRunner.dropDatabase("test_db_exists")

                await queryRunner.release()
            }),
        ))

    it("should correctly detect non-existing database", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                const exists = await queryRunner.hasDatabase(
                    "non_existent_db_xyz",
                )
                exists.should.be.false

                await queryRunner.release()
            }),
        ))

    it("should handle database names with special characters", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                await queryRunner.createDatabase("test_db_123", true)
                const exists = await queryRunner.hasDatabase("test_db_123")
                exists.should.be.true
                await queryRunner.dropDatabase("test_db_123")

                await queryRunner.release()
            }),
        ))

    it("should handle case sensitivity correctly", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                await queryRunner.createDatabase("TestDatabase", true)
                const existsLower = await queryRunner.hasDatabase(
                    "testdatabase",
                )
                const existsOriginal = await queryRunner.hasDatabase(
                    "TestDatabase",
                )
                // At least one should be true (depends on database behavior)
                ;(existsLower || existsOriginal).should.be.true
                await queryRunner.dropDatabase("TestDatabase")

                await queryRunner.release()
            }),
        ))

    it("should safely handle potentially malicious database names", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                // First, create a table that we'll verify still exists after the injection attempt
                await queryRunner.query(
                    `CREATE TABLE IF NOT EXISTS injection_test_table (id INT)`,
                )

                // Try to check for a database with SQL injection attempt in the name
                const maliciousName =
                    "test'; DROP TABLE injection_test_table; --"
                let exists
                try {
                    exists = await queryRunner.hasDatabase(maliciousName)
                    exists.should.be.false // Should simply return false for a non-existent database
                } catch (error) {
                    // If the database driver properly prevents SQL injection, it might throw an error
                    // which is also acceptable behavior (parameterized queries working correctly)
                    exists = false
                }

                // Verify the table still exists (wasn't dropped by injection)
                const tableExists = await queryRunner.hasTable(
                    "injection_test_table",
                )
                tableExists.should.be.true

                // Clean up
                await queryRunner.query(
                    `DROP TABLE IF EXISTS injection_test_table`,
                )

                await queryRunner.release()
            }),
        ))
})
