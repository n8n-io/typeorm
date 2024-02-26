/**
 * Copy of https://github.com/sindresorhus/p-retry/blob/21a22dd094a54e0c364ddd4bcb91c2f88e2dd03c/index.js
 *
 * The original package is licensed under the MIT License
 *
 * Copied here since `p-retry` package is published only as ESM. Only change is
 * to use a named import instead of default.
 */
import retry from "../retry"

export class AbortError extends Error {
    constructor(message) {
        super()

        if (message instanceof Error) {
            this.originalError = message
            ;({ message } = message)
        } else {
            this.originalError = new Error(message)
            this.originalError.stack = this.stack
        }

        this.name = "AbortError"
        this.message = message
    }
}

const decorateErrorWithCounts = (error, attemptNumber, options) => {
    // Minus 1 from attemptNumber because the first attempt does not count as a retry
    const retriesLeft = options.retries - (attemptNumber - 1)

    error.attemptNumber = attemptNumber
    error.retriesLeft = retriesLeft
    return error
}

export async function pRetry(input, options) {
    return new Promise((resolve, reject) => {
        options = {
            onFailedAttempt() {},
            retries: 10,
            shouldRetry: () => true,
            ...options,
        }

        const operation = retry.operation(options)

        const abortHandler = () => {
            operation.stop()
            reject(options.signal?.reason)
        }

        if (options.signal && !options.signal.aborted) {
            options.signal.addEventListener("abort", abortHandler, {
                once: true,
            })
        }

        const cleanUp = () => {
            options.signal?.removeEventListener("abort", abortHandler)
            operation.stop()
        }

        operation.attempt(async (attemptNumber) => {
            try {
                const result = await input(attemptNumber)
                cleanUp()
                resolve(result)
            } catch (error) {
                try {
                    if (!(error instanceof Error)) {
                        throw new TypeError(
                            `Non-error was thrown: "${error}". You should only throw errors.`,
                        )
                    }

                    if (error instanceof AbortError) {
                        throw error.originalError
                    }

                    if (error instanceof TypeError) {
                        throw error
                    }

                    decorateErrorWithCounts(error, attemptNumber, options)

                    if (!(await options.shouldRetry(error))) {
                        operation.stop()
                        reject(error)
                    }

                    await options.onFailedAttempt(error)

                    if (!operation.retry(error)) {
                        throw operation.mainError()
                    }
                } catch (finalError) {
                    decorateErrorWithCounts(finalError, attemptNumber, options)
                    cleanUp()
                    reject(finalError)
                }
            }
        })
    })
}
