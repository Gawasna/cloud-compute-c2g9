import { captureLooseError } from "@/lib/observability";

export interface ClientHandlerOptions {
  source?: string;
  onError?: (error: Error) => void;
  showToast?: (message: string) => void;
  fallbackMessage?: string;
  onSuccess?: () => void;
}

/**
 * Higher-Order Function (HOF) for client-side event handlers and asynchronous actions.
 * Traps all exceptions, reports them as loose telemetry to Bugsink, and invokes UI feedback.
 */
export function withClientHandler<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: ClientHandlerOptions = {}
) {
  return async (...args: TArgs): Promise<TReturn | undefined> => {
    try {
      const result = await fn(...args);
      if (options.onSuccess) {
        options.onSuccess();
      }
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const source = options.source || "client.event_handler";

      try {
        captureLooseError(err, { source });
      } catch {
        /* telemetry resilience */
      }

      const message =
        options.fallbackMessage || err.message || "Đã xảy ra lỗi khi thực hiện thao tác.";
      if (options.showToast) {
        options.showToast(message);
      }
      if (options.onError) {
        options.onError(err);
      }
      return undefined;
    }
  };
}

/**
 * Functional safe wrapper for Promises returning a tuple of [data, error].
 */
export async function safeAsync<T>(
  promise: Promise<T>,
  telemetrySource?: string
): Promise<[T, null] | [null, Error]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (telemetrySource) {
      try {
        captureLooseError(err, { source: telemetrySource });
      } catch {
        /* telemetry resilience */
      }
    }
    return [null, err];
  }
}
