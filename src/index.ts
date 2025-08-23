#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ThreadsAPIClient } from './api/client.js';

dotenv.config();

const server = new Server(
  {
    name: 'threads-personal-manager',
    version: '2.0.0',
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_my_profile',
        description: 'Get your own Threads profile information',
        inputSchema: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Profile fields to retrieve',
            },
          },
        },
      },
      {
        name: 'get_my_threads',
        description: 'Get your own threads/posts',
        inputSchema: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Thread fields to retrieve',
            },
            limit: {
              type: 'number',
              description: 'Number of threads to retrieve',
            },
            since: {
              type: 'string',
              description: 'ISO 8601 date for filtering',
            },
            until: {
              type: 'string',
              description: 'ISO 8601 date for filtering',
            },
          },
        },
      },
      {
        name: 'publish_thread',
        description: 'Create and publish a new thread',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text content of the thread',
            },
            media_type: {
              type: 'string',
              enum: ['TEXT', 'IMAGE', 'VIDEO'],
              description: 'Type of media (default: TEXT)',
            },
            media_url: {
              type: 'string',
              description: 'URL of media to include (for IMAGE/VIDEO)',
            },
            location_name: {
              type: 'string',
              description: 'Location name for location tagging',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'delete_thread',
        description: 'Delete one of your threads',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'ID of the thread to delete',
            },
          },
          required: ['thread_id'],
        },
      },
      {
        name: 'search_my_threads',
        description: 'Search within your own threads using keywords',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query/keywords',
            },
            limit: {
              type: 'number',
              description: 'Number of threads to search through',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_thread_replies',
        description: 'Get replies to your specific thread',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'ID of your thread',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Reply fields to retrieve',
            },
          },
          required: ['thread_id'],
        },
      },
      {
        name: 'manage_reply',
        description: 'Hide or show replies to your threads',
        inputSchema: {
          type: 'object',
          properties: {
            reply_id: {
              type: 'string',
              description: 'ID of the reply to manage',
            },
            hide: {
              type: 'boolean',
              description: 'Whether to hide (true) or show (false) the reply',
            },
          },
          required: ['reply_id', 'hide'],
        },
      },
      {
        name: 'get_my_insights',
        description: 'Get analytics and insights for your account',
        inputSchema: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to retrieve',
            },
            period: {
              type: 'string',
              enum: ['day', 'week', 'days_28', 'month', 'lifetime'],
              description: 'Time period for metrics',
            },
            since: {
              type: 'string',
              description: 'ISO 8601 start date',
            },
            until: {
              type: 'string',
              description: 'ISO 8601 end date',
            },
          },
          required: ['metrics'],
        },
      },
      {
        name: 'get_thread_insights',
        description: 'Get performance metrics for your specific thread',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'ID of your thread',
            },
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to retrieve',
            },
            period: {
              type: 'string',
              enum: ['day', 'week', 'days_28', 'month', 'lifetime'],
              description: 'Time period for metrics',
            },
          },
          required: ['thread_id', 'metrics'],
        },
      },
      {
        name: 'get_mentions',
        description: 'Get threads where you are mentioned',
        inputSchema: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to retrieve from mentions',
            },
            limit: {
              type: 'number',
              description: 'Number of mentions to retrieve',
            },
          },
        },
      },
      {
        name: 'get_publishing_limit',
        description: 'Check your current publishing quotas and limits',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
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
      case 'get_my_profile':
        const { fields } = args as any;
        const fieldsParam = fields?.join(',') || 'id,username,name,threads_profile_picture_url,threads_biography';
        result = await apiClient.get('/me', { fields: fieldsParam });
        break;

      case 'get_my_threads':
        const { fields: threadFields, limit, since, until } = args as any;
        const threadsFields = threadFields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username';
        
        // Get current user ID first
        const currentUser: any = await apiClient.get('/me', { fields: 'id' });
        result = await apiClient.paginate(
          `/${currentUser.id}/threads`,
          {
            fields: threadsFields,
            limit: limit || 25,
            since,
            until,
          }
        );
        break;

      case 'publish_thread':
        const { text, media_type, media_url, location_name } = args as any;
        
        const publishData: any = {
          text,
          media_type: media_type || 'TEXT',
        };
        
        if (media_url) {
          publishData.media_url = media_url;
        }
        
        if (location_name) {
          publishData.location_name = location_name;
        }
        
        // Get current user ID
        const user: any = await apiClient.get('/me', { fields: 'id' });
        
        // Step 1: Create media container
        const containerResponse: any = await apiClient.post(`/${user.id}/threads`, publishData);
        
        if (!containerResponse.id) {
          throw new Error('Failed to create media container');
        }
        
        // Step 2: Publish the container
        result = await apiClient.post(`/${user.id}/threads_publish`, {
          creation_id: containerResponse.id
        });
        
        // Return combined result with both container and publish info
        result = {
          ...result,
          container_id: containerResponse.id,
          original_data: publishData
        };
        break;

      case 'delete_thread':
        const { thread_id } = args as any;
        result = await apiClient.delete(`/${thread_id}`);
        break;

      case 'search_my_threads':
        const { query, limit: searchLimit } = args as any;
        
        // Get current user's threads first
        const me: any = await apiClient.get('/me', { fields: 'id' });
        const userThreads = await apiClient.paginate(
          `/${me.id}/threads`,
          {
            fields: 'id,text,media_type,timestamp,permalink',
            limit: searchLimit || 100,
          }
        );
        
        // Filter threads based on query (client-side)
        const filteredThreads = userThreads.filter((thread: any) => 
          thread.text && thread.text.toLowerCase().includes(query.toLowerCase())
        );
        
        result = {
          searchQuery: query,
          totalThreadsSearched: userThreads.length,
          matchingThreads: filteredThreads.length,
          threads: filteredThreads,
        };
        break;

      case 'get_thread_replies':
        const { thread_id: threadId, fields: replyFields } = args as any;
        const repliesFields = replyFields?.join(',') || 'id,text,username,timestamp,hide_status';
        result = await apiClient.get(`/${threadId}/replies`, { fields: repliesFields });
        break;

      case 'manage_reply':
        const { reply_id, hide } = args as any;
        result = await apiClient.post(`/${reply_id}/manage`, { hide });
        break;

      case 'get_my_insights':
        const { metrics, period, since: insightSince, until: insightUntil } = args as any;
        const currentUserForInsights: any = await apiClient.get('/me', { fields: 'id' });
        result = await apiClient.get(`/${currentUserForInsights.id}/threads_insights`, {
          metric: metrics.join(','),
          period,
          since: insightSince,
          until: insightUntil,
        });
        break;

      case 'get_thread_insights':
        const { thread_id: insightThreadId, metrics: threadMetrics, period: threadPeriod } = args as any;
        result = await apiClient.get(`/${insightThreadId}/insights`, {
          metric: threadMetrics.join(','),
          period: threadPeriod,
        });
        break;

      case 'get_mentions':
        const { fields: mentionFields, limit: mentionLimit } = args as any;
        const mentionsFields = mentionFields?.join(',') || 'id,text,username,timestamp';
        
        // This would depend on the actual API endpoint for mentions
        const userForMentions: any = await apiClient.get('/me', { fields: 'id' });
        result = await apiClient.get(`/${userForMentions.id}/mentions`, {
          fields: mentionsFields,
          limit: mentionLimit || 25,
        });
        break;

      case 'get_publishing_limit':
        const userForLimit: any = await apiClient.get('/me', { fields: 'id' });
        result = await apiClient.get(`/${userForLimit.id}/threads_publishing_limit`);
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
  console.error('Threads Personal Manager MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});