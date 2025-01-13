export function timeoutAfterTime(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms} ms.`)), ms));
}

export async function withTimeout<T>(timeoutMs: number, cbk: () => Promise<T>): Promise<T> {
  return Promise.race([cbk(), timeoutAfterTime(timeoutMs)]);
}
