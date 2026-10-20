import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import { REPLY_FIELDS } from '../threads/fields.js';
import { threadsId } from './post-options.js';
import { fieldsParam, handler, toUnixSeconds } from './util.js';

const repliesShape = {
  thread_id: threadsId.describe('Media ID of the post'),
  fields: z.array(z.string()).optional().describe(`Fields to return. Default: ${REPLY_FIELDS.join(', ')}`),
  oldest_first: z.boolean().default(false).describe('Return oldest replies first (default: newest first)'),
  limit: z.number().int().min(1).max(500).default(50),
};

export function registerReplyTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    'get_thread_replies',
    {
      title: 'Get direct replies',
      description: 'Get the top-level replies to a post (needs threads_read_replies).',
      inputSchema: z.object(repliesShape),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id, fields, oldest_first, limit }) => {
      const replies = await ctx.client().paginate(
        `/${thread_id}/replies`,
        { fields: fieldsParam(fields, REPLY_FIELDS), reverse: !oldest_first, limit: Math.min(limit, 100) },
        limit,
      );
      return { thread_id, count: replies.length, replies };
    }),
  );

  server.registerTool(
    'get_conversation',
    {
      title: 'Get full conversation',
      description: 'Get every reply in a conversation, including nested replies, flattened (needs threads_read_replies).',
      inputSchema: z.object(repliesShape),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id, fields, oldest_first, limit }) => {
      const replies = await ctx.client().paginate(
        `/${thread_id}/conversation`,
        { fields: fieldsParam(fields, REPLY_FIELDS), reverse: !oldest_first, limit: Math.min(limit, 100) },
        limit,
      );
      return { thread_id, count: replies.length, replies };
    }),
  );

  server.registerTool(
    'get_my_replies',
    {
      title: 'List my replies',
      description: 'List replies you have posted.',
      inputSchema: z.object({
        fields: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(500).default(25),
        since: z.string().optional().describe('ISO 8601 date/time or Unix timestamp'),
        until: z.string().optional().describe('ISO 8601 date/time or Unix timestamp'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ fields, limit, since, until }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const replies = await client.paginate(
        `/${userId}/replies`,
        {
          fields: fieldsParam(fields, REPLY_FIELDS),
          limit: Math.min(limit, 100),
          since: toUnixSeconds(since),
          until: toUnixSeconds(until),
        },
        limit,
      );
      return { count: replies.length, replies };
    }),
  );

  server.registerTool(
    'manage_reply',
    {
      title: 'Hide or unhide a reply',
      description:
        'Hide or unhide a top-level reply on one of your posts; hiding also hides the replies under it (needs threads_manage_replies).',
      inputSchema: z.object({
        reply_id: threadsId,
        hide: z.boolean().describe('true to hide, false to unhide'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handler(async ({ reply_id, hide }) => {
      const res = await ctx.client().post<{ success?: boolean }>(`/${reply_id}/manage_reply`, { hide });
      return { reply_id, hidden: hide, success: res.success ?? true };
    }),
  );

  server.registerTool(
    'get_pending_replies',
    {
      title: 'List replies awaiting approval',
      description: 'List pending replies on a post that was published with enable_reply_approvals.',
      inputSchema: z.object({
        thread_id: threadsId,
        approval_status: z.enum(['pending', 'ignored']).default('pending'),
        fields: z.array(z.string()).optional(),
        oldest_first: z.boolean().default(false),
        limit: z.number().int().min(1).max(500).default(50),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id, approval_status, fields, oldest_first, limit }) => {
      const replies = await ctx.client().paginate(
        `/${thread_id}/pending_replies`,
        {
          fields: fieldsParam(fields, ['id', 'text', 'username', 'permalink', 'timestamp', 'reply_approval_status']),
          approval_status,
          reverse: !oldest_first,
          limit: Math.min(limit, 100),
        },
        limit,
      );
      return { thread_id, count: replies.length, replies };
    }),
  );

  server.registerTool(
    'manage_pending_reply',
    {
      title: 'Approve or ignore a pending reply',
      description: 'Approve (publish) or ignore a reply that is waiting for approval. Ignored replies can still be approved later.',
      inputSchema: z.object({
        reply_id: threadsId,
        approve: z.boolean().describe('true to approve, false to ignore'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handler(async ({ reply_id, approve }) => {
      const res = await ctx.client().post<{ success?: boolean }>(`/${reply_id}/manage_pending_reply`, { approve });
      return { reply_id, approved: approve, success: res.success ?? true };
    }),
  );
}
