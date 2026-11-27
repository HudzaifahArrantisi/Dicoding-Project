const transientDatabaseCodes = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "EAI_AGAIN", "ENOTFOUND",
  "CONNECTION_CLOSED", "CONNECT_TIMEOUT", "CONNECTION_DESTROYED", "53300", "57P01", "57P02", "57P03",
  "08000", "08001", "08003", "08004", "08006",
]);

export function isTransientDatabaseError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const issue = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof issue.code === "string" && transientDatabaseCodes.has(issue.code)) return true;
    if (typeof issue.message === "string" && /(?:CONNECTION_CLOSED|CONNECT_TIMEOUT|ECONNRESET|EPIPE|Connection terminated)/i.test(issue.message)) {
      return true;
    }
    current = issue.cause;
  }
  return false;
}

export async function retryTransientRead<T>(read: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === maxRetries) {
        const direct = error as {
          code?: string;
          name?: string;
          message?: string;
          cause?: { code?: string; name?: string; message?: string; cause?: { code?: string; name?: string; message?: string } };
        };
        const cause = direct?.cause;
        const root = cause?.cause ?? cause ?? direct;
        console.error("[DB READ] gagal", {
          code: root?.code ?? direct?.code,
          name: root?.name ?? direct?.name,
          message: (root?.message ?? direct?.message)?.replace(/(?:postgres(?:ql)?:\/\/|password=)\S+/gi, "[redacted]").slice(0, 160),
          attempt,
        });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}
