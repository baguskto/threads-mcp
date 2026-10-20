import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from '../src/server.js';
import { ThreadsClient } from '../src/threads/client.js';
import { mockFetch, param, type RecordedCall } from './helpers.js';

type Routes = Parameters<typeof mockFetch>[0];

async function connect(routes: Routes, opts: { token?: string; scheduleFile?: string } = {}) {
  const mock = mockFetch(routes);
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch, sleep: async () => {} });
  const { server } = createServer(
    { accessToken: opts.token ?? 'tok', scheduleFile: opts.scheduleFile },
    { client, publish: { pollIntervalMs: 0 }, scheduler: Boolean(opts.scheduleFile) },
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '1.0.0' });
  await mcp.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res: any = await mcp.callTool({ name, arguments: args });
    const text = res.content?.[0]?.text ?? '';
    return { isError: Boolean(res.isError), text, json: res.isError ? undefined : JSON.parse(text) };
  };
  return { mcp, call, calls: mock.calls };
}

const publishRoutes = (onContainer?: (call: RecordedCall) => void): Routes => {
  let n = 0;
  return {
    'POST /123/threads': (call) => {
      onContainer?.(call);
      return { id: `100${++n}` };
    },
    'GET *': (call) => {
      const id = call.url.pathname.split('/').pop()!;
      if (id.startsWith('100')) return { id, status: 'FINISHED' };
      return { id, permalink: `https://www.threads.com/@me/post/${id}` };
    },
    'POST /123/threads_publish': (call) => ({ id: `9${param(call, 'creation_id')}` }),
  };
};

test('lists tools with titles, schemas and annotations', async () => {
  const { mcp } = await connect({});
  const { tools } = await mcp.listTools();
  const names = tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, 'tool names are unique');
  for (const required of ['publish_thread', 'create_carousel_post', 'search_posts', 'get_thread_insights', 'validate_setup']) {
    assert.ok(names.includes(required), `${required} is registered`);
  }
  // Tools that never existed in the Threads API are gone.
  for (const removed of ['like_post', 'follow_user', 'block_user', 'get_trending_posts', 'get_user_followers']) {
    assert.ok(!names.includes(removed), `${removed} is not registered`);
  }
  const del = tools.find((t) => t.name === 'delete_thread')!;
  assert.equal(del.annotations?.destructiveHint, true);
  const profile = tools.find((t) => t.name === 'get_my_profile')!;
  assert.equal(profile.annotations?.readOnlyHint, true);
  for (const tool of tools) assert.ok(tool.description, `${tool.name} has a description`);
});

test('missing token produces a setup error instead of crashing', async () => {
  const mock = mockFetch({});
  const { server } = createServer({}, { fetch: mock.fetch, scheduler: false });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const mcp = new Client({ name: 't', version: '1' });
  await mcp.connect(a);
  const res: any = await mcp.callTool({ name: 'get_my_profile', arguments: {} });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /THREADS_ACCESS_TOKEN/);
  assert.equal(mock.calls.length, 0);
});

test('publish_thread creates a container, waits for it and publishes', async () => {
  const { call, calls } = await connect(publishRoutes());
  const res = await call('publish_thread', {
    text: 'Hello Threads',
    topic_tag: 'MCP',
    reply_control: 'followers_only',
    poll_options: ['Yes', 'No'],
    share_to_instagram_story: true,
  });
  assert.equal(res.isError, false, res.text);
  assert.equal(res.json.id, '91001');
  assert.equal(res.json.container_id, '1001');
  assert.match(res.json.permalink, /threads\.com/);
  const create = calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/threads'))!;
  assert.equal(param(create, 'media_type'), 'TEXT');
  assert.equal(param(create, 'topic_tag'), 'MCP');
  assert.equal(param(create, 'reply_control'), 'followers_only');
  assert.equal(param(create, 'crossreshare_to_ig'), 'true');
  assert.deepEqual(JSON.parse(param(create, 'poll_attachment')!), { option_a: 'Yes', option_b: 'No' });
  const order = calls.map((c) => `${c.method} ${c.url.pathname.replace('/v1.0', '')}`);
  assert.deepEqual(order.slice(0, 3), ['POST /123/threads', 'GET /1001', 'POST /123/threads_publish']);
});

test('publish_thread maps legacy media_type/media_url and rejects invalid combos', async () => {
  const { call, calls } = await connect(publishRoutes());
  const ok = await call('publish_thread', { text: 'pic', media_type: 'IMAGE', media_url: 'https://example.com/a.jpg' });
  assert.equal(ok.isError, false, ok.text);
  const create = calls.find((c) => c.method === 'POST')!;
  assert.equal(param(create, 'media_type'), 'IMAGE');
  assert.equal(param(create, 'image_url'), 'https://example.com/a.jpg');

  const bad = await call('publish_thread', { text: 'x', image_url: 'https://example.com/a.jpg', poll_options: ['a', 'b'] });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /only be used on text posts/);

  const long = await call('publish_thread', { text: 'x'.repeat(501) });
  assert.equal(long.isError, true);
});

