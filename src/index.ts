#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ThreadsAPIClient } from './api/client.js';
import { userTools } from './tools/user.js';
import { contentTools } from './tools/content.js';
import { analyticsTools } from './tools/analytics.js';
import { searchTools } from './tools/search.js';
import dotenv from 'dotenv';

dotenv.config();

const server = new Server(
  {
    name: 'threads-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let apiClient: ThreadsAPIClient | null = null;

const initializeClient = () => {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('THREADS_ACCESS_TOKEN environment variable is required');
  }
  apiClient = new ThreadsAPIClient(accessToken);
  return apiClient;
};

const allTools: Tool[] = [
  ...userTools,
  ...contentTools,
  ...analyticsTools,
  ...searchTools,
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!apiClient) {
    apiClient = initializeClient();
  }

  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'get_user_profile':
        const { userId, fields } = z.object({
          userId: z.string(),
          fields: z.array(z.string()).optional(),
        }).parse(args);
        
        const fieldsParam = fields?.join(',') || 'id,username,name,threads_profile_picture_url,threads_biography';
        result = await apiClient.get(`/${userId}`, { fields: fieldsParam });
        break;

      case 'get_current_user':
        const { userFields } = z.object({
          userFields: z.array(z.string()).optional(),
        }).parse(args);
        
        const userFieldsParam = userFields?.join(',') || 'id,username,name';
        result = await apiClient.get('/me', { fields: userFieldsParam });
        break;

      case 'get_user_threads':
        const threadsParams = z.object({
          userId: z.string(),
          fields: z.array(z.string()).optional(),
          since: z.string().optional(),
          until: z.string().optional(),
          limit: z.number().optional(),
        }).parse(args);
        
        const threadsFields = threadsParams.fields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username,is_quote_post';
        result = await apiClient.paginate(
          `/${threadsParams.userId}/threads`,
          {
            fields: threadsFields,
            since: threadsParams.since,
            until: threadsParams.until,
            limit: threadsParams.limit || 25,
          }
        );
        break;

      case 'get_media_object':
        const { mediaId, mediaFields } = z.object({
          mediaId: z.string(),
          mediaFields: z.array(z.string()).optional(),
        }).parse(args);
        
        const mediaFieldsParam = mediaFields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username,children,is_quote_post';
        result = await apiClient.get(`/${mediaId}`, { fields: mediaFieldsParam });
        break;

      case 'get_replies':
        const repliesParams = z.object({
          mediaId: z.string(),
          fields: z.array(z.string()).optional(),
          reverse: z.boolean().optional(),
          since: z.string().optional(),
          until: z.string().optional(),
        }).parse(args);
        
        const repliesFields = repliesParams.fields?.join(',') || 'id,text,username,timestamp,media_type,media_url,hide_status';
        result = await apiClient.get(`/${repliesParams.mediaId}/replies`, {
          fields: repliesFields,
          reverse: repliesParams.reverse,
          since: repliesParams.since,
          until: repliesParams.until,
        });
        break;

      case 'get_conversation':
        const convParams = z.object({
          conversationId: z.string(),
          fields: z.array(z.string()).optional(),
          reverse: z.boolean().optional(),
        }).parse(args);
        
        const convFields = convParams.fields?.join(',') || 'id,text,username,timestamp,media_type';
        result = await apiClient.get(`/${convParams.conversationId}/conversation`, {
          fields: convFields,
          reverse: convParams.reverse,
        });
        break;

      case 'get_media_insights':
        const insightsParams = z.object({
          mediaId: z.string(),
          metrics: z.array(z.string()),
          period: z.string().optional(),
          since: z.string().optional(),
          until: z.string().optional(),
        }).parse(args);
        
        result = await apiClient.get(`/${insightsParams.mediaId}/insights`, {
          metric: insightsParams.metrics.join(','),
          period: insightsParams.period,
          since: insightsParams.since,
          until: insightsParams.until,
        });
        break;

      case 'get_account_insights':
        const accountParams = z.object({
          userId: z.string(),
          metrics: z.array(z.string()),
          period: z.string().optional(),
          since: z.string().optional(),
          until: z.string().optional(),
        }).parse(args);
        
        result = await apiClient.get(`/${accountParams.userId}/threads_insights`, {
          metric: accountParams.metrics.join(','),
          period: accountParams.period,
          since: accountParams.since,
          until: accountParams.until,
        });
        break;

      case 'search_threads':
        const searchParams = z.object({
          query: z.string(),
          type: z.enum(['top', 'recent']).optional(),
          count: z.number().optional(),
          since: z.string().optional(),
          until: z.string().optional(),
        }).parse(args);
        
        result = await apiClient.get('/search', {
          q: searchParams.query,
          type: searchParams.type || 'top',
          count: searchParams.count || 50,
          since: searchParams.since,
          until: searchParams.until,
        });
        break;

      case 'manage_reply':
        const manageParams = z.object({
          replyId: z.string(),
          hide: z.boolean(),
        }).parse(args);
        
        result = await apiClient.post(`/${manageParams.replyId}/manage`, {
          hide: manageParams.hide,
        });
        break;

      case 'get_publishing_limit':
        const { limitUserId } = z.object({
          limitUserId: z.string(),
        }).parse(args);
        
        result = await apiClient.get(`/${limitUserId}/threads_publishing_limit`);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Threads MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});