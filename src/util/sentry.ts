export function captureException(
    error: unknown,
    captureContext?: Record<string, unknown>,
): void {
    import("@sentry/node")
        .then((sentry) => {
            sentry.captureException(error, captureContext)
        })
        .catch(() => {
            // Sentry not available, ignore
        })
}