test('publishing surfaces container processing errors', async () => {
  const { call } = await connect({
    'POST /123/threads': () => ({ id: '1001' }),
    'GET /1001': () => ({ id: '1001', status: 'ERROR', error_message: 'Unsupported video codec' }),
  });
  const res = await call('publish_thread', { video_url: 'https://example.com/v.mp4' });
  assert.equal(res.isError, true);
  assert.match(res.text, /Unsupported video codec/);
});

test('create_carousel_post builds item containers then the carousel', async () => {
  const creates: RecordedCall[] = [];
  const { call } = await connect(publishRoutes((c) => creates.push(c)));
  const res = await call('create_carousel_post', {
    text: 'Album',
    items: [
      { url: 'https://example.com/1.jpg', alt_text: 'one' },
      { url: 'https://example.com/2.mp4' },
      { url: 'https://example.com/3.png', type: 'IMAGE' },
    ],
  });
  assert.equal(res.isError, false, res.text);
  assert.equal(res.json.media_count, 3);
  assert.equal(creates.length, 4);
  assert.equal(param(creates[0], 'is_carousel_item'), 'true');
  assert.equal(param(creates[0], 'alt_text'), 'one');
  assert.equal(param(creates[1], 'media_type'), 'VIDEO');
  assert.equal(param(creates[1], 'video_url'), 'https://example.com/2.mp4');
  assert.equal(param(creates[3], 'media_type'), 'CAROUSEL');
  assert.equal(param(creates[3], 'children'), '1001,1002,1003');
});

test('carousel accepts up to 20 items and rejects 21', async () => {
  const { call } = await connect(publishRoutes());
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://example.com/${i}.jpg` }));
  assert.equal((await call('create_carousel_post', { items: items(20) })).isError, false);
  assert.equal((await call('create_carousel_post', { items: items(21) })).isError, true);
});

test('create_thread_chain links each part to the previous one', async () => {
  const creates: RecordedCall[] = [];
  const { call } = await connect(publishRoutes((c) => creates.push(c)));
  const res = await call('create_thread_chain', { replies: [{ text: '1/3' }, { text: '2/3' }, { text: '3/3' }] });
  assert.equal(res.isError, false, res.text);
  assert.equal(res.json.root_id, '91001');
  assert.equal(param(creates[0], 'reply_to_id'), null);
  assert.equal(param(creates[1], 'reply_to_id'), '91001');
  assert.equal(param(creates[2], 'reply_to_id'), '91002');
});

test('quote_post and create_reply send the right ids', async () => {
  const creates: RecordedCall[] = [];
  const { call } = await connect(publishRoutes((c) => creates.push(c)));
  await call('quote_post', { quoted_post_id: '999', text: 'So true' });
  await call('create_reply', { reply_to_id: '888', text: 'Thanks!' });
  assert.equal(param(creates[0], 'quote_post_id'), '999');
  assert.equal(param(creates[1], 'reply_to_id'), '888');
});

test('repost, delete and manage_reply hit the documented endpoints', async () => {
  const { call, calls } = await connect({
    'POST /555/repost': () => ({ id: '777001' }),
    'DELETE /777001': () => ({ success: true, deleted_id: '777001' }),
    'POST /777/manage_reply': () => ({ success: true }),
  });
  assert.equal((await call('repost_thread', { post_id: '555' })).json.repost_id, '777001');
  assert.equal((await call('delete_thread', { thread_id: '777001' })).json.deleted, true);
  assert.equal((await call('manage_reply', { reply_id: '777', hide: true })).json.success, true);
  assert.equal(param(calls[2], 'hide'), 'true');
});

test('search_posts passes keyword search parameters', async () => {
  const { call, calls } = await connect({ 'GET /keyword_search': () => ({ data: [{ id: '1' }] }) });
  const res = await call('search_posts', {
    query: 'mcp',
    search_type: 'RECENT',
    search_mode: 'TAG',
    since: '2026-01-01T00:00:00Z',
    author_username: '@zuck',
  });
  assert.equal(res.json.count, 1);
  assert.equal(param(calls[0], 'q'), 'mcp');
  assert.equal(param(calls[0], 'search_mode'), 'TAG');
  assert.equal(param(calls[0], 'search_type'), 'RECENT');
  assert.equal(param(calls[0], 'author_username'), 'zuck');
  assert.equal(param(calls[0], 'since'), String(Date.parse('2026-01-01T00:00:00Z') / 1000));
});

test('get_thread_insights flattens metric values', async () => {
  const { call } = await connect({
    'GET /42/insights': () => ({
      data: [
        { name: 'views', period: 'lifetime', values: [{ value: 100 }] },
        { name: 'likes', period: 'lifetime', values: [{ value: 7 }] },
      ],
    }),
  });
  const res = await call('get_thread_insights', { thread_id: '42' });
  assert.deepEqual(res.json.metrics, { views: 100, likes: 7 });
});

test('get_content_performance_report ranks posts by engagement', async () => {
  const insights: Record<string, number[]> = { a: [100, 10, 1], b: [50, 20, 5] };
  const { call } = await connect({
    'GET /123/threads': () => ({
      data: [
        { id: 'a', media_type: 'TEXT_POST', timestamp: '2026-10-10T10:00:00+0000' },
        { id: 'b', media_type: 'IMAGE', timestamp: '2026-10-11T10:00:00+0000' },
        { id: 'r', media_type: 'REPOST_FACADE', timestamp: '2026-10-12T10:00:00+0000' },
      ],
    }),
    'GET *': (c) => {
      const id = c.url.pathname.split('/').at(-2)!;
      const [views, likes, replies] = insights[id];
      return {
        data: [
          { name: 'views', values: [{ value: views }] },
          { name: 'likes', values: [{ value: likes }] },
          { name: 'replies', values: [{ value: replies }] },
        ],
      };
    },
  });
  const res = await call('get_content_performance_report', { days: 30 });
  assert.equal(res.isError, false, res.text);
  assert.equal(res.json.posts_analyzed, 2);
  assert.equal(res.json.skipped_reposts, 1);
  assert.equal(res.json.totals.views, 150);
  assert.equal(res.json.top_posts[0].id, 'b');
});

test('schedule_post saves a post that list/cancel can manage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'threads-mcp-'));
  try {
    const { call } = await connect({}, { scheduleFile: join(dir, 's.json') });
    const scheduled = await call('schedule_post', { text: 'Later', publish_at: '2999-01-01T09:00:00+07:00' });
    assert.equal(scheduled.isError, false, scheduled.text);
    assert.equal(scheduled.json.status, 'pending');
    assert.equal((await call('list_scheduled_posts', { status: 'pending' })).json.count, 1);
    assert.equal((await call('cancel_scheduled_post', { id: scheduled.json.id })).json.status, 'cancelled');
    const past = await call('schedule_post', { text: 'Past', publish_at: '2000-01-01T00:00:00Z' });
    assert.equal(past.isError, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('API errors are returned as tool errors with hints', async () => {
  const { call } = await connect({
    'GET /me': () =>
      Response.json({ error: { message: 'Error validating access token', code: 190, type: 'OAuthException' } }, { status: 400 }),
  });
  const res = await call('get_my_profile');
  assert.equal(res.isError, true);
  assert.match(res.text, /access token/);
});

test('text extras are encoded the way the API expects', async () => {
  const creates: RecordedCall[] = [];
  const { call } = await connect(publishRoutes((c) => creates.push(c)));
  const res = await call('publish_thread', {
    text: 'Spoiler: it ends well',
    spoilers: [{ offset: 9, length: 12 }],
    gif_id: 'abc123',
    link_attachment: 'https://example.com',
  });
  assert.equal(res.isError, false, res.text);
  assert.deepEqual(JSON.parse(param(creates[0], 'gif_attachment')!), { gif_id: 'abc123', provider: 'GIPHY' });
  assert.deepEqual(JSON.parse(param(creates[0], 'text_entities')!), [{ entity_type: 'SPOILER', offset: 9, length: 12 }]);
  assert.equal(param(creates[0], 'link_attachment'), 'https://example.com');

  await call('publish_thread', {
    text: 'Long read below',
    text_attachment: { plaintext: 'Body', styling: [{ offset: 0, length: 4, styles: ['bold'] }] },
  });
  assert.deepEqual(JSON.parse(param(creates[1], 'text_attachment')!), {
    plaintext: 'Body',
    text_with_styling_info: [{ offset: 0, length: 4, styling_info: ['bold'] }],
  });
});

test('rejects combinations the Threads API does not allow', async () => {
  const { call, calls } = await connect(publishRoutes());
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ text: 'x', poll_options: ['a', 'b'], link_attachment: 'https://example.com' }, /poll cannot be combined/],
    [{ text: 'x', is_ghost_post: true, enable_reply_approvals: true }, /Ghost posts/],
    [{ text: Array.from({ length: 6 }, (_, i) => `https://e.com/${i}`).join(' ') }, /at most 5 links/],
    [{ text: '😀'.repeat(126) }, /limit is 500/],
    [{ image_url: 'https://e.com/a.jpg', video_url: 'https://e.com/a.mp4' }, /either image_url or video_url/],
    [{}, /needs text/],
  ];
  for (const [args, pattern] of cases) {
    const res = await call('publish_thread', args);
    assert.equal(res.isError, true, JSON.stringify(args));
    assert.match(res.text, pattern);
  }
  const ghostReply = await call('create_reply', { reply_to_id: '1', text: 'x', is_ghost_post: true });
  assert.match(ghostReply.text, /Ghost posts/);
  assert.equal(calls.length, 0, 'nothing is sent for invalid input');
  // 125 emoji = exactly 500 as Threads counts them.
  assert.equal((await call('publish_thread', { text: '😀'.repeat(125) })).isError, false);
});

