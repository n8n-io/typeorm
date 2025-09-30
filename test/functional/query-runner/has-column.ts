import "reflect-metadata"
import { DataSource } from "../../../src/data-source/DataSource"
import { Table } from "../../../src/schema-builder/table/Table"
import {
    closeTestingConnections,
    createTestingConnections,
} from "../../utils/test-utils"

describe("query runner > has column", () => {
    let connections: DataSource[]
    before(async () => {
        connections = await createTestingConnections({
            entities: [__dirname + "/entity/*{.js,.ts}"],
            schemaCreate: true,
            dropSchema: true,
        })
    })
    after(() => closeTestingConnections(connections))

    it("should correctly check if column exist", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                let hasIdColumn = await queryRunner.hasColumn("post", "id")
                let hasNameColumn = await queryRunner.hasColumn("post", "name")
                let hasVersionColumn = await queryRunner.hasColumn(
                    "post",
                    "version",
                )
                let hasDescriptionColumn = await queryRunner.hasColumn(
                    "post",
                    "description",
                )

                hasIdColumn.should.be.true
                hasNameColumn.should.be.true
                hasVersionColumn.should.be.true
                hasDescriptionColumn.should.be.false

                await queryRunner.release()
            }),
        ))

    it("should safely handle potentially malicious column names", () =>
        Promise.all(
            connections.map(async (connection) => {
                const queryRunner = connection.createQueryRunner()

                // Create a test table that we'll verify still exists after injection attempt
                await queryRunner.createTable(
                    new Table({
                        name: "injection_test_table",
                        columns: [
                            {
                                name: "test_column",
                                type: "varchar",
                                length: "255",
                            },
                        ],
                    }),
                    true,
                )

                // Test 1: SQL injection in column name parameter
                const maliciousColumnName =
                    "test'; DROP TABLE injection_test_table; --"
                let exists
                try {
                    exists = await queryRunner.hasColumn(
                        "post",
                        maliciousColumnName,
                    )
                    exists.should.be.false // Should return false for non-existent column
                } catch (error) {
                    // Acceptable if it throws due to proper parameterization
                    exists = false
                }

                // Verify the test table still exists (wasn't dropped by injection)
                const tableExists = await queryRunner.hasTable(
                    "injection_test_table",
                )
                tableExists.should.be.true

                // Test 2: SQL injection in table name parameter
                const maliciousTableName =
                    "post'; DROP TABLE injection_test_table; --"
                try {
                    exists = await queryRunner.hasColumn(
                        maliciousTableName,
                        "id",
                    )
                    exists.should.be.false
                } catch (error) {
                    exists = false
                }

                // Verify the test table still exists
                const tableStillExists = await queryRunner.hasTable(
                    "injection_test_table",
                )
                tableStillExists.should.be.true

                // Clean up
                await queryRunner.dropTable("injection_test_table", true)

                await queryRunner.release()
            }),
        ))
})
