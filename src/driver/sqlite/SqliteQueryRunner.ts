import { pRetry } from "../../lib/p-retry"
import type { sqlite3, Database as Sqlite3Database } from "sqlite3"
import { QueryRunnerAlreadyReleasedError } from "../../error/QueryRunnerAlreadyReleasedError"
import { QueryResult } from "../../query-runner/QueryResult"
import { QueryFailedError } from "../../error/QueryFailedError"
import { AbstractSqlitePooledQueryRunner } from "../sqlite-abstract/AbstractSqlitePooledQueryRunner"
import { BroadcasterResult } from "../../subscriber/BroadcasterResult"
import { ConnectionIsNotSetError } from "../../error/ConnectionIsNotSetError"

function shouldRetry(err: Error) {
    return err.message.includes("SQLITE_BUSY")
}

export class SqliteQueryRunner extends AbstractSqlitePooledQueryRunner<
    sqlite3,
    Sqlite3Database
> {
    /**
     * Called before migrations are run.
     */
    async beforeMigration(): Promise<void> {
        await this.query(`PRAGMA foreign_keys = OFF`)
    }

    /**
     * Called after migrations are run.
     */
    async afterMigration(): Promise<void> {
        await this.query(`PRAGMA foreign_keys = ON`)
    }

    /**
     * Executes a given SQL query.
     */
    async query(
        query: string,
        parameters?: any[],
        useStructuredResult = false,
    ): Promise<any> {
        if (this.isReleased) throw new QueryRunnerAlreadyReleasedError()

        const connection = this.driver.connection
        const broadcasterResult = new BroadcasterResult()
        const broadcaster = this.broadcaster

        broadcaster.broadcastBeforeQueryEvent(
            broadcasterResult,
            query,
            parameters,
        )

        if (!connection.isInitialized) {
            throw new ConnectionIsNotSetError("sqlite")
        }

        try {
            const databaseConnection = await this.connect()

            return await this.runQueryWithRetry(
                databaseConnection,
                broadcasterResult,
                query,
                parameters,
                useStructuredResult,
            )
        } finally {
            await broadcasterResult.wait()
        }
    }

    private async runQueryWithRetry(
        databaseConnection: Sqlite3Database,
        broadcasterResult: BroadcasterResult,
        query: string,
        parameters?: any[],
        useStructuredResult = false,
    ): Promise<QueryResult | any> {
        const broadcaster = this.broadcaster
        const connection = this.driver.connection
        const maxQueryExecutionTime = this.driver.options.maxQueryExecutionTime

        try {
            this.driver.connection.logger.logQuery(query, parameters, this)
            const queryStartTime = +new Date()

            const retryOptions = {
                // Max 10 retries, starting with 20ms and 1.71x factor and
                // using randomize (multiply each retry with random number
                // between 1 and 2).
                // Total delay with 10 retries: between 6000ms and 12000ms
                factor: 1.71,
                minTimeout: 20,
                retries: 10,
                randomize: true,
                signal: this.abortController.signal,
                shouldRetry,
            }

            const result = await pRetry(
                () =>
                    this.runQuery(
                        databaseConnection,
                        query,
                        parameters,
                        useStructuredResult,
                    ),
                retryOptions,
            )

            // log slow queries if maxQueryExecution time is set
            const queryEndTime = +new Date()
            const queryExecutionTime = queryEndTime - queryStartTime
            if (
                maxQueryExecutionTime &&
                queryExecutionTime > maxQueryExecutionTime
            )
                connection.logger.logQuerySlow(
                    queryExecutionTime,
                    query,
                    parameters,
                    this,
                )

            broadcaster.broadcastAfterQueryEvent(
                broadcasterResult,
                query,
                parameters,
                true,
                queryExecutionTime,
                useStructuredResult ? result.raw : result,
                undefined,
            )

            return result
        } catch (err) {
            connection.logger.logQueryError(err, query, parameters, this)
            broadcaster.broadcastAfterQueryEvent(
                broadcasterResult,
                query,
                parameters,
                false,
                undefined,
                undefined,
                err,
            )
            throw err
        }
    }

    private async runQuery(
        databaseConnection: Sqlite3Database,
        query: string,
        parameters?: any[],
        useStructuredResult = false,
    ): Promise<QueryResult | any> {
        return await new Promise((resolve, reject) => {
            try {
                const isInsertQuery = query.startsWith("INSERT ")
                const isDeleteQuery = query.startsWith("DELETE ")
                const isUpdateQuery = query.startsWith("UPDATE ")

                const handler = function (this: any, err: any, rows: any) {
                    if (err) {
                        return reject(
                            new QueryFailedError(query, parameters, err),
                        )
                    } else {
                        const result = new QueryResult()

                        if (isInsertQuery) {
                            result.raw = this["lastID"]
                        } else {
                            result.raw = rows
                        }

                        if (Array.isArray(rows)) {
                            result.records = rows
                        }

                        result.affected = this["changes"]

                        if (useStructuredResult) {
                            resolve(result)
                        } else {
                            resolve(result.raw)
                        }
                    }
                }

                if (isInsertQuery || isDeleteQuery || isUpdateQuery) {
                    databaseConnection.run(query, parameters, handler)
                } else {
                    databaseConnection.all(query, parameters, handler)
                }
            } catch (err) {
                reject(err)
            }
        })
    }
}