test('publish: false stages a container without publishing', async () => {
  const { call, calls } = await connect(publishRoutes());
  const res = await call('publish_thread', { text: 'Draft', publish: false });
  assert.equal(res.json.container_id, '1001');
  assert.equal(res.json.published, false);
  assert.ok(!calls.some((c) => c.url.pathname.endsWith('/threads_publish')));
  const published = await call('publish_container', { container_id: '1001' });
  assert.equal(published.json.id, '91001');
});

test('create_thread_chain validates every part before publishing', async () => {
  const { call, calls } = await connect(publishRoutes());
  const res = await call('create_thread_chain', { replies: [{ text: 'ok' }, { text: 'x'.repeat(10) + '😀'.repeat(124) }] });
  assert.equal(res.isError, true);
  assert.match(res.text, /Part 2/);
  assert.equal(calls.length, 0);
});

test('create_thread_chain reports where to resume after a failure', async () => {
  let n = 0;
  const routes = publishRoutes();
  const { call } = await connect({
    ...routes,
    'POST /123/threads': (c) => (++n === 2 ? Response.json({ error: { message: 'Boom', code: 1 } }, { status: 400 }) : routes['POST /123/threads'](c)),
  });
  const res = await call('create_thread_chain', { parent_thread_id: '500', replies: [{ text: 'a' }, { text: 'b' }] });
  assert.equal(res.isError, true);
  assert.match(res.text, /resume with parent_thread_id=91001 and parts 2–2/);
});

test('read-only mode only exposes read tools and no scheduler', async () => {
  const mock = mockFetch({});
  const { server, scheduler } = createServer({ accessToken: 'tok', readOnly: true }, { fetch: mock.fetch });
  assert.equal(scheduler, undefined);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const mcp = new Client({ name: 't', version: '1' });
  await mcp.connect(a);
  const { tools } = await mcp.listTools();
  assert.ok(tools.length > 10);
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
  assert.ok(!tools.some((t) => t.name === 'publish_thread'));
});

test('get_oembed is called without the access token', async () => {
  const { call, calls } = await connect({ 'GET /oembed': () => ({ html: '<blockquote></blockquote>' }) });
  const res = await call('get_oembed', { url: 'https://www.threads.com/@zuck/post/abc' });
  assert.equal(res.json.html, '<blockquote></blockquote>');
  assert.equal(param(calls[0], 'access_token'), null);
});

test('get_my_insights fetches followers_count without a date range', async () => {
  const { call, calls } = await connect({
    'GET /123/threads_insights': (c) =>
      param(c, 'metric') === 'followers_count'
        ? { data: [{ name: 'followers_count', total_value: { value: 321 } }] }
        : {
            data: [
              { name: 'views', values: [{ value: 5, end_time: 'd1' }, { value: 7, end_time: 'd2' }] },
              { name: 'clicks', link_total_values: [{ value: 3, link_url: 'https://a' }, { value: 2, link_url: 'https://b' }] },
            ],
          },
  });
  const res = await call('get_my_insights', {});
  assert.equal(res.isError, false, res.text);
  assert.deepEqual(res.json.totals, { views: 12, clicks: 5, followers_count: 321 });
  const followers = calls.find((c) => param(c, 'metric') === 'followers_count')!;
  assert.equal(param(followers, 'since'), null);
  const ranged = calls.find((c) => param(c, 'metric') !== 'followers_count')!;
  assert.ok(Number(param(ranged, 'since')) >= 1712991600);
});

test('reply listing defaults to newest first', async () => {
  const { call, calls } = await connect({ 'GET /9/replies': () => ({ data: [] }) });
  await call('get_thread_replies', { thread_id: '9' });
  await call('get_thread_replies', { thread_id: '9', oldest_first: true });
  assert.equal(param(calls[0], 'reverse'), 'true');
  assert.equal(param(calls[1], 'reverse'), 'false');
});

test('create_web_intent_link builds follow and post links', async () => {
  const { call } = await connect({});
  assert.equal((await call('create_web_intent_link', { type: 'follow', username: '@zuck' })).json.url, 'https://www.threads.com/intent/follow?username=zuck');
  const post = await call('create_web_intent_link', { type: 'post', text: 'Hi there', url: 'https://example.com' });
  assert.equal(post.json.url, 'https://www.threads.com/intent/post?text=Hi+there&url=https%3A%2F%2Fexample.com');
});

// Regression tests for issues found in the pre-merge review.

