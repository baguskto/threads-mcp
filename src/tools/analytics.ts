import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const analyticsTools: Tool[] = [
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
            enum: ['views', 'likes', 'replies', 'reposts', 'quotes', 'reach', 'impressions', 'shares', 'total_interactions'],
          },
          description: 'Metrics to retrieve',
        },
        period: {
          type: 'string',
          enum: ['day', 'week', 'days_28', 'month', 'lifetime'],
          description: 'Time period for the metrics',
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string for start date',
        },
        until: {
          type: 'string',
          description: 'ISO 8601 date string for end date',
        },
      },
      required: ['mediaId', 'metrics'],
    },
  },
  {
    name: 'get_account_insights',
    description: 'Get account-level analytics',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The ID of the user',
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'followers_count',
              'following_count', 
              'posts_count',
              'profile_views',
              'reach',
              'impressions',
              'website_clicks',
              'email_contacts',
              'phone_call_clicks',
              'text_message_clicks',
              'get_directions_clicks',
              'follower_demographics'
            ],
          },
          description: 'Metrics to retrieve',
        },
        period: {
          type: 'string',
          enum: ['day', 'week', 'days_28', 'month', 'lifetime'],
          description: 'Time period for the metrics',
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string for start date',
        },
        until: {
          type: 'string',
          description: 'ISO 8601 date string for end date',
        },
      },
      required: ['userId', 'metrics'],
    },
  },
];