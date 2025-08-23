#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { ThreadsAPIClient } from './api/client.js';

dotenv.config();

// Tool definitions
const tools: Tool[] = [
  {
    name: 'get_user_profile',
    description: 'Retrieve a user\'s Threads profile information',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The ID of the user',
        },
        fields: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Fields to retrieve (defaults to all)',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_current_user',
    description: 'Get the authenticated user\'s profile',
    inputSchema: {
      type: 'object',
      properties: {
        userFields: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Fields to retrieve (defaults to all)',
        },
      },
    },
  },
  {
    name: 'get_user_threads',
    description: 'Retrieve a user\'s threads/posts',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The ID of the user',
        },
        fields: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Fields to retrieve',
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string for filtering threads',
        },
        until: {
          type: 'string',
          description: 'ISO 8601 date string for filtering threads',
        },
        limit: {
          type: 'number',
          description: 'Number of threads to retrieve per page',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_media_object',
    description: 'Get details of a specific thread/media object',
    inputSchema: {
      type: 'object',
      properties: {
        mediaId: {
          type: 'string',
          description: 'The ID of the media object',
        },
        mediaFields: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Fields to retrieve',
        },
      },
      required: ['mediaId'],
    },
  },
  {
    name: 'get_replies',
    description: 'Retrieve replies to a specific thread',
    inputSchema: {
      type: 'object',
      properties: {
        mediaId: {
          type: 'string',
          description: 'The ID of the media/thread',
        },
        fields: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Fields to retrieve',
        },
        reverse: {
          type: 'boolean',
          description: 'Reverse the order of replies',
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string for filtering',
        },
        until: {
          type: 'string',
          description: 'ISO 8601 date string for filtering',
        },
      },
      required: ['mediaId'],
    },
  },
  {
    name: 'get_media_insights',
    description: 'Retrieve performance metrics for specific posts',
    inputSchema: {
      type: 'object',
      properties: {
        mediaId: {
          type: 'string',
          description: 'The ID of the media/thread',
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Metrics to retrieve',
        },
        period: {
          type: 'string',
          description: 'Time period for the metrics',
        },
      },
      required: ['mediaId', 'metrics'],
    },
  },
  {
    name: 'search_threads',
    description: 'Search for threads by keyword or hashtag',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (keywords or hashtags)',
        },
        type: {
          type: 'string',
          description: 'Type of search results (top or recent)',
        },
        count: {
          type: 'number',
          description: 'Number of results to return',
        },
      },
      required: ['query'],
    },
  },
];

// Create server instance
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

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!apiClient) {
    apiClient = initializeClient();
  }

  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'get_user_profile':
        const { userId, fields } = args as any;
        const fieldsParam = fields?.join(',') || 'id,username,name,threads_profile_picture_url,threads_biography';
        result = await apiClient.get(`/${userId}`, { fields: fieldsParam });
        break;

      case 'get_current_user':
        const { userFields } = args as any;
        const userFieldsParam = userFields?.join(',') || 'id,username,name';
        result = await apiClient.get('/me', { fields: userFieldsParam });
        break;

      case 'get_user_threads':
        const threadsParams = args as any;
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
        const mediaParams = args as any;
        const mediaFieldsParam = mediaParams.mediaFields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username,children,is_quote_post';
        result = await apiClient.get(`/${mediaParams.mediaId}`, { fields: mediaFieldsParam });
        break;

      case 'get_replies':
        const repliesParams = args as any;
        const repliesFields = repliesParams.fields?.join(',') || 'id,text,username,timestamp,media_type,media_url,hide_status';
        result = await apiClient.get(`/${repliesParams.mediaId}/replies`, {
          fields: repliesFields,
          reverse: repliesParams.reverse,
          since: repliesParams.since,
          until: repliesParams.until,
        });
        break;

      case 'get_media_insights':
        const insightsParams = args as any;
        result = await apiClient.get(`/${insightsParams.mediaId}/insights`, {
          metric: insightsParams.metrics.join(','),
          period: insightsParams.period,
        });
        break;

      case 'search_threads':
        const searchParams = args as any;
        result = await apiClient.get('/search', {
          q: searchParams.query,
          type: searchParams.type || 'top',
          count: searchParams.count || 50,
        });
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Threads MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});