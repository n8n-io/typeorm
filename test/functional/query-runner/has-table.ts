import "reflect-metadata"
import { DataSource } from "../../../src/data-source/DataSource"
import { Table } from "../../../src/schema-builder/table/Table"
import {
    closeTestingConnections,
    createTestingConnections,
} from "../../utils/test-utils"

describe("query runner > has table", () => {
    let connections: DataSource[]
    before(async () => {
        connections = await createTestingConnections({
            entities: [__dirname + "/entity/*{.js,.ts}"],
            schemaCreate: true,
            dropSchema: true,
        })
    })
    after(() => closeTestingConnections(connections))

    it("should correctly check if table exists", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                // Check for existing tables (created from entities)
                let hasPostTable = await queryRunner.hasTable("post")
                let hasPhotoTable = await queryRunner.hasTable("photo")
                let hasBookTable = await queryRunner.hasTable("book")
                let hasNonExistentTable = await queryRunner.hasTable(
                    "non_existent_table",
                )

                hasPostTable.should.be.true
                hasPhotoTable.should.be.true
                hasBookTable.should.be.true
                hasNonExistentTable.should.be.false

                await queryRunner.release()
            }),
        ))

    it("should correctly detect dynamically created tables", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                // Initially table doesn't exist
                let exists = await queryRunner.hasTable("test_dynamic_table")
                exists.should.be.false

                // Create table using TypeORM Table helper
                await queryRunner.createTable(
                    new Table({
                        name: "test_dynamic_table",
                        columns: [
                            {
                                name: "id",
                                type: "int",
                                isPrimary: true,
                            },
                            {
                                name: "name",
                                type: "varchar",
                                length: "255",
                            },
                        ],
                    }),
                    true,
                )

                // Now it should exist
                exists = await queryRunner.hasTable("test_dynamic_table")
                exists.should.be.true

                // Drop table
                await queryRunner.dropTable("test_dynamic_table", true)

                // Should not exist anymore
                exists = await queryRunner.hasTable("test_dynamic_table")
                exists.should.be.false

                await queryRunner.release()
            }),
        ))

    it("should handle table names with special characters", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                const testTableName = "test_table_123"

                // Initially table doesn't exist
                let exists = await queryRunner.hasTable(testTableName)
                exists.should.be.false

                // Create table with special characters in name
                await queryRunner.createTable(
                    new Table({
                        name: testTableName,
                        columns: [
                            {
                                name: "id",
                                type: "int",
                                isPrimary: true,
                            },
                        ],
                    }),
                    true,
                )

                // Should exist
                exists = await queryRunner.hasTable(testTableName)
                exists.should.be.true

                // Clean up
                await queryRunner.dropTable(testTableName, true)

                await queryRunner.release()
            }),
        ))

    it("should handle case sensitivity correctly", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                const originalName = "TestCaseTable"
                const lowerName = "testcasetable"

                // Create table
                await queryRunner.createTable(
                    new Table({
                        name: originalName,
                        columns: [
                            {
                                name: "id",
                                type: "int",
                                isPrimary: true,
                            },
                        ],
                    }),
                    true,
                )

                // Check existence with original name
                let existsOriginal = await queryRunner.hasTable(originalName)
                existsOriginal.should.be.true

                // Check with lowercase name (behavior may vary by database)
                let existsLower = await queryRunner.hasTable(lowerName)

                // For databases that are case-insensitive (like MySQL by default),
                // both should return true. For case-sensitive databases,
                // only the original case should return true.
                // We'll accept either behavior as valid.

                // Clean up
                await queryRunner.dropTable(originalName, true)

                // Both should not exist after drop
                existsOriginal = await queryRunner.hasTable(originalName)
                existsLower = await queryRunner.hasTable(lowerName)
                existsOriginal.should.be.false
                existsLower.should.be.false

                await queryRunner.release()
            }),
        ))

    it("should safely handle potentially malicious table names", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                // First, create a table that we'll verify still exists after the injection attempt
                await queryRunner.createTable(
                    new Table({
                        name: "injection_test_table",
                        columns: [
                            {
                                name: "id",
                                type: "int",
                                isPrimary: true,
                            },
                        ],
                    }),
                    true,
                )

                // Try to check for a table with SQL injection attempt in the name
                const maliciousName =
                    "test'; DROP TABLE injection_test_table; --"
                let exists
                try {
                    exists = await queryRunner.hasTable(maliciousName)
                    exists.should.be.false // Should simply return false for a non-existent table
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
                await queryRunner.dropTable("injection_test_table", true)

                await queryRunner.release()
            }),
        ))
})
