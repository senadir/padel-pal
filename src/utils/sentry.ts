import * as Sentry from '@sentry/tanstackstart-react'

/**
 * Wraps a server function handler to automatically capture exceptions in Sentry.
 *
 * Usage:
 * ```ts
 * export const myServerFn = createServerFn({ method: 'POST' })
 *   .handler(withSentry(async ({ data }) => {
 *     // your logic here
 *   }))
 * ```
 */
export function withSentry<TArgs, TResult>(
  handler: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs): Promise<TResult> => {
    try {
      return await handler(args)
    } catch (error) {
      // Capture the exception in Sentry with context
      Sentry.captureException(error, {
        extra: {
          handlerArgs:
            typeof args === 'object' && args !== null && 'data' in args
              ? (args as { data: unknown }).data
              : args,
        },
      })
      // Re-throw the error so it propagates normally
      throw error
    }
  }
}

/**
 * Captures a server-side exception manually with optional context.
 *
 * Usage:
 * ```ts
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   captureServerException(error, { userId, operation: 'riskyOperation' })
 *   throw error
 * }
 * ```
 */
export function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Adds breadcrumb for tracing server-side operations.
 *
 * Usage:
 * ```ts
 * addServerBreadcrumb('database', 'Fetching user profile', { userId })
 * ```
 */
export function addServerBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  })
}
