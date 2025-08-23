#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ThreadsAPIClient } from './api/client.js';
import { usernameResolver } from './utils/username-resolver.js';

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
        name: 'resolve_username',
        description: 'Convert username to user ID (experimental feature)',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Username to resolve (without @)',
            },
            method: {
              type: 'string',
              enum: ['search', 'profile_lookup', 'mention_search'],
              description: 'Method to use for resolution (default: search)',
            },
          },
          required: ['username'],
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
        name: 'search_user_threads',
        description: 'Search within a specific user\'s threads (workaround for general search)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID to search within',
            },
            query: {
              type: 'string',
              description: 'Search term to find in user\'s threads',
            },
            limit: {
              type: 'number',
              description: 'Number of threads to search through',
            },
          },
          required: ['userId', 'query'],
        },
      },
      {
        name: 'get_thread_details',
        description: 'Get detailed information about a specific thread',
        inputSchema: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'The ID of the thread',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to retrieve',
            },
          },
          required: ['threadId'],
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

      case 'resolve_username':
        const { username, method } = args as any;
        const resolveMethod = method || 'search';
        
        // Method 1: Try direct API lookup first
        try {
          const directResult: any = await apiClient.get(`/${username}`, { 
            fields: 'id,username,name' 
          });
          result = {
            success: true,
            method: 'direct_api_lookup',
            userId: directResult.id,
            username: directResult.username,
            name: directResult.name,
            note: 'Username resolved directly via Threads API'
          };
          break;
        } catch (directError) {
          // Continue to other methods
        }

        // Method 2: Use web scraping fallback
        if (resolveMethod === 'search' || resolveMethod === 'profile_lookup') {
          const webResult = await usernameResolver.resolveUsername(username);
          
          // If web scraping found an ID, verify it with API
          if (webResult.success && webResult.userId) {
            try {
              const verifyResult: any = await apiClient.get(`/${webResult.userId}`, { 
                fields: 'id,username,name' 
              });
              result = {
                success: true,
                method: 'web_scraping_verified',
                userId: verifyResult.id,
                username: verifyResult.username,
                name: verifyResult.name,
                note: 'Username resolved via web scraping and verified with API',
                originalMethod: webResult.method
              };
            } catch (verifyError) {
              // Return unverified result with warning
              result = {
                ...webResult,
                method: 'web_scraping_unverified',
                note: webResult.note + ' (Could not verify with API - use with caution)'
              };
            }
          } else {
            result = webResult;
          }
          break;
        }

        // Method 3: Search through mentions (fallback)
        if (resolveMethod === 'mention_search') {
          try {
            const currentUser: any = await apiClient.get('/me', { fields: 'id' });
            const threads: any = await apiClient.get(`/${currentUser.id}/threads`, {
              fields: 'text,id',
              limit: 100
            });
            
            const mentionPattern = new RegExp(`@${username}\\b`, 'i');
            const mentionedThreads = threads.data?.filter((thread: any) => 
              thread.text && mentionPattern.test(thread.text)
            );
            
            result = {
              success: false,
              method: 'mention_search',
              username: username,
              mentionedIn: mentionedThreads?.length || 0,
              note: `Found ${mentionedThreads?.length || 0} mentions of @${username} but couldn't extract user ID`,
              suggestions: [
                'Try the "profile_lookup" method instead',
                'Use numerical user ID if available',
                'Contact the user directly for their ID'
              ]
            };
          } catch (searchError) {
            result = {
              success: false,
              method: 'mention_search',
              username: username,
              error: searchError instanceof Error ? searchError.message : 'Unknown error',
              note: 'Unable to search mentions due to API limitations'
            };
          }
          break;
        }

        // Default fallback
        result = {
          success: false,
          method: resolveMethod,
          username: username,
          error: 'No resolution method succeeded',
          note: 'All username resolution methods failed',
          suggestions: [
            'Verify username exists and is spelled correctly',
            'Try different resolution method: search, profile_lookup, mention_search',
            'Use numerical user ID if available'
          ]
        };
        break;

      case 'get_user_threads':
        const { userId: threadUserId, fields: userThreadFields, limit } = args as any;
        const threadsFields = userThreadFields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username,is_quote_post';
        result = await apiClient.paginate(
          `/${threadUserId}/threads`,
          {
            fields: threadsFields,
            limit: limit || 25,
          }
        );
        break;

      case 'search_user_threads':
        const { userId: searchUserId, query, limit: searchLimit } = args as any;
        
        // Get user's threads first
        const userThreads = await apiClient.paginate(
          `/${searchUserId}/threads`,
          {
            fields: 'id,text,media_type,timestamp,permalink',
            limit: searchLimit || 100,
          }
        );
        
        // Filter threads based on query
        const filteredThreads = userThreads.filter((thread: any) => 
          thread.text && thread.text.toLowerCase().includes(query.toLowerCase())
        );
        
        result = {
          searchQuery: query,
          userId: searchUserId,
          totalThreadsSearched: userThreads.length,
          matchingThreads: filteredThreads.length,
          threads: filteredThreads,
          note: 'Client-side search through user threads due to API limitations'
        };
        break;

      case 'get_thread_details':
        const { threadId, fields: detailFields } = args as any;
        const detailThreadFields = detailFields?.join(',') || 'id,media_type,media_url,text,timestamp,permalink,username,children,is_quote_post';
        result = await apiClient.get(`/${threadId}`, { fields: detailThreadFields });
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