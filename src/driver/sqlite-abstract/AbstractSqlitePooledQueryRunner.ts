import { captureException } from "@sentry/node"
import { TransactionNotStartedError } from "../../error/TransactionNotStartedError"
import { AbstractSqlitePooledDriver } from "./AbstractSqlitePooledDriver"
import { IsolationLevel } from "../types/IsolationLevel"
import { TransactionAlreadyStartedError, TypeORMError } from "../../error"
import { TransactionRollbackFailedError } from "../../error/TransactionRollbackFailedError"
import { Broadcaster } from "../../subscriber/Broadcaster"
import { AbstractSqliteQueryRunner } from "../sqlite-abstract/AbstractSqliteQueryRunner"
import { TransactionCommitFailedError } from "../../error/TransactionCommitFailedError"

/**
 * Runs queries on a single sqlite database connection.
 */
export abstract class AbstractSqlitePooledQueryRunner<
    TSQLiteLib,
    TDbImpl extends object,
> extends AbstractSqliteQueryRunner {
    // -------------------------------------------------------------------------
    // Public Implemented Properties
    // -------------------------------------------------------------------------

    public abortController = new AbortController()

    /**
     * Database driver used by connection.
     */
    driver: AbstractSqlitePooledDriver<TSQLiteLib, TDbImpl>

    /**
     * Promise used to obtain a database connection for a first time.
     */
    protected databaseConnectionPromise: Promise<TDbImpl>

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(driver: AbstractSqlitePooledDriver<TSQLiteLib, TDbImpl>) {
        super()

        this.driver = driver
        this.connection = driver.connection
        this.broadcaster = new Broadcaster(this)
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Creates/uses database connection from the connection pool to perform further operations.
     * Returns obtained database connection.
     */
    connect(): Promise<TDbImpl> {
        if (this.databaseConnectionPromise)
            return this.databaseConnectionPromise

        this.databaseConnectionPromise = this.driver
            .obtainDatabaseConnection()
            .then((dbConnection) => {
                this.driver.connectedQueryRunners.push(this)
                this.databaseConnection = dbConnection
                return dbConnection
            })

        return this.databaseConnectionPromise
    }

    /**
     * Releases used database connection
     */
    async release(): Promise<void> {
        if (this.isReleased || !this.databaseConnectionPromise) {
            return
        }

        // Handle the case where the connection is still being made
        const dbConnection = await this.databaseConnectionPromise

        // Abort any ongoing retry operations
        this.abortController.abort()

        this.driver.releaseDatabaseConnection(dbConnection)
        this.driver.connectedQueryRunners =
            this.driver.connectedQueryRunners.filter(
                (runner) => runner !== this,
            )
        this.isReleased = true
    }

    /**
     * Starts transaction.
     */
    async startTransaction(isolationLevel?: IsolationLevel): Promise<void> {
        if (this.driver.transactionSupport === "none")
            throw new TypeORMError(
                `Transactions aren't supported by ${this.connection.driver.options.type}.`,
            )

        if (
            this.isTransactionActive &&
            this.driver.transactionSupport === "simple"
        )
            throw new TransactionAlreadyStartedError()

        if (
            isolationLevel &&
            isolationLevel !== "READ UNCOMMITTED" &&
            isolationLevel !== "SERIALIZABLE"
        )
            throw new TypeORMError(
                `SQLite only supports SERIALIZABLE and READ UNCOMMITTED isolation`,
            )

        this.isTransactionActive = true
        try {
            await this.broadcaster.broadcast("BeforeTransactionStart")
        } catch (err) {
            this.isTransactionActive = false
            throw err
        }

        if (isolationLevel) {
            if (isolationLevel === "READ UNCOMMITTED") {
                await this.query("PRAGMA read_uncommitted = true")
            } else {
                await this.query("PRAGMA read_uncommitted = false")
            }
        }

        await this.query("BEGIN TRANSACTION")

        await this.broadcaster.broadcast("AfterTransactionStart")
    }

    /**
     * Commits transaction.
     * Error will be thrown if transaction was not started.
     */
    async commitTransaction(): Promise<void> {
        try {
            if (!this.isTransactionActive)
                throw new TransactionNotStartedError()

            await this.broadcaster.broadcast("BeforeTransactionCommit")

            await this.query("COMMIT")
            this.isTransactionActive = false

            await this.broadcaster.broadcast("AfterTransactionCommit")
        } catch (commitError) {
            this.driver.invalidateDatabaseConnection(this.databaseConnection)
            captureException(new TransactionCommitFailedError(commitError))
            throw commitError
        }
    }

    /**
     * Rollbacks transaction.
     * Error will be thrown if transaction was not started.
     */
    async rollbackTransaction(): Promise<void> {
        try {
            if (!this.isTransactionActive)
                throw new TransactionNotStartedError()

            await this.broadcaster.broadcast("BeforeTransactionRollback")

            await this.query("ROLLBACK")
            this.isTransactionActive = false

            await this.broadcaster.broadcast("AfterTransactionRollback")
        } catch (rollbackError) {
            this.driver.invalidateDatabaseConnection(this.databaseConnection)
            captureException(new TransactionRollbackFailedError(rollbackError))
            throw rollbackError
        }
    }
}
