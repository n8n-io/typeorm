import "reflect-metadata"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"
import { DataSource } from "../../../src/data-source/DataSource"
import { Post } from "./entity/Post"

describe("other issues > hydration performance", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                entities: [__dirname + "/entity/*{.js,.ts}"],
                enabledDrivers: ["postgres"],
            })),
    )
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    it("if entity was changed in the listener, changed property should be updated in the db", () =>
        Promise.all(
            connections.map(async function (connection) {
                // insert posts in batches to stay within PostgreSQL parameter limits
                const totalPosts = 100000
                const batchSize = 10000
                for (let offset = 0; offset < totalPosts; offset += batchSize) {
                    const posts: Post[] = []
                    for (let i = offset + 1; i <= Math.min(offset + batchSize, totalPosts); i++) {
                        posts.push(new Post("Post #" + i))
                    }
                    await connection.manager.insert(Post, posts)
                }

                // select them using raw sql
                // console.time("select using raw sql");
                const loadedRawPosts = await connection.manager.query(
                    "SELECT * FROM post",
                )
                loadedRawPosts.length.should.be.equal(100000)
                // console.timeEnd("select using raw sql");

                // now select them using ORM
                // console.time("select using ORM");
                const loadedOrmPosts = await connection.manager.find(Post)
                loadedOrmPosts.length.should.be.equal(100000)
                // console.timeEnd("select using ORM");
            }),
        ))
})
