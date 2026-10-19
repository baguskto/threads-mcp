import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThreadsClient, encodeParams } from '../src/threads/client.js';
import { ThreadsApiError } from '../src/threads/errors.js';
import { mockFetch, param, testClient } from './helpers.js';

test('GET sends the token and params in the query string', async () => {
  const { client, calls } = testClient({ 'GET /me': () => ({ id: '42', username: 'me' }) });
  const me = await client.get<{ id: string }>('/me', { fields: ['id', 'username'] });
  assert.equal(me.id, '42');
  assert.equal(calls[0].url.origin + calls[0].url.pathname, 'https://graph.threads.net/v1.0/me');
  assert.equal(param(calls[0], 'access_token'), 'test-token');
  assert.equal(param(calls[0], 'fields'), 'id,username');
});

test('POST sends a form body and JSON-encodes object params', async () => {
  const { client, calls } = testClient({ 'POST /123/threads': () => ({ id: 'c1' }) });
  await client.post('/123/threads', { media_type: 'TEXT', poll_attachment: { option_a: 'Yes', option_b: 'No' } });
  assert.equal(calls[0].url.search, '');
  assert.equal(param(calls[0], 'access_token'), 'test-token');
  assert.deepEqual(JSON.parse(param(calls[0], 'poll_attachment')!), { option_a: 'Yes', option_b: 'No' });
});

test('getUserId looks up /me once and caches it', async () => {
  const mock = mockFetch({ 'GET /me': () => ({ id: '777' }) });
  const client = new ThreadsClient({ accessToken: 't', fetch: mock.fetch });
  assert.equal(await client.getUserId(), '777');
  assert.equal(await client.getUserId(), '777');
  assert.equal(mock.calls.length, 1);
});

test('transient GET failures are retried', async () => {
  let n = 0;
  const { client, calls } = testClient({
    'GET /me': () =>
      ++n < 3
        ? Response.json({ error: { message: 'Please retry', code: 2, is_transient: true } }, { status: 500 })
        : { id: 'ok' },
  });
  assert.deepEqual(await client.get('/me'), { id: 'ok' });
  assert.equal(calls.length, 3);
});

test('POST is never retried', async () => {
  const { client, calls } = testClient({
    'POST /123/threads_publish': () => Response.json({ error: { message: 'boom', code: 2 } }, { status: 500 }),
  });
  await assert.rejects(client.post('/123/threads_publish', { creation_id: '1' }), ThreadsApiError);
  assert.equal(calls.length, 1);
});

test('Graph errors become ThreadsApiError with a hint', async () => {
  const { client } = testClient({
    'GET /me': () =>
      Response.json({ error: { message: 'Invalid OAuth access token', code: 190, fbtrace_id: 'abc' } }, { status: 400 }),
  });
  await assert.rejects(client.get('/me'), (error: unknown) => {
    assert.ok(error instanceof ThreadsApiError);
    assert.equal(error.code, 190);
    assert.equal(error.fbtraceId, 'abc');
    assert.match(error.message, /refresh_access_token/);
    return true;
  });
});

test('paginate follows paging.next up to maxItems', async () => {
  const { client, calls } = testClient({
    'GET /123/threads': (call) =>
      call.url.searchParams.get('after') === 'p2'
        ? { data: [{ id: '3' }, { id: '4' }], paging: { next: 'https://graph.threads.net/v1.0/123/threads?after=p3' } }
        : { data: [{ id: '1' }, { id: '2' }], paging: { next: 'https://graph.threads.net/v1.0/123/threads?after=p2' } },
  });
  const items = await client.paginate<{ id: string }>('/123/threads', { limit: 2 }, 3);
  assert.deepEqual(items.map((i) => i.id), ['1', '2', '3']);
  assert.equal(calls.length, 2);
  assert.equal(param(calls[1], 'access_token'), 'test-token');
});

test('encodeParams drops empty values and joins arrays', () => {
  const params = encodeParams({ a: undefined, b: null, c: [], d: ['x', 'y'], e: false, f: 0 });
  assert.equal(params.toString(), 'd=x%2Cy&e=false&f=0');
});

test('absolute links must stay on the configured host and path', async () => {
  const { client } = testClient({});
  await assert.rejects(client.get('https://graph.threads.net.evil.com/v1.0/me'), /Refusing to follow/);
  await assert.rejects(client.get('http://graph.threads.net/v1.0/me'), /Refusing to follow/);
  const proxied = new ThreadsClient({ accessToken: 't', baseUrl: 'https://proxy.example.com/threads' });
  await assert.rejects(proxied.get('https://proxy.example.com/threadsX/v1.0/me'), /Refusing to follow/);
});