test('spoilers are sent on image posts and carousels, not only text posts', async () => {
  const creates: RecordedCall[] = [];
  const { call } = await connect(publishRoutes((c) => creates.push(c)));
  await call('publish_thread', { text: 'Spoiler: it ends well', image_url: 'https://e.com/a.jpg', spoilers: [{ offset: 9, length: 12 }] });
  assert.equal(param(creates[0], 'media_type'), 'IMAGE');
  assert.deepEqual(JSON.parse(param(creates[0], 'text_entities')!), [{ entity_type: 'SPOILER', offset: 9, length: 12 }]);
  await call('create_carousel_post', {
    text: 'Big reveal',
    spoilers: [{ offset: 4, length: 6 }],
    items: [{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }],
  });
  const carousel = creates.find((c) => param(c, 'media_type') === 'CAROUSEL')!;
  assert.deepEqual(JSON.parse(param(carousel, 'text_entities')!), [{ entity_type: 'SPOILER', offset: 4, length: 6 }]);
});

test('get_publishing_limit still returns post/reply quotas when optional scopes are missing', async () => {
  const { call, calls } = await connect({
    'GET /123/threads_publishing_limit': (c) =>
      param(c, 'fields')!.startsWith('quota_usage')
        ? { data: [{ quota_usage: 3, config: { quota_total: 250 }, reply_quota_usage: 1 }] }
        : Response.json({ error: { message: 'Unsupported request' } }, { status: 500 }),
  });
  const res = await call('get_publishing_limit');
  assert.equal(res.isError, false, res.text);
  assert.equal(res.json.quota_usage, 3);
  assert.equal(res.json.unavailable.length, 2);
  assert.equal(calls.length, 3, 'optional quota requests are not retried');
});

test('emoji sequences count as their full UTF-8 length', async () => {
  const { threadsTextLength, countLinks } = await import('../src/tools/post-options.js');
  assert.equal(threadsTextLength('abc'), 3);
  assert.equal(threadsTextLength('❤️'), 6); // U+2764 + VS16
  assert.equal(threadsTextLength('🇮🇩'), 8); // regional-indicator flag
  assert.equal(threadsTextLength('👨‍👩‍👧'), 18); // ZWJ family
  assert.equal(threadsTextLength('1️⃣'), 7); // keycap
  assert.equal(threadsTextLength('é'), 1);
  assert.equal(countLinks('see www.a.com and https://a.com/ plus http://www.b.org/x.'), 2);
  assert.equal(countLinks('https://a.com', 'https://www.a.com/'), 1);
});

test('rejects posts over the limit because of multi-code-point emoji, and www links over the limit', async () => {
  const { call, calls } = await connect(publishRoutes());
  const over = await call('publish_thread', { text: 'a'.repeat(450) + '❤️'.repeat(10) });
  assert.match(over.text, /limit is 500/);
  const links = await call('publish_thread', { text: 'www.a.com www.b.com www.c.com www.d.com www.e.com www.f.com' });
  assert.match(links.text, /at most 5 links/);
  assert.equal(calls.length, 0);
});

test('THREADS_API_BASE_URL must be https (or localhost)', async () => {
  const { loadConfig } = await import('../src/config.js');
  assert.throws(() => loadConfig({ THREADS_API_BASE_URL: 'http://attacker.example' }), /https/);
  assert.equal(loadConfig({ THREADS_API_BASE_URL: 'https://graph.threads.net/v1.0' }).apiVersion, 'v1.0');
  assert.equal(loadConfig({ THREADS_API_BASE_URL: 'http://localhost:8080' }).baseUrl, 'http://localhost:8080');
});

test('media still processing after the wait budget is returned as a pending container', async () => {
  const mock = mockFetch({
    'POST /123/threads': () => ({ id: '1001' }),
    'GET /1001': () => ({ id: '1001', status: 'IN_PROGRESS' }),
  });
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch, sleep: async () => {} });
  const { server } = createServer({ accessToken: 'tok' }, { client, publish: { pollIntervalMs: 0, timeoutMs: 0 }, scheduler: false });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const mcp = new Client({ name: 't', version: '1' });
  await mcp.connect(a);
  const res: any = await mcp.callTool({ name: 'publish_thread', arguments: { video_url: 'https://e.com/v.mp4' } });
  assert.notEqual(res.isError, true, res.content[0].text);
  const body = JSON.parse(res.content[0].text);
  assert.deepEqual([body.container_id, body.published, body.status], ['1001', false, 'IN_PROGRESS']);
  assert.ok(!mock.calls.some((c) => c.url.pathname.endsWith('/threads_publish')));
});

test('a cancelled request never publishes', async () => {
  const { publishContainer } = await import('../src/threads/publish.js');
  const controller = new AbortController();
  const mock = mockFetch({
    'GET /1001': () => {
      controller.abort();
      return { id: '1001', status: 'IN_PROGRESS' };
    },
  });
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch });
  await assert.rejects(publishContainer(client, '1001', { signal: controller.signal, pollIntervalMs: 5 }), /Cancelled before publishing/);
  assert.ok(!mock.calls.some((c) => c.method === 'POST'));
});

