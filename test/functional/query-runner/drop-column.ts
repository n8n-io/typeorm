import "reflect-metadata"
import { expect } from "chai"
import {
    closeTestingConnections,
    createTestingConnections,
} from "../../utils/test-utils"
import { DataSource } from "../../../src"
import { Table } from "../../../src/schema-builder/table/Table"

describe("query runner > drop column", () => {
    let connections: DataSource[]
    before(async () => {
        connections = await createTestingConnections({
            entities: [__dirname + "/entity/*{.js,.ts}"],
            schemaCreate: true,
            dropSchema: true,
        })
    })
    after(() => closeTestingConnections(connections))

    describe("when columns are instances of TableColumn", () => {
        it("should correctly drop column and revert drop", () =>
            Promise.all(
                connections.map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    let table = await queryRunner.getTable("post")
                    const idColumn = table!.findColumnByName("id")!
                    const nameColumn = table!.findColumnByName("name")!
                    const versionColumn = table!.findColumnByName("version")!
                    idColumn!.should.be.exist
                    nameColumn!.should.be.exist
                    versionColumn!.should.be.exist

                    // better-sqlite3 seems not able to create a check constraint on a non-existing column
                    if (connection.name === "better-sqlite3") {
                        await queryRunner.dropCheckConstraints(
                            table!,
                            table!.checks,
                        )
                    }

                    // In Sqlite 'dropColumns' method is more optimal than 'dropColumn', because it recreate table just once,
                    // without all removed columns. In other drivers it's no difference between these methods, because 'dropColumns'
                    // calls 'dropColumn' method for each removed column.
                    await queryRunner.dropColumns(table!, [
                        idColumn,
                        nameColumn,
                        versionColumn,
                    ])

                    table = await queryRunner.getTable("post")
                    expect(table!.findColumnByName("name")).to.be.undefined
                    expect(table!.findColumnByName("version")).to.be.undefined

                    await queryRunner.executeMemoryDownSql()

                    table = await queryRunner.getTable("post")
                    table!.findColumnByName("id")!.should.be.exist
                    table!.findColumnByName("name")!.should.be.exist
                    table!.findColumnByName("version")!.should.be.exist

                    await queryRunner.release()
                }),
            ))
    })

    describe("when columns are strings", () => {
        it("should correctly drop column and revert drop", () =>
            Promise.all(
                connections.map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    let table = await queryRunner.getTable("post")
                    const idColumn = table!.findColumnByName("id")!
                    const nameColumn = table!.findColumnByName("name")!
                    const versionColumn = table!.findColumnByName("version")!
                    idColumn!.should.be.exist
                    nameColumn!.should.be.exist
                    versionColumn!.should.be.exist

                    // better-sqlite3 seems not able to create a check constraint on a non-existing column
                    if (connection.name === "better-sqlite3") {
                        await queryRunner.dropCheckConstraints(
                            table!,
                            table!.checks,
                        )
                    }

                    // In Sqlite 'dropColumns' method is more optimal than 'dropColumn', because it recreate table just once,
                    // without all removed columns. In other drivers it's no difference between these methods, because 'dropColumns'
                    // calls 'dropColumn' method for each removed column.
                    await queryRunner.dropColumns(table!, [
                        "id",
                        "name",
                        "version",
                    ])

                    table = await queryRunner.getTable("post")
                    expect(table!.findColumnByName("name")).to.be.undefined
                    expect(table!.findColumnByName("version")).to.be.undefined

                    await queryRunner.executeMemoryDownSql()

                    table = await queryRunner.getTable("post")
                    table!.findColumnByName("id")!.should.be.exist
                    table!.findColumnByName("name")!.should.be.exist
                    table!.findColumnByName("version")!.should.be.exist

                    await queryRunner.release()
                }),
            ))
    })

    it("should safely handle SQL injection in hasEnumType", () =>
        Promise.all(
            connections
                .filter((connection) => connection.name === "postgres")
                .map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    // SQL Injection Attack Strategy:
                    // Create a column name that injects a subquery: test' OR (SELECT COUNT(*) FROM pg_type) > 0 OR '1'='
                    // This generates enumName: tablename_test' OR (SELECT COUNT(*) FROM pg_type) > 0 OR '1'='_enum
                    // Which injects into: WHERE "t"."typname" = 'tablename_test' OR (SELECT COUNT(*) FROM pg_type) > 0 OR '1'='_enum'
                    //
                    // VULNERABLE: The subquery executes and returns > 0, making hasEnumType return TRUE
                    //             TypeORM skips creating the enum, PostgreSQL fails with "does not exist"
                    //
                    // SECURE: Parameterized query treats entire string as literal, hasEnumType returns FALSE,
                    //         TypeORM creates the enum, table creation succeeds or fails with different error

                    const maliciousColumnName =
                        "test' OR (SELECT COUNT(*) FROM pg_type) > 0 OR '1'='"
                    let tableCreated = false
                    let creationError: any = null

                    try {
                        await queryRunner.createTable(
                            new Table({
                                name: "sqli_test",
                                columns: [
                                    {
                                        name: "id",
                                        type: "int",
                                        isPrimary: true,
                                    },
                                    {
                                        name: maliciousColumnName,
                                        type: "enum",
                                        enum: ["val1", "val2"],
                                    },
                                ],
                            }),
                            true,
                        )
                        tableCreated = true
                    } catch (error) {
                        creationError = error
                    }

                    // Verify: With vulnerable code, we get "does not exist" because SQL injection
                    // made hasEnumType return true, skipping enum creation
                    // With secure code, we either succeed or get a different error
                    if (creationError) {
                        expect(creationError.message).to.not.include(
                            "does not exist",
                        )
                    }

                    // Clean up
                    if (tableCreated) {
                        await queryRunner.dropTable("sqli_test", true)
                    }

                    await queryRunner.release()
                }),
        ))

    it("should safely handle SQL injection in getUserDefinedTypeName", () =>
        Promise.all(
            connections
                .filter((connection) => connection.name === "postgres")
                .map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    // Create a "victim" table with an ENUM to establish a baseline
                    await queryRunner.createTable(
                        new Table({
                            name: "victim_table",
                            columns: [
                                {
                                    name: "id",
                                    type: "int",
                                    isPrimary: true,
                                },
                                {
                                    name: "priority",
                                    type: "enum",
                                    enum: ["low", "high"],
                                },
                            ],
                        }),
                        true,
                    )

                    // SQL Injection Attack Strategy:
                    // Create a table with malicious name: test' OR '1'='1
                    // This injects into: WHERE "table_name" = 'test' OR '1'='1'
                    // Due to operator precedence: WHERE ... AND "table_name" = 'test' OR '1'='1' AND ...
                    // The OR makes it return columns from ALL tables, not just the target table
                    //
                    // VULNERABLE: getUserDefinedTypeName returns first matching column (could be from victim table)
                    //             Code tries to drop wrong enum type, causing error or dropping wrong enum
                    //
                    // SECURE: Parameterized query only returns columns from the specific table
                    //         Correct enum type is identified and dropped

                    const maliciousTableName = "test' OR '1'='1"
                    let maliciousTableCreated = false
                    let dropError: any = null

                    const tableWithMaliciousName = new Table({
                        name: maliciousTableName,
                        columns: [
                            {
                                name: "id",
                                type: "int",
                                isPrimary: true,
                            },
                            {
                                name: "priority",
                                type: "enum",
                                enum: ["yes", "no"],
                            },
                        ],
                    })

                    try {
                        // Create table with malicious name and ENUM column
                        await queryRunner.createTable(
                            tableWithMaliciousName,
                            true,
                        )
                        maliciousTableCreated = true

                        // Now try to drop the ENUM column using the Table object directly
                        // This avoids calling getTable which might also have SQL injection
                        // We pass the malicious table object, which will use its name in getUserDefinedTypeName
                        await queryRunner.dropColumn(
                            tableWithMaliciousName,
                            "priority",
                        )
                    } catch (error) {
                        dropError = error
                    }

                    // Clean up - use the actual table object, not the name
                    // This avoids triggering SQL injection in dropTable during cleanup
                    if (maliciousTableCreated) {
                        try {
                            // Try to drop using the table object directly
                            await queryRunner.dropTable(
                                tableWithMaliciousName,
                                true,
                            )
                        } catch (cleanupError) {
                            // If cleanup fails, try with raw SQL
                            try {
                                await queryRunner.query(
                                    `DROP TABLE IF EXISTS "${maliciousTableName}" CASCADE`,
                                )
                            } catch (e) {
                                // Ignore cleanup errors
                            }
                        }
                    }
                    await queryRunner.dropTable("victim_table", true)

                    // With VULNERABLE code: SQL injection in getUserDefinedTypeName causes errors
                    // The error would reference wrong tables (victim_table or system tables)
                    //
                    // With SECURE code: Operation completes successfully, dropError is null

                    // The test passes if dropError is null (operation succeeded)
                    // If dropError exists, it should not reference wrong tables
                    if (dropError) {
                        const errorMsg = dropError.message.toLowerCase()
                        // These would indicate SQL injection caused cross-table data leakage
                        expect(errorMsg).to.not.include("victim_table")
                        expect(errorMsg).to.not.include(
                            "victim_table_priority_enum",
                        )
                        expect(errorMsg).to.not.include("geography_columns")
                        expect(errorMsg).to.not.include("geometry_columns")
                    }

                    await queryRunner.release()
                }),
        ))
})
