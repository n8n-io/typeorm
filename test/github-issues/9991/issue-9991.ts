import { DataSource } from "../../../src"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"
import { ExampleEntity } from "./entity/ExampleEntity"
import { expect } from "chai"

describe("github issues > #9991", () => {
    let dataSources: DataSource[]

    before(async () => {
        dataSources = await createTestingConnections({
            entities: [ExampleEntity],
            enabledDrivers: ["postgres"],
        })
    })

    beforeEach(() => reloadTestingDatabases(dataSources))
    after(() => closeTestingConnections(dataSources))

    const getTableCommentSql =
        "SELECT obj_description(c.oid) AS table_comment FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'example' AND n.nspname = 'public'"

    it("add table comment", async () => {
        await Promise.all(
            dataSources.map(async (dataSource) => {
                const result =
                    await dataSource.manager.query(getTableCommentSql)
                expect(result[0].table_comment).to.be.eql("table comment")
            }),
        )
    })

    it("should correctly change table comment and change", async () => {
        await Promise.all(
            dataSources.map(async (dataSource) => {
                const queryRunner = dataSource.createQueryRunner()
                let table = await queryRunner.getTable("example")

                await queryRunner.changeTableComment(
                    table!,
                    "new table comment",
                )

                let result =
                    await dataSource.manager.query(getTableCommentSql)
                expect(result[0].table_comment).to.be.eql(
                    "new table comment",
                )

                // revert changes
                await queryRunner.executeMemoryDownSql()

                result =
                    await dataSource.manager.query(getTableCommentSql)
                expect(result[0].table_comment).to.be.eql("table comment")

                await queryRunner.release()
            }),
        )
    })

    it("should correctly synchronize when table comment change", async () => {
        await Promise.all(
            dataSources.map(async (dataSource) => {
                const queryRunner = dataSource.createQueryRunner()

                const exampleMetadata = dataSource.getMetadata(ExampleEntity)
                exampleMetadata.comment = "change table comment"

                await dataSource.synchronize()

                const result =
                    await dataSource.manager.query(getTableCommentSql)
                expect(result[0].table_comment).to.be.eql(
                    "change table comment",
                )

                await queryRunner.release()
            }),
        )
    })
})