test('a failed publish step reports the container id', async () => {
  const { call } = await connect({
    'POST /123/threads': () => ({ id: '1001' }),
    'GET /1001': () => ({ id: '1001', status: 'FINISHED' }),
    'POST /123/threads_publish': () => Response.json({ error: { message: 'Service unavailable', code: 2 } }, { status: 503 }),
  });
  const res = await call('publish_thread', { text: 'hello' });
  assert.equal(res.isError, true);
  assert.match(res.text, /container 1001/);
  assert.match(res.text, /get_container_status/);
});

test('IDs are validated before they reach a URL path', async () => {
  const { call, calls } = await connect({ 'GET *': () => ({ access_token: 'leaked' }) });
  for (const bad of ['../refresh_access_token', '123?x=1', '%2e%2e', '123/../me']) {
    const res = await call('get_thread', { thread_id: bad });
    assert.equal(res.isError, true, bad);
  }
  assert.equal(calls.length, 0);
  const client = new ThreadsClient({ accessToken: 't' });
  await assert.rejects(client.get('/123/../refresh_access_token'), /Invalid API path/);
  await assert.rejects(client.get('https://evil.example/x'), /Refusing to follow/);
});

test('get_oembed works without an access token', async () => {
  const mock = mockFetch({ 'GET /oembed': () => ({ html: '<blockquote/>' }) });
  const { server } = createServer({}, { fetch: mock.fetch, scheduler: false });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const mcp = new Client({ name: 't', version: '1' });
  await mcp.connect(a);
  const res: any = await mcp.callTool({ name: 'get_oembed', arguments: { url: 'https://www.threads.com/@zuck/post/abc' } });
  assert.notEqual(res.isError, true, res.content[0].text);
  assert.equal(param(mock.calls[0], 'access_token'), null);
});

test('schedule_post keeps reply/quote targets for carousels and rejects single-post fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'threads-mcp-'));
  try {
    const { call } = await connect({}, { scheduleFile: join(dir, 's.json') });
    const items = [{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }];
    const ok = await call('schedule_post', { publish_at: '2999-01-01T09:00:00+07:00', carousel_items: items, reply_to_id: '42' });
    assert.equal(ok.isError, false, ok.text);
    assert.equal(ok.json.payload.input.reply_to_id, '42');
    const bad = await call('schedule_post', { publish_at: '2999-01-01T09:00:00Z', carousel_items: items, poll_options: ['a', 'b'] });
    assert.match(bad.text, /poll_options cannot be used with carousel_items/);
    const naive = await call('schedule_post', { publish_at: '2999-01-01T09:00:00', text: 'x' });
    assert.equal(naive.isError, true);
    assert.match(naive.text, /timezone offset/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a scheduled carousel reply is published with reply_to_id', async () => {
  const { publishScheduled } = await import('../src/tools/publishing.js');
  const creates: RecordedCall[] = [];
  const mock = mockFetch(publishRoutes((c) => creates.push(c)));
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch, sleep: async () => {} });
  const ctx: any = { client: () => client, publish: { pollIntervalMs: 0 } };
  await publishScheduled(ctx, {
    kind: 'carousel',
    input: { items: [{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }], reply_to_id: '42' },
  });
  const carousel = creates.find((c) => param(c, 'media_type') === 'CAROUSEL')!;
  assert.equal(param(carousel, 'reply_to_id'), '42');
});

// Regression tests for the second review round.

async function connectWith(routes: Routes, publish: { pollIntervalMs?: number; timeoutMs?: number; stopBy?: number }) {
  const mock = mockFetch(routes);
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch, sleep: async () => {} });
  const { server } = createServer({ accessToken: 'tok' }, { client, publish, scheduler: false });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const mcp = new Client({ name: 't', version: '1' });
  await mcp.connect(a);
  return { mcp, calls: mock.calls };
}

test('a thread chain stops with a resumable result once the call budget is used up', async () => {
  const creates: RecordedCall[] = [];
  // stopBy in the past: the budget is already used up after the first part.
  const { mcp } = await connectWith(publishRoutes((c) => creates.push(c)), { pollIntervalMs: 0, stopBy: 0 });
  const res: any = await mcp.callTool({ name: 'create_thread_chain', arguments: { replies: [{ text: '1' }, { text: '2' }, { text: '3' }] } });
  assert.notEqual(res.isError, true, res.content[0].text);
  const body = JSON.parse(res.content[0].text);
  assert.equal(body.completed, false);
  assert.equal(body.count, 1);
  assert.equal(body.resume.parent_thread_id, '91001');
  assert.equal(body.resume.remaining_parts, '2–3');
  assert.equal(creates.length, 1, 'no container is created after the budget runs out');
});

