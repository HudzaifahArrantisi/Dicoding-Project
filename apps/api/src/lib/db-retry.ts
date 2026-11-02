const transientDatabaseCodes = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "EAI_AGAIN", "ENOTFOUND",
  "CONNECTION_CLOSED", "CONNECT_TIMEOUT", "53300", "57P01", "57P02", "57P03",
  "08000", "08001", "08003", "08004", "08006",
]);

export function isTransientDatabaseError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const issue = current as { code?: unknown; cause?: unknown };
    if (typeof issue.code === "string" && transientDatabaseCodes.has(issue.code)) return true;
    current = issue.cause;
  }
  return false;
}

export async function retryTransientRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return read();
  }
}
