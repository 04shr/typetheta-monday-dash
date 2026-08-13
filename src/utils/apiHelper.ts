/**
 * Helper to safely fetch JSON from server endpoints without throwing
 * "Unexpected token '<', '<!doctype '..." when an endpoint returns non-JSON/HTML.
 * Includes automatic retry with delay for network errors ("Failed to fetch").
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit,
  retries = 2,
  delayMs = 800
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          const snippet = text.replace(/<[^>]*>?/gm, "").trim().slice(0, 100);
          throw new Error(
            `Server returned invalid response format (Status ${response.status}): ${snippet || "Non-JSON server response"}`
          );
        }
      }

      if (!response.ok) {
        const errorMsg =
          data && (data.error || data.message || data.details)
            ? typeof data.details === "string"
              ? `${data.error}: ${data.details}`
              : data.error || data.message
            : `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: any) {
      lastError = err;
      const isNetworkOrServerError =
        err?.name === "TypeError" ||
        err?.message?.includes("Failed to fetch") ||
        err?.message?.includes("NetworkError") ||
        err?.message?.includes("Status 5");

      if (attempt < retries && isNetworkOrServerError) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

export interface ExponentialBackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  jitterMs?: number;
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Determines whether an error is a transient server or network error suitable for exponential retry.
 */
export function isTransientServerError(err: any): boolean {
  const msg = err?.message || String(err || "");
  const isAuthOrClientError =
    msg.includes("401") ||
    msg.includes("400") ||
    msg.includes("403") ||
    msg.includes("404") ||
    msg.includes("Unauthorized") ||
    msg.includes("API Key") ||
    msg.includes("invalid token") ||
    msg.includes("not authenticated");

  if (isAuthOrClientError) {
    return false;
  }

  return (
    err?.name === "TypeError" ||
    msg.includes("Status 5") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("FUNCTION_INVOCATION_FAILED") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError")
  );
}

/**
 * Executes an async operation with exponential backoff and jitter for transient errors.
 */
export async function fetchWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: ExponentialBackoffOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    jitterMs = 200,
    onRetry,
    shouldRetry = isTransientServerError,
  } = options;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && shouldRetry(err)) {
        const backoffDelay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * jitterMs);
        if (onRetry) {
          onRetry(attempt + 1, err, backoffDelay);
        }
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      } else {
        break;
      }
    }
  }

  throw lastError || new Error("Operation failed after exponential backoff retries.");
}

/**
 * Wrapper around safeFetchJson that executes requests with exponential backoff for transient errors.
 */
export async function safeFetchJsonWithBackoff<T = any>(
  url: string,
  options?: RequestInit,
  backoffOptions?: ExponentialBackoffOptions
): Promise<T> {
  return fetchWithExponentialBackoff(
    () => safeFetchJson<T>(url, options, 0), // Disable safeFetchJson internal linear retries
    backoffOptions
  );
}