test('a thread chain part that is still processing is returned as pending, not as an error', async () => {
  const { mcp } = await connectWith(
    {
      'POST /123/threads': () => ({ id: '1001' }),
      'GET /1001': () => ({ id: '1001', status: 'IN_PROGRESS' }),
    },
    { pollIntervalMs: 0, timeoutMs: 0 },
  );
  const res: any = await mcp.callTool({
    name: 'create_thread_chain',
    arguments: { parent_thread_id: '500', replies: [{ text: 'a', video_url: 'https://e.com/v.mp4' }] },
  });
  assert.notEqual(res.isError, true, res.content[0].text);
  const body = JSON.parse(res.content[0].text);
  assert.deepEqual([body.completed, body.pending_container_id, body.resume.remaining_parts], [false, '1001', 'none']);
});

test('a carousel shares one wait budget and explains what to do when items are slow', async () => {
  const { mcp, calls } = await connectWith(
    {
      'POST /123/threads': () => ({ id: `100${calls.filter((c) => c.method === 'POST').length}` }),
      'GET *': (c) => ({ id: c.url.pathname.split('/').pop(), status: 'IN_PROGRESS' }),
    },
    { pollIntervalMs: 0, timeoutMs: 0 },
  );
  const res: any = await mcp.callTool({
    name: 'create_carousel_post',
    arguments: { items: [{ url: 'https://e.com/1.mp4' }, { url: 'https://e.com/2.mp4' }] },
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /THREADS_PUBLISH_WAIT_SECONDS|schedule_post/);
  assert.doesNotMatch(res.content[0].text, /Try again/);
  assert.ok(!calls.some((c) => c.url.pathname.endsWith('/threads_publish')));
});

test('a scheduled carousel that is still processing fails instead of being recorded as published', async () => {
  const { publishScheduled } = await import('../src/tools/publishing.js');
  let n = 0;
  const mock = mockFetch({
    'POST /123/threads': () => ({ id: `100${++n}` }),
    'GET *': (c) => {
      const id = c.url.pathname.split('/').pop();
      return { id, status: id === '1003' ? 'IN_PROGRESS' : 'FINISHED' };
    },
  });
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch, sleep: async () => {} });
  const ctx: any = { client: () => client, publish: { pollIntervalMs: 0, timeoutMs: 0 } };
  await assert.rejects(
    publishScheduled(ctx, { kind: 'carousel', input: { items: [{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }] } }),
    /still processing/,
  );
  assert.ok(!mock.calls.some((c) => c.url.pathname.endsWith('/threads_publish')));
});

test('progress notifications increase across all containers in one call', async () => {
  const polls = new Map<string, number>();
  const { mcp } = await connectWith(
    {
      'POST /123/threads': () => ({ id: `100${polls.size + 1}` }),
      'GET *': (c) => {
        const id = c.url.pathname.split('/').pop()!;
        if (!id.startsWith('100')) return { id };
        const seen = (polls.get(id) ?? 0) + 1;
        polls.set(id, seen);
        return { id, status: seen < 3 ? 'IN_PROGRESS' : 'FINISHED' };
      },
      'POST /123/threads_publish': (c) => ({ id: `9${param(c, 'creation_id')}` }),
    },
    { pollIntervalMs: 0 },
  );
  const progress: number[] = [];
  const res: any = await mcp.callTool(
    { name: 'create_carousel_post', arguments: { items: [{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }] } },
    { onprogress: (p: any) => progress.push(p.progress) },
  );
  assert.notEqual(res.isError, true, res.content[0].text);
  assert.ok(progress.length >= 4, `got ${progress.length} progress notifications`);
  for (let i = 1; i < progress.length; i++) assert.ok(progress[i] > progress[i - 1], `progress ${progress} increases`);
});

test('link counting ignores "www." inside words and keeps paths case-sensitive', async () => {
  const { countLinks } = await import('../src/tools/post-options.js');
  assert.equal(countLinks('Awww.... so cute'), 0);
  assert.equal(countLinks('https://example.com/A https://EXAMPLE.com/a'), 2);
  assert.equal(countLinks('https://Example.com/a https://example.com/a/'), 1);
});

test('text with combining marks is limited by Threads length, not code points', async () => {
  const { call } = await connect(publishRoutes());
  const thai = 'ที่'.repeat(200); // 200 graphemes, 600 code points
  const res = await call('publish_thread', { text: thai });
  assert.equal(res.isError, false, res.text);
});

test('THREADS_PUBLISH_WAIT_SECONDS accepts 0 and rejects negative values', async () => {
  const { loadConfig } = await import('../src/config.js');
  assert.equal(loadConfig({ THREADS_PUBLISH_WAIT_SECONDS: '0' }).publishWaitSeconds, 0);
  assert.equal(loadConfig({ THREADS_PUBLISH_WAIT_SECONDS: '90' }).publishWaitSeconds, 90);
  assert.equal(loadConfig({}).publishWaitSeconds, undefined);
  assert.throws(() => loadConfig({ THREADS_PUBLISH_WAIT_SECONDS: '-5' }), /seconds/);
});

