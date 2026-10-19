import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import { PROFILE_FIELDS } from '../threads/fields.js';
import { describeError, ThreadsApiError } from '../threads/errors.js';
import { fieldsParam, handler } from './util.js';

/** Scopes the full tool set can use, and which tools need each one. */
export const SCOPES: Record<string, string> = {
  threads_basic: 'every tool',
  threads_content_publish: 'publish_thread, create_carousel_post, quote_post, repost_thread, create_thread_chain',
  threads_manage_replies: 'create_reply, manage_reply, manage_pending_reply',
  threads_read_replies: 'get_thread_replies, get_conversation, get_my_replies, get_pending_replies',
  threads_manage_insights: 'get_thread_insights, get_my_insights, get_audience_demographics, reports',
  threads_manage_mentions: 'get_mentions',
  threads_keyword_search: 'search_posts beyond your own posts',
  threads_delete: 'delete_thread',
  threads_location_tagging: 'search_locations, get_location, location_id',
  threads_profile_discovery: 'lookup_profile, get_profile_posts',
  threads_share_to_instagram: 'share_to_instagram_story',
};

export function registerAccountTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    'get_my_profile',
    {
      title: 'Get my profile',
      description: 'Get the authenticated Threads profile (username, name, bio, avatar, verification).',
      inputSchema: z.object({
        fields: z.array(z.string()).optional().describe(`Profile fields to return. Default: ${PROFILE_FIELDS.join(', ')}`),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ fields }) => ctx.client().get('/me', { fields: fieldsParam(fields, PROFILE_FIELDS) })),
  );

  server.registerTool(
    'get_publishing_limit',
    {
      title: 'Get publishing limits',
      description:
        'Show how much of the rolling 24-hour quota is used: posts (250), replies (1,000), deletes (100) and location searches (500).',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async () => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const path = `/${userId}/threads_publishing_limit`;
      const res = await client.get<{ data?: Record<string, unknown>[] }>(path, {
        fields: ['quota_usage', 'config', 'reply_quota_usage', 'reply_config'],
      });
      const limits: Record<string, unknown> = { ...(res.data?.[0] ?? {}) };
      // These pairs need threads_delete / threads_location_tagging; asking for them
      // without the scope fails the whole request, so fetch them separately.
      const optional = [
        { scope: 'threads_delete', fields: ['delete_quota_usage', 'delete_config'] },
        { scope: 'threads_location_tagging', fields: ['location_search_quota_usage', 'location_search_config'] },
      ];
      const unavailable: string[] = [];
      for (const { scope, fields } of optional) {
        try {
          // Not retried: without the scope Threads answers with a 500, which would otherwise be retried 3 times.
          const extra = await client.get<{ data?: Record<string, unknown>[] }>(path, { fields }, { retries: 0 });
          Object.assign(limits, extra.data?.[0]);
        } catch (error) {
          const permission =
            error instanceof ThreadsApiError && (error.code === 10 || (error.code !== undefined && error.code >= 200 && error.code < 300));
          unavailable.push(
            permission
              ? `${fields.join(', ')}: needs ${scope}`
              : `${fields.join(', ')}: ${describeError(error)} (Threads also fails this way when the token lacks ${scope})`,
          );
        }
      }
      return unavailable.length ? { ...limits, unavailable } : limits;
    }),
  );

  server.registerTool(
    'validate_setup',
    {
      title: 'Validate setup',
      description:
        'Check that the access token works, which scopes it has, and which tools will be unavailable. Run this first when other tools fail.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async () => {
      if (!ctx.config.accessToken) {
        return {
          status: 'missing_token',
          recommendations: ['Set THREADS_ACCESS_TOKEN in the env block of this MCP server and restart the client.'],
        };
      }
      const client = ctx.client();
      const report: Record<string, unknown> = { checked_at: new Date().toISOString() };
      try {
        report.profile = await client.get('/me', { fields: 'id,username,name,is_verified' });
      } catch (error) {
        return {
          ...report,
          status: 'invalid_token',
          error: describeError(error),
          recommendations: [
            'Generate a new long-lived token in the Meta App Dashboard (Threads use case) or via the OAuth flow.',
            'Long-lived tokens last 60 days; call refresh_access_token before they expire.',
          ],
        };
      }

      const token = await inspectToken(ctx);
      report.token = token;
      const granted = token.scopes;
      if (granted) {
        const missing = Object.keys(SCOPES).filter((s) => !granted.includes(s));
        report.missing_scopes = missing.map((scope) => ({ scope, needed_for: SCOPES[scope] }));
        report.status = missing.length ? 'ok_with_missing_scopes' : 'ok';
      } else {
        report.status = 'ok';
        report.note = 'Profile access works, but the token scopes could not be inspected with debug_token.';
      }
      return report;
    }),
  );

  server.registerTool(
    'exchange_for_long_lived_token',
    {
      title: 'Exchange for a long-lived token',
      description:
        'Exchange the configured short-lived token (valid 1 hour) for a long-lived one (valid 60 days). Needs THREADS_APP_SECRET. ' +
        'The new token is used for the rest of this session; save it to your MCP config to keep it after a restart.',
      inputSchema: z.object({
        reveal_token: z.boolean().default(false).describe('Include the full new token in the result'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handler(async ({ reveal_token }) => {
      if (!ctx.config.appSecret) throw new Error('Set THREADS_APP_SECRET (your Threads app secret) to exchange tokens.');
      const client = ctx.client();
      const res = await client.get<TokenResponse>(
        '/access_token',
        { grant_type: 'th_exchange_token', client_secret: ctx.config.appSecret },
        { versioned: false },
      );
      return applyNewToken(ctx, res, reveal_token);
    }),
  );

  server.registerTool(
    'refresh_access_token',
    {
      title: 'Refresh access token',
      description:
        'Extend a long-lived token for another 60 days (the token must be at least 24 hours old and not expired). ' +
        'The new token is used for the rest of this session; save it to your MCP config to keep it after a restart.',
      inputSchema: z.object({
        reveal_token: z
          .boolean()
          .default(false)
          .describe('Include the full new token in the result so you can copy it into your config'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handler(async ({ reveal_token }) => {
      const res = await ctx.client().get<TokenResponse>(
        '/refresh_access_token',
        { grant_type: 'th_refresh_token' },
        { versioned: false },
      );
      return applyNewToken(ctx, res, reveal_token);
    }),
  );
}

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/** Switches the session to a new token and reports it without leaking it by default. */
function applyNewToken(ctx: ToolContext, res: TokenResponse, reveal: boolean) {
  ctx.client().setAccessToken(res.access_token);
  ctx.config.accessToken = res.access_token;
  return {
    updated: true,
    expires_in_seconds: res.expires_in,
    expires_at: res.expires_in ? new Date(Date.now() + res.expires_in * 1000).toISOString() : undefined,
    access_token: reveal ? res.access_token : maskToken(res.access_token),
    note: 'Update THREADS_ACCESS_TOKEN in your MCP config with the new token to keep using it after a restart.',
  };
}

export function maskToken(token: string): string {
  return token.length <= 12 ? '***' : `${token.slice(0, 6)}…${token.slice(-4)}`;
}

interface TokenInfo {
  scopes?: string[];
  expires_at?: string;
  data_access_expires_at?: string;
  is_valid?: boolean;
  error?: string;
}

/** Uses debug_token when an app secret is available to report scopes and expiry. */
async function inspectToken(ctx: ToolContext): Promise<TokenInfo> {
  const client = ctx.client();
  try {
    const res = await client.get<{ data?: any }>('/debug_token', { input_token: client.token });
    const data = res.data ?? {};
    const iso = (s?: number) => (s ? new Date(s * 1000).toISOString() : undefined);
    return {
      is_valid: data.is_valid,
      scopes: data.scopes,
      expires_at: data.expires_at === 0 ? 'never' : iso(data.expires_at),
      data_access_expires_at: iso(data.data_access_expires_at),
    };
  } catch (error) {
    return { error: describeError(error) };
  }
}
