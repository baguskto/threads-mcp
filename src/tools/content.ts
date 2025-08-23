import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const contentTools: Tool[] = [
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
            enum: ['id', 'media_type', 'media_url', 'text', 'timestamp', 'permalink', 'username', 'children', 'is_quote_post'],
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
            enum: ['id', 'text', 'username', 'timestamp', 'media_type', 'media_url', 'hide_status'],
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
    name: 'get_conversation',
    description: 'Get full conversation thread',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The ID of the conversation',
        },
        fields: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['id', 'text', 'username', 'timestamp', 'media_type'],
          },
          description: 'Fields to retrieve',
        },
        reverse: {
          type: 'boolean',
          description: 'Reverse the order of the conversation',
        },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'manage_reply',
    description: 'Hide or show replies (moderation)',
    inputSchema: {
      type: 'object',
      properties: {
        replyId: {
          type: 'string',
          description: 'The ID of the reply to manage',
        },
        hide: {
          type: 'boolean',
          description: 'Whether to hide (true) or show (false) the reply',
        },
      },
      required: ['replyId', 'hide'],
    },
  },
  {
    name: 'get_publishing_limit',
    description: 'Check posting quotas and limits',
    inputSchema: {
      type: 'object',
      properties: {
        limitUserId: {
          type: 'string',
          description: 'The ID of the user',
        },
      },
      required: ['limitUserId'],
    },
  },
];