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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_current_user',
        description: 'Get the authenticated user\'s profile',
        inputSchema: {
          type: 'object',
          properties: {
            userFields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to retrieve (defaults to all)',
            },
          },
        },
      },
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
              items: { type: 'string' },
              description: 'Fields to retrieve (defaults to all)',
            },
          },
          required: ['userId'],
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
              items: { type: 'string' },
              description: 'Fields to retrieve',
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
      case 'get_current_user':
        const { userFields } = args as any;
        const userFieldsParam = userFields?.join(',') || 'id,username,name';
        result = await apiClient.get('/me', { fields: userFieldsParam });
        break;

      case 'get_user_profile':
        const { userId, fields } = args as any;
        const fieldsParam = fields?.join(',') || 'id,username,name,threads_profile_picture_url,threads_biography';
        result = await apiClient.get(`/${userId}`, { fields: fieldsParam });
        break;

      case 'get_user_threads':
        const { userId: threadUserId, fields: threadFields, limit } = args as any;
        const threadsFields = threadFields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username,is_quote_post';
        result = await apiClient.paginate(
          `/${threadUserId}/threads`,
          {
            fields: threadsFields,
            limit: limit || 25,
          }
        );
        break;

      case 'search_threads':
        const { query, type, count } = args as any;
        result = await apiClient.get('/search', {
          q: query,
          type: type || 'top',
          count: count || 50,
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Threads MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});