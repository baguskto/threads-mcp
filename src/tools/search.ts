import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import type { Page } from '../threads/client.js';
import { MEDIA_FIELDS } from '../threads/fields.js';
import { threadsId } from './post-options.js';
import { fieldsParam, handler, toUnixSeconds } from './util.js';

export function registerSearchTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    'search_posts',
    {
      title: 'Search public posts',
      description:
        'Search public Threads posts by keyword or topic tag. Without threads_keyword_search approval only your own posts are ' +
        'returned. Limited to 2,200 queries per 24 hours.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Keyword, or a topic tag when search_mode is TAG'),
        search_type: z.enum(['TOP', 'RECENT']).default('TOP'),
        search_mode: z.enum(['KEYWORD', 'TAG']).default('KEYWORD').describe('TAG searches posts with that topic tag'),
        media_type: z.enum(['TEXT', 'IMAGE', 'VIDEO']).optional(),
        author_username: z.string().optional().describe('Only posts by this username'),
        since: z.string().optional().describe('ISO 8601 date/time or Unix timestamp'),
        until: z.string().optional().describe('ISO 8601 date/time or Unix timestamp'),
        limit: z.number().int().min(1).max(100).default(25),
        fields: z.array(z.string()).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ query, search_type, search_mode, media_type, author_username, since, until, limit, fields }) => {
      const page = await ctx.client().get<Page<unknown>>('/keyword_search', {
        q: query,
        search_type,
        search_mode,
        media_type,
        author_username: author_username?.replace(/^@/, ''),
        since: toUnixSeconds(since),
        until: toUnixSeconds(until),
        limit,
        fields: fieldsParam(fields, MEDIA_FIELDS),
      });
      return { query, search_type, search_mode, count: page.data?.length ?? 0, posts: page.data ?? [] };
    }),
  );

  server.registerTool(
    'get_recently_searched_keywords',
    {
      title: 'Recent searches',
      description: 'List keywords you recently searched with search_posts.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async () => ctx.client().get('/me', { fields: 'recently_searched_keywords' })),
  );

  server.registerTool(
    'search_locations',
    {
      title: 'Search locations',
      description: 'Find location IDs to tag in posts, by name and/or coordinates (needs threads_location_tagging).',
      inputSchema: z
        .object({
          query: z.string().optional().describe('Place name, e.g. "Monas Jakarta"'),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
        })
        .refine((v) => v.query || (v.latitude !== undefined && v.longitude !== undefined), {
          message: 'Provide query, or latitude and longitude',
        }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ query, latitude, longitude }) => {
      const page = await ctx.client().get<Page<unknown>>('/location_search', {
        q: query,
        latitude,
        longitude,
        fields: 'id,name,address,city,country,latitude,longitude,postal_code',
      });
      return { count: page.data?.length ?? 0, locations: page.data ?? [] };
    }),
  );

  server.registerTool(
    'get_location',
    {
      title: 'Get a location',
      description: 'Get details for a location ID (needs threads_location_tagging).',
      inputSchema: z.object({ location_id: threadsId }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ location_id }) =>
      ctx.client().get(`/${location_id}`, { fields: 'id,name,address,city,country,latitude,longitude,postal_code' }),
    ),
  );
}
