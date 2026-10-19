import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import type { Page } from '../threads/client.js';
import { MEDIA_FIELDS } from '../threads/fields.js';
import { threadsId } from './post-options.js';
import { fieldsParam, handler, toUnixSeconds } from './util.js';

const dateInput = z.string().describe('ISO 8601 date/time or Unix timestamp');

const listShape = {
  fields: z.array(z.string()).optional().describe(`Fields to return. Default: ${MEDIA_FIELDS.join(', ')}`),
  limit: z.number().int().min(1).max(500).default(25).describe('Maximum number of posts to return'),
  since: dateInput.optional(),
  until: dateInput.optional(),
};

export function registerPostTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    'get_my_threads',
    {
      title: 'List my posts',
      description: 'List your own Threads posts (newest first), including reposts and quote posts.',
      inputSchema: z.object(listShape),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ fields, limit, since, until }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const posts = await client.paginate(
        `/${userId}/threads`,
        {
          fields: fieldsParam(fields, MEDIA_FIELDS),
          limit: Math.min(limit, 100),
          since: toUnixSeconds(since),
          until: toUnixSeconds(until),
        },
        limit,
      );
      return { count: posts.length, posts };
    }),
  );

  server.registerTool(
    'get_thread',
    {
      title: 'Get a post',
      description: 'Get a single Threads post by media ID.',
      inputSchema: z.object({
        thread_id: threadsId.describe('Threads media ID'),
        fields: z.array(z.string()).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id, fields }) => ctx.client().get(`/${thread_id}`, { fields: fieldsParam(fields, MEDIA_FIELDS) })),
  );

  server.registerTool(
    'search_my_threads',
    {
      title: 'Search my posts',
      description: 'Find your own posts whose text contains a phrase (case-insensitive, searched locally).',
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(1000).default(200).describe('How many recent posts to search through'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ query, limit }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const posts = await client.paginate<{ text?: string }>(
        `/${userId}/threads`,
        { fields: 'id,text,media_type,permalink,timestamp,topic_tag', limit: 100 },
        limit,
      );
      const needle = query.toLowerCase();
      const matches = posts.filter((p) => p.text?.toLowerCase().includes(needle));
      return { query, searched: posts.length, count: matches.length, posts: matches };
    }),
  );

  server.registerTool(
    'delete_thread',
    {
      title: 'Delete a post',
      description: 'Permanently delete one of your posts, replies or reposts (needs threads_delete; 100 deletes per 24 hours).',
      inputSchema: z.object({ thread_id: threadsId.describe('Media ID of your post') }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id }) => {
      const res = await ctx.client().delete<{ success?: boolean; deleted_id?: string }>(`/${thread_id}`);
      return { deleted: res.success ?? true, thread_id: res.deleted_id ?? thread_id };
    }),
  );

  server.registerTool(
    'lookup_profile',
    {
      title: 'Look up a public profile',
      description:
        'Look up a public Threads profile (100+ followers) by exact username: bio, follower count, verification and 7-day ' +
        'engagement totals. Needs threads_profile_discovery; without approval only official Meta accounts can be looked up.',
      inputSchema: z.object({ username: z.string().min(1).describe('Username without the @') }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ username }) =>
      ctx.client().get('/profile_lookup', { username: username.replace(/^@/, '') }),
    ),
  );

  server.registerTool(
    'get_profile_posts',
    {
      title: "List a public profile's posts",
      description: "List public posts from another account by username (needs threads_profile_discovery).",
      inputSchema: z.object({
        username: z.string().min(1).describe('Username without the @'),
        ...listShape,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ username, fields, limit, since, until }) => {
      const posts = await ctx.client().paginate(
        '/profile_posts',
        {
          username: username.replace(/^@/, ''),
          fields: fieldsParam(fields, MEDIA_FIELDS),
          limit: Math.min(limit, 100),
          since: toUnixSeconds(since),
          until: toUnixSeconds(until),
        },
        limit,
      );
      return { username, count: posts.length, posts };
    }),
  );

  server.registerTool(
    'get_mentions',
    {
      title: 'List mentions',
      description: 'List public posts that mention you (needs threads_manage_mentions).',
      inputSchema: z.object(listShape),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ fields, limit, since, until }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const posts = await client.paginate(
        `/${userId}/mentions`,
        {
          fields: fieldsParam(fields, MEDIA_FIELDS),
          limit: Math.min(limit, 100),
          since: toUnixSeconds(since),
          until: toUnixSeconds(until),
        },
        limit,
      );
      return { count: posts.length, mentions: posts };
    }),
  );

  server.registerTool(
    'get_ghost_posts',
    {
      title: 'List my ghost posts',
      description: 'List your ghost posts (text posts that disappear after 24 hours).',
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(25) }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ limit }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const page = await client.get<Page<unknown>>(`/${userId}/ghost_posts`, {
        fields: 'id,text,permalink,timestamp,ghost_post_status,ghost_post_expiration_timestamp',
        limit,
      });
      return { count: page.data?.length ?? 0, posts: page.data ?? [] };
    }),
  );

  server.registerTool(
    'get_oembed',
    {
      title: 'Get embed HTML',
      description: 'Get oEmbed HTML to embed a public Threads post on a website (no token needed; 1,000 requests per hour).',
      inputSchema: z.object({
        url: z.url().describe('Permalink of the Threads post, e.g. https://www.threads.com/@user/post/SHORTCODE'),
        maxwidth: z.number().int().min(320).max(658).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ url, maxwidth }) => ctx.publicClient().get('/oembed', { url, maxwidth }, { auth: false })),
  );

  server.registerTool(
    'get_poll_results',
    {
      title: 'Get poll results',
      description: 'Get the options, vote percentages and expiry of a poll post.',
      inputSchema: z.object({ thread_id: threadsId.describe('Media ID of the poll post') }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id }) => {
      const res = await ctx.client().get<{ id: string; text?: string; permalink?: string; poll_attachment?: unknown }>(
        `/${thread_id}`,
        { fields: 'id,text,permalink,poll_attachment' },
      );
      if (!res.poll_attachment) throw new Error(`Post ${thread_id} has no poll`);
      return res;
    }),
  );

  server.registerTool(
    'create_web_intent_link',
    {
      title: 'Create a Threads web intent link',
      description:
        'Build a threads.com link that opens a prefilled post composer or a follow prompt in the browser. Use it for actions ' +
        'the API cannot do, such as following an account, or to hand a draft to a person to post themselves.',
      inputSchema: z.object({
        type: z.enum(['post', 'follow']),
        text: z.string().optional().describe('Prefilled post text (post)'),
        url: z.url().optional().describe('Link to attach (post)'),
        username: z.string().optional().describe('Account to follow, without the @ (follow)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler(async ({ type, text, url, username }) => {
      const link = new URL(`https://www.threads.com/intent/${type}`);
      if (type === 'follow') {
        if (!username) throw new Error('username is required for a follow link');
        link.searchParams.set('username', username.replace(/^@/, ''));
      } else {
        if (text) link.searchParams.set('text', text);
        if (url) link.searchParams.set('url', url);
      }
      return { url: link.toString() };
    }),
  );
}
