import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const userTools: Tool[] = [
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
            enum: ['id', 'username', 'name', 'threads_profile_picture_url', 'threads_biography'],
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
            enum: ['id', 'username', 'name'],
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
            enum: ['id', 'media_type', 'media_url', 'text', 'timestamp', 'permalink', 'username', 'is_quote_post'],
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
];