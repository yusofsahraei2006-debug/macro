export type FetchErrorKind = 'offline' | 'timeout' | 'http' | 'parse';

export class FetchError extends Error {
  constructor(public kind: FetchErrorKind, message: string, public status?: number) {
    super(message);
  }
}

/** JSON GET with a hard timeout and typed errors the UI can explain. */
export async function getJson<T>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...opts.headers } });
    if (!res.ok) throw new FetchError('http', `Server returned ${res.status}`, res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw new FetchError('parse', 'Unexpected response from server');
    }
  } catch (e) {
    if (e instanceof FetchError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new FetchError('timeout', 'The request timed out');
    throw new FetchError('offline', 'No internet connection');
  } finally {
    clearTimeout(timer);
  }
}
