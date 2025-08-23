import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const searchTools: Tool[] = [
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
          enum: ['top', 'recent'],
          description: 'Type of search results (default: top)',
        },
        count: {
          type: 'number',
          description: 'Number of results to return (max: 100)',
          minimum: 1,
          maximum: 100,
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string for filtering results',
        },
        until: {
          type: 'string',
          description: 'ISO 8601 date string for filtering results',
        },
      },
      required: ['query'],
    },
  },
];