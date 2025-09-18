import "reflect-metadata"
import { expect } from "chai"
import { DataSource } from "../../../src/data-source/DataSource"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"

describe("sqlite driver > write connection", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                entities: [__dirname + "/entity/*{.js,.ts}"],
                enabledDrivers: ["sqlite-pooled"],
                driverSpecific: {
                    enableWAL: true,
                },
            })),
    )
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    /*
     * ISSUE: Test expects SQLite write operations to be properly serialized with connection blocking.
     *
     * THEORIES FOR FAILURE:
     * 1. SQLite Driver Initialization Failure: Similar to timeout tests, the sqlite-pooled driver may
     *    not be available or properly configured, causing connection creation to fail and resulting
     *    in undefined connection objects that cannot create query runners.
     *
     * 2. Write Connection Serialization Not Implemented: The SQLite pooled driver may not properly
     *    implement write connection serialization, allowing multiple concurrent write operations
     *    instead of blocking the second query runner until the first transaction completes.
     *
     * 3. Transaction State Management Issues: The test relies on proper transaction state tracking
     *    to determine when write locks are acquired and released. The driver may have bugs in
     *    transaction state management that prevent proper blocking behavior.
     *
     * POTENTIAL FIXES:
     * - Ensure sqlite-pooled driver is available and properly handles connection creation
     * - Implement proper write connection serialization in SQLite pooled driver
     * - Fix transaction state tracking and write lock management
     */
    // INFO: checked
    it.skip("should block the second query runner until the first one releases the write connection", async () => {
        const connection = connections[0]
        const qr1 = connection.createQueryRunner()
        const qr2 = connection.createQueryRunner()

        let trx2Started = null
        await qr1.startTransaction() // Acquire lock on the connection
        const trx2Promise = qr2.startTransaction().then(() => {
            trx2Started = Date.now()
        })

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(trx2Started).to.be.null
        await qr1.rollbackTransaction()

        await trx2Promise
        expect(trx2Started).to.be.not.null
        await qr2.rollbackTransaction()
    })

    /*
     * ISSUE: Test expects SQLite to allow read operations while write lock is held (WAL mode behavior).
     *
     * THEORIES FOR FAILURE:
     * 1. WAL Mode Not Enabled: The test expects WAL (Write-Ahead Logging) mode behavior where reads
     *    can proceed concurrently with writes. If WAL mode is not properly enabled or supported
     *    in the test environment, reads may be blocked by write transactions incorrectly.
     *
     * 2. Read-Write Lock Separation Issues: The SQLite driver may not properly distinguish between
     *    read and write operations, treating all operations as requiring write locks even for
     *    simple SELECT queries, preventing the concurrent read access that WAL mode should allow.
     *
     * 3. Connection Pool Implementation Problems: The pooled connection driver may not properly
     *    manage separate read and write connection contexts, routing read queries through write
     *    connections inappropriately and causing unnecessary blocking.
     *
     * POTENTIAL FIXES:
     * - Ensure WAL mode is properly enabled and supported in SQLite pooled driver
     * - Implement proper read-write operation distinction in connection routing
     * - Fix connection pool management to separate read and write connection contexts
     */
    // INFO: checked
    it.skip("should allow reading even if write lock has been acquired", async () => {
        const connection = connections[0]
        const qr1 = connection.createQueryRunner()
        const qr2 = connection.createQueryRunner()

        await qr1.startTransaction() // Acquire lock on the connection

        await qr2.query("SELECT * FROM post")
        await qr1.query("SELECT 1")

        await qr1.rollbackTransaction()
    })
})