test('get_publishing_limit tells permission errors apart from other failures', async () => {
  const { call } = await connect({
    'GET /123/threads_publishing_limit': (c) => {
      const fields = param(c, 'fields')!;
      if (fields.startsWith('quota_usage')) return { data: [{ quota_usage: 1 }] };
      if (fields.startsWith('delete')) return Response.json({ error: { message: 'Missing permission', code: 10 } }, { status: 403 });
      return Response.json({ error: { message: 'Please retry', code: 2, is_transient: true } }, { status: 503 });
    },
  });
  const res = await call('get_publishing_limit');
  assert.equal(res.json.unavailable[0], 'delete_quota_usage, delete_config: needs threads_delete');
  assert.match(res.json.unavailable[1], /Please retry/);
});

test('pagination behind a proxy base URL follows Graph next links through the proxy', async () => {
  const mock = mockFetch({
    'GET /threads-proxy/v1.0/123/threads': (c) =>
      c.url.searchParams.get('after') === 'p2'
        ? { data: [{ id: '3' }] }
        : { data: [{ id: '1' }, { id: '2' }], paging: { next: 'https://graph.threads.net/v1.0/123/threads?after=p2' } },
  });
  const client = new ThreadsClient({
    accessToken: 'tok',
    userId: '123',
    baseUrl: 'https://proxy.example.com/threads-proxy',
    fetch: mock.fetch,
  });
  const items = await client.paginate<{ id: string }>('/123/threads', {}, 10);
  assert.deepEqual(items.map((i) => i.id), ['1', '2', '3']);
  assert.ok(mock.calls.every((c) => c.url.origin === 'https://proxy.example.com'));
});

test('a short media wait does not cut a text-only thread chain short', async () => {
  const { mcp } = await connectWith(publishRoutes(), { pollIntervalMs: 0, timeoutMs: 0 });
  const res: any = await mcp.callTool({
    name: 'create_thread_chain',
    arguments: { replies: [{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }] },
  });
  const body = JSON.parse(res.content[0].text);
  assert.deepEqual([body.completed, body.count], [true, 4]);
});

test('a cancel during the last carousel item stops polling and creates no carousel container', async () => {
  const controller = new AbortController();
  let posts = 0;
  const { mcp, calls } = await connectWith(
    {
      'POST /123/threads': async () => {
        posts++;
        if (posts === 2) controller.abort(); // cancel while the last item container is being created
        return { id: `100${posts}` };
      },
      'GET *': (c) => ({ id: c.url.pathname.split('/').pop(), status: 'FINISHED' }),
    },
    { pollIntervalMs: 0 },
  );
  await assert.rejects(
    mcp.callTool(
      { name: 'create_carousel_post', arguments: { items: [{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }] } },
      { signal: controller.signal },
    ),
  );
  await new Promise((r) => setTimeout(r, 50));
  const carousel = calls.filter((c) => c.method === 'POST' && c.body?.get('media_type') === 'CAROUSEL');
  assert.equal(carousel.length, 0, 'no carousel container after cancel');
  assert.ok(!calls.some((c) => c.url.pathname.endsWith('/threads_publish')));
});

test('waiting uses the whole budget instead of giving up a poll interval early', async () => {
  const { waitForContainer } = await import('../src/threads/publish.js');
  const readyAt = Date.now() + 250;
  const mock = mockFetch({ 'GET /1001': () => ({ id: '1001', status: Date.now() >= readyAt ? 'FINISHED' : 'IN_PROGRESS' }) });
  const client = new ThreadsClient({ accessToken: 'tok', userId: '123', fetch: mock.fetch });
  // Poll interval (10 s) is far longer than the budget; the final sleep must be clamped to the deadline.
  const status = await waitForContainer(client, '1001', { pollIntervalMs: 10_000, deadline: Date.now() + 400 });
  assert.equal(status, 'FINISHED');
});

test('text chain parts that need a second status check still complete under a short media wait', async () => {
  const checks = new Map<string, number>();
  let n = 0;
  const { mcp } = await connectWith(
    {
      'POST /123/threads': () => ({ id: `100${++n}` }),
      'GET *': (c) => {
        const id = c.url.pathname.split('/').pop()!;
        if (!id.startsWith('100')) return { id };
        const seen = (checks.get(id) ?? 0) + 1;
        checks.set(id, seen);
        return { id, status: seen < 2 ? 'IN_PROGRESS' : 'FINISHED' };
      },
      'POST /123/threads_publish': (c) => ({ id: `9${param(c, 'creation_id')}` }),
    },
    { pollIntervalMs: 0, timeoutMs: 0 },
  );
  const res: any = await mcp.callTool({
    name: 'create_thread_chain',
    arguments: { replies: [{ text: '1' }, { text: '2' }, { text: '3' }] },
  });
  const body = JSON.parse(res.content[0].text);
  assert.deepEqual([body.completed, body.count], [true, 3]);
});
