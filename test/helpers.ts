import { ThreadsClient } from '../src/threads/client.js';

export interface RecordedCall {
  method: string;
  url: URL;
  body: URLSearchParams | undefined;
}

type Responder = (call: RecordedCall) => unknown | Response | Promise<unknown | Response>;

/**
 * A fetch stand-in that records each request and answers it with the first
 * matching route. Routes are matched on "METHOD /path" (path without version).
 */
export function mockFetch(routes: Record<string, Responder>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body instanceof URLSearchParams ? init.body : undefined;
    const call = { method, url, body };
    calls.push(call);
    const path = url.pathname.replace(/^\/v\d+\.\d+/, '');
    const responder = routes[`${method} ${path}`] ?? routes[`${method} *`];
    if (!responder) {
      return Response.json({ error: { message: `No mock for ${method} ${path}`, code: 100 } }, { status: 400 });
    }
    const value = await responder(call);
    return value instanceof Response ? value : Response.json(value);
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

export function param(call: RecordedCall, key: string): string | null {
  return call.body?.get(key) ?? call.url.searchParams.get(key);
}

export function testClient(routes: Record<string, Responder>, userId = '123') {
  const mock = mockFetch(routes);
  const client = new ThreadsClient({
    accessToken: 'test-token',
    userId,
    fetch: mock.fetch,
    sleep: async () => {},
  });
  return { client, ...mock };
}
