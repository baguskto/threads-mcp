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
      return { id: `c${++n}` };
    },
    'GET *': (call) => {
      const id = call.url.pathname.split('/').pop()!;
      if (id.startsWith('c')) return { id, status: 'FINISHED' };
      return { id, permalink: `https://www.threads.com/@me/post/${id}` };
    },
    'POST /123/threads_publish': (call) => ({ id: `m-${param(call, 'creation_id')}` }),
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
  assert.equal(res.json.id, 'm-c1');
  assert.equal(res.json.container_id, 'c1');
  assert.match(res.json.permalink, /threads\.com/);
  const create = calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/threads'))!;
  assert.equal(param(create, 'media_type'), 'TEXT');
  assert.equal(param(create, 'topic_tag'), 'MCP');
  assert.equal(param(create, 'reply_control'), 'followers_only');
  assert.equal(param(create, 'crossreshare_to_ig'), 'true');
  assert.deepEqual(JSON.parse(param(create, 'poll_attachment')!), { option_a: 'Yes', option_b: 'No' });
  const order = calls.map((c) => `${c.method} ${c.url.pathname.replace('/v1.0', '')}`);
  assert.deepEqual(order.slice(0, 3), ['POST /123/threads', 'GET /c1', 'POST /123/threads_publish']);
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
    'POST /123/threads': () => ({ id: 'c1' }),
    'GET /c1': () => ({ id: 'c1', status: 'ERROR', error_message: 'Unsupported video codec' }),
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
  assert.equal(param(creates[3], 'children'), 'c1,c2,c3');
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
  assert.equal(res.json.root_id, 'm-c1');
  assert.equal(param(creates[0], 'reply_to_id'), null);
  assert.equal(param(creates[1], 'reply_to_id'), 'm-c1');
  assert.equal(param(creates[2], 'reply_to_id'), 'm-c2');
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
    'POST /555/repost': () => ({ id: 'r1' }),
    'DELETE /r1': () => ({ success: true, deleted_id: 'r1' }),
    'POST /777/manage_reply': () => ({ success: true }),
  });
  assert.equal((await call('repost_thread', { post_id: '555' })).json.repost_id, 'r1');
  assert.equal((await call('delete_thread', { thread_id: 'r1' })).json.deleted, true);
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
  assert.equal(res.json.container_id, 'c1');
  assert.equal(res.json.published, false);
  assert.ok(!calls.some((c) => c.url.pathname.endsWith('/threads_publish')));
  const published = await call('publish_container', { container_id: 'c1' });
  assert.equal(published.json.id, 'm-c1');
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
  const res = await call('create_thread_chain', { parent_thread_id: 'p0', replies: [{ text: 'a' }, { text: 'b' }] });
  assert.equal(res.isError, true);
  assert.match(res.text, /Resume with parent_thread_id=m-c1/);
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
