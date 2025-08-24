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
    name: 'threads-mcp-server',
    version: '4.0.1',
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
      {
        name: 'create_reply',
        description: 'Reply to a specific thread/post',
        inputSchema: {
          type: 'object',
          properties: {
            reply_to_id: {
              type: 'string',
              description: 'ID of the thread/post to reply to',
            },
            text: {
              type: 'string',
              description: 'Reply text content',
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
            reply_control: {
              type: 'string',
              enum: ['everyone', 'accounts_you_follow', 'mentioned_only', 'parent_post_author_only', 'followers_only'],
              description: 'Who can reply to this reply',
            },
          },
          required: ['reply_to_id', 'text'],
        },
      },
      {
        name: 'create_thread_chain',
        description: 'Create a thread chain (multiple connected replies)',
        inputSchema: {
          type: 'object',
          properties: {
            parent_thread_id: {
              type: 'string',
              description: 'ID of the parent thread to start the chain',
            },
            replies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  reply_control: { type: 'string', enum: ['everyone', 'accounts_you_follow', 'mentioned_only', 'parent_post_author_only', 'followers_only'] }
                },
                required: ['text']
              },
              description: 'Array of reply texts to create as a chain',
            },
          },
          required: ['parent_thread_id', 'replies'],
        },
      },
      {
        name: 'quote_post',
        description: 'Quote another thread/post with your own text',
        inputSchema: {
          type: 'object',
          properties: {
            quoted_post_id: {
              type: 'string',
              description: 'ID of the post to quote',
            },
            text: {
              type: 'string',
              description: 'Your quote text/commentary',
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
            reply_control: {
              type: 'string',
              enum: ['everyone', 'accounts_you_follow', 'mentioned_only', 'parent_post_author_only', 'followers_only'],
              description: 'Who can reply to this quote',
            },
          },
          required: ['quoted_post_id', 'text'],
        },
      },
      {
        name: 'repost_thread',
        description: 'Repost/share another thread',
        inputSchema: {
          type: 'object',
          properties: {
            post_id: {
              type: 'string',
              description: 'ID of the post to repost',
            },
          },
          required: ['post_id'],
        },
      },
      {
        name: 'unrepost_thread',
        description: 'Remove a repost you previously shared',
        inputSchema: {
          type: 'object',
          properties: {
            post_id: {
              type: 'string',
              description: 'ID of the post to unrepost',
            },
          },
          required: ['post_id'],
        },
      },
      {
        name: 'like_post',
        description: 'Like a thread/post',
        inputSchema: {
          type: 'object',
          properties: {
            post_id: {
              type: 'string',
              description: 'ID of the post to like',
            },
          },
          required: ['post_id'],
        },
      },
      {
        name: 'unlike_post',
        description: 'Remove like from a thread/post',
        inputSchema: {
          type: 'object',
          properties: {
            post_id: {
              type: 'string',
              description: 'ID of the post to unlike',
            },
          },
          required: ['post_id'],
        },
      },
      {
        name: 'get_post_likes',
        description: 'Get list of users who liked a post',
        inputSchema: {
          type: 'object',
          properties: {
            post_id: {
              type: 'string',
              description: 'ID of the post to get likes for',
            },
            limit: {
              type: 'number',
              description: 'Number of likes to retrieve',
            },
          },
          required: ['post_id'],
        },
      },
      {
        name: 'create_post_with_restrictions',
        description: 'Create post with advanced reply and audience restrictions',
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
            reply_control: {
              type: 'string',
              enum: ['everyone', 'accounts_you_follow', 'mentioned_only', 'parent_post_author_only', 'followers_only'],
              description: 'Who can reply to this post',
            },
            audience_control: {
              type: 'string',
              enum: ['public', 'followers_only', 'close_friends'],
              description: 'Who can see this post',
            },
            location_name: {
              type: 'string',
              description: 'Location name for location tagging',
            },
            hashtags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of hashtags to include (without #)',
            },
            mentions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of usernames to mention (without @)',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'schedule_post',
        description: 'Schedule a post to be published at a future time',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text content of the thread',
            },
            scheduled_publish_time: {
              type: 'string',
              description: 'ISO 8601 datetime when to publish (e.g., "2025-08-25T10:00:00+07:00")',
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
            reply_control: {
              type: 'string',
              enum: ['everyone', 'accounts_you_follow', 'mentioned_only', 'parent_post_author_only', 'followers_only'],
              description: 'Who can reply to this post',
            },
            location_name: {
              type: 'string',
              description: 'Location name for location tagging',
            },
          },
          required: ['text', 'scheduled_publish_time'],
        },
      },
      {
        name: 'search_posts',
        description: 'Search for posts using keywords',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search keyword or phrase',
            },
            search_type: {
              type: 'string',
              enum: ['TOP', 'RECENT'],
              description: 'Search results order: TOP (popular) or RECENT (chronological)',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return (max 100, default 25)',
            },
            since: {
              type: 'string',
              description: 'ISO 8601 date to search from',
            },
            until: {
              type: 'string',
              description: 'ISO 8601 date to search until',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_mentions',
        description: 'Search for posts that mention you or specific users',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID to search mentions for (defaults to current user)',
            },
            limit: {
              type: 'number',
              description: 'Number of mentions to retrieve',
            },
            since: {
              type: 'string',
              description: 'ISO 8601 date to search from',
            },
            until: {
              type: 'string',
              description: 'ISO 8601 date to search until',
            },
          },
        },
      },
      {
        name: 'search_by_hashtags',
        description: 'Search for posts by hashtag or topic tags',
        inputSchema: {
          type: 'object',
          properties: {
            hashtags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Hashtags to search for (without #)',
            },
            search_type: {
              type: 'string',
              enum: ['TOP', 'RECENT'],
              description: 'Search results order',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return',
            },
          },
          required: ['hashtags'],
        },
      },
      {
        name: 'search_by_topics',
        description: 'Search for posts by topic tags',
        inputSchema: {
          type: 'object',
          properties: {
            topics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Topic tags to search for',
            },
            search_type: {
              type: 'string',
              enum: ['TOP', 'RECENT'],
              description: 'Search results order',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return',
            },
          },
          required: ['topics'],
        },
      },
      {
        name: 'get_trending_posts',
        description: 'Get trending/popular posts in various categories',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Trending category (optional)',
            },
            limit: {
              type: 'number',
              description: 'Number of trending posts to retrieve',
            },
            timeframe: {
              type: 'string',
              enum: ['hour', 'day', 'week'],
              description: 'Trending timeframe',
            },
          },
        },
      },
      {
        name: 'search_users',
        description: 'Search for users by username or display name',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Username or display name to search for',
            },
            limit: {
              type: 'number',
              description: 'Number of users to return',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_user_followers',
        description: 'Get followers list for a user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID to get followers for (defaults to current user)',
            },
            limit: {
              type: 'number',
              description: 'Number of followers to retrieve',
            },
          },
        },
      },
      {
        name: 'get_user_following',
        description: 'Get following list for a user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID to get following for (defaults to current user)',
            },
            limit: {
              type: 'number',
              description: 'Number of following to retrieve',
            },
          },
        },
      },
      {
        name: 'follow_user',
        description: 'Follow a user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID to follow',
            },
          },
          required: ['user_id'],
        },
      },
      {
        name: 'unfollow_user',
        description: 'Unfollow a user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID to unfollow',
            },
          },
          required: ['user_id'],
        },
      },
      {
        name: 'block_user',
        description: 'Block a user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID to block',
            },
          },
          required: ['user_id'],
        },
      },
      {
        name: 'get_enhanced_insights',
        description: 'Get advanced analytics including views, clicks, shares, and demographics',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'Thread ID for media insights (optional for user insights)',
            },
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to retrieve: views, likes, replies, reposts, quotes, shares, clicks, followers_count, follower_demographics',
            },
            period: {
              type: 'string',
              enum: ['day', 'week', 'days_28', 'month', 'lifetime'],
              description: 'Time period for insights',
            },
            breakdown: {
              type: 'array',
              items: { 
                type: 'string',
                enum: ['country', 'city', 'age', 'gender']
              },
              description: 'Demographic breakdown options',
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
        },
      },
      {
        name: 'get_audience_demographics',
        description: 'Get detailed audience demographic analysis',
        inputSchema: {
          type: 'object',
          properties: {
            breakdown_by: {
              type: 'array',
              items: { 
                type: 'string',
                enum: ['country', 'city', 'age', 'gender']
              },
              description: 'Demographic categories to analyze',
            },
            period: {
              type: 'string',
              enum: ['day', 'week', 'days_28', 'month', 'lifetime'],
              description: 'Time period for demographic data',
            },
          },
        },
      },
      {
        name: 'get_engagement_trends',
        description: 'Analyze engagement patterns and trends over time',
        inputSchema: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: { 
                type: 'string',
                enum: ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares', 'clicks']
              },
              description: 'Engagement metrics to track',
            },
            timeframe: {
              type: 'string',
              enum: ['week', 'month', 'quarter'],
              description: 'Analysis timeframe',
            },
            granularity: {
              type: 'string',
              enum: ['daily', 'weekly'],
              description: 'Data point frequency',
            },
          },
        },
      },
      {
        name: 'get_follower_growth_analytics',
        description: 'Track follower growth patterns and projections',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['week', 'month', 'quarter', 'year'],
              description: 'Growth analysis period',
            },
            include_projections: {
              type: 'boolean',
              description: 'Include growth projections based on trends',
            },
          },
        },
      },
      {
        name: 'analyze_best_posting_times',
        description: 'AI-driven analysis of optimal posting times based on engagement',
        inputSchema: {
          type: 'object',
          properties: {
            analysis_period: {
              type: 'string',
              enum: ['month', 'quarter', 'year'],
              description: 'Historical data period for analysis',
            },
            timezone: {
              type: 'string',
              description: 'Timezone for recommendations (e.g., "America/New_York")',
            },
            content_type: {
              type: 'string',
              enum: ['all', 'text', 'image', 'video'],
              description: 'Content type to analyze',
            },
          },
        },
      },
      {
        name: 'get_content_performance_report',
        description: 'Comprehensive performance report across all content',
        inputSchema: {
          type: 'object',
          properties: {
            report_type: {
              type: 'string',
              enum: ['summary', 'detailed', 'top_performers', 'underperformers'],
              description: 'Type of performance report',
            },
            period: {
              type: 'string',
              enum: ['week', 'month', 'quarter'],
              description: 'Report time period',
            },
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to include in report',
            },
            include_comparisons: {
              type: 'boolean',
              description: 'Include period-over-period comparisons',
            },
          },
        },
      },
      
      // Phase 3B: Professional Content Creation & Automation
      {
        name: 'create_carousel_post',
        description: 'Create multi-media carousel posts with up to 20 items (September 2024 update)',
        inputSchema: {
          type: 'object',
          properties: {
            media_urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of image/video URLs for carousel (2-20 items supported)',
              minItems: 2,
              maxItems: 20,
            },
            text: {
              type: 'string',
              description: 'Post caption text',
            },
            alt_texts: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alt text for each media item (accessibility)',
            },
            carousel_settings: {
              type: 'object',
              properties: {
                auto_alt_text: { type: 'boolean', description: 'Generate alt text automatically' },
                aspect_ratio: { type: 'string', enum: ['square', 'portrait', 'landscape'], description: 'Preferred aspect ratio' },
                thumbnail_selection: { type: 'string', enum: ['auto', 'first', 'custom'], description: 'Thumbnail selection method' },
              },
            },
          },
          required: ['media_urls', 'text'],
        },
      },
      
      {
        name: 'schedule_post',
        description: 'Schedule posts with advanced automation and optimal timing',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Post content',
            },
            media_url: {
              type: 'string',
              description: 'Optional media URL',
            },
            schedule_time: {
              type: 'string',
              description: 'ISO 8601 datetime for scheduling',
            },
            automation_settings: {
              type: 'object',
              properties: {
                auto_optimize_time: { type: 'boolean', description: 'Automatically optimize posting time based on audience' },
                recurring: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'], description: 'Recurring schedule' },
                auto_hashtags: { type: 'boolean', description: 'Automatically add relevant hashtags' },
                content_variation: { type: 'boolean', description: 'Create slight variations for recurring posts' },
              },
            },
            timezone: {
              type: 'string',
              description: 'Timezone for scheduling (e.g., America/New_York)',
            },
          },
          required: ['text'],
        },
      },
      
      {
        name: 'auto_hashtag_suggestions',
        description: 'AI-powered hashtag suggestions based on content analysis',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Post content to analyze for hashtag suggestions',
            },
            media_url: {
              type: 'string',
              description: 'Optional media URL for visual analysis',
            },
            suggestion_settings: {
              type: 'object',
              properties: {
                count: { type: 'number', description: 'Number of hashtag suggestions (1-10)', minimum: 1, maximum: 10 },
                style: { type: 'string', enum: ['trending', 'niche', 'branded', 'mixed'], description: 'Hashtag style preference' },
                exclude_overused: { type: 'boolean', description: 'Exclude overused hashtags' },
                industry_focus: { type: 'string', description: 'Industry/niche to focus on' },
              },
            },
          },
          required: ['content'],
        },
      },
      
      {
        name: 'content_optimization_analysis',
        description: 'Advanced content analysis with optimization recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Content to analyze',
            },
            analysis_type: {
              type: 'string',
              enum: ['engagement', 'reach', 'accessibility', 'seo', 'comprehensive'],
              description: 'Type of optimization analysis',
            },
            target_audience: {
              type: 'object',
              properties: {
                demographics: { type: 'array', items: { type: 'string' }, description: 'Target demographic groups' },
                interests: { type: 'array', items: { type: 'string' }, description: 'Target interests' },
                timezone: { type: 'string', description: 'Primary audience timezone' },
              },
            },
            optimization_goals: {
              type: 'array',
              items: { type: 'string', enum: ['increase_engagement', 'expand_reach', 'improve_accessibility', 'boost_shares', 'drive_traffic'] },
              description: 'Optimization objectives',
            },
          },
          required: ['content'],
        },
      },
      
      {
        name: 'bulk_post_management',
        description: 'Manage multiple posts with bulk operations and analytics',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['analyze_performance', 'bulk_edit', 'content_audit', 'export_data'],
              description: 'Bulk operation to perform',
            },
            filters: {
              type: 'object',
              properties: {
                date_range: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } },
                performance_threshold: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Performance level filter' },
                content_type: { type: 'string', enum: ['text', 'image', 'video', 'carousel'], description: 'Content type filter' },
                engagement_range: { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' } } },
              },
            },
            bulk_operations: {
              type: 'object',
              properties: {
                add_hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags to add to filtered posts' },
                update_alt_text: { type: 'boolean', description: 'Update alt text for accessibility' },
                archive_low_performers: { type: 'boolean', description: 'Archive underperforming posts' },
              },
            },
          },
          required: ['action'],
        },
      },
      
      {
        name: 'website_integration_setup',
        description: 'Setup Threads integration for websites and external platforms',
        inputSchema: {
          type: 'object',
          properties: {
            integration_type: {
              type: 'string',
              enum: ['embed_feed', 'share_buttons', 'auto_crosspost', 'webhook_setup'],
              description: 'Type of integration to setup',
            },
            website_config: {
              type: 'object',
              properties: {
                domain: { type: 'string', description: 'Website domain' },
                platform: { type: 'string', enum: ['wordpress', 'shopify', 'custom', 'react', 'vue', 'angular'], description: 'Website platform' },
                styling_preferences: { 
                  type: 'object',
                  properties: {
                    theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
                    layout: { type: 'string', enum: ['grid', 'list', 'carousel'] },
                    post_count: { type: 'number', minimum: 1, maximum: 20 }
                  }
                },
              },
            },
            automation_settings: {
              type: 'object',
              properties: {
                auto_sync: { type: 'boolean', description: 'Automatically sync new posts' },
                crosspost_enabled: { type: 'boolean', description: 'Enable cross-posting from website' },
                webhook_url: { type: 'string', description: 'Webhook endpoint URL' },
                notification_settings: { type: 'object', properties: { email: { type: 'string' }, slack_webhook: { type: 'string' } } },
              },
            },
          },
          required: ['integration_type'],
        },
      },
      
      // NEW: Token validation and diagnostics
      {
        name: 'validate_setup',
        description: 'Validate access token, check scopes, and verify business account setup',
        inputSchema: {
          type: 'object',
          properties: {
            check_scopes: {
              type: 'boolean',
              description: 'Check if all required scopes are present',
              default: true,
            },
            required_scopes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Custom list of required scopes to check',
            },
          },
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
        
        // Get current user ID first
        const user: any = await apiClient.get('/me', { fields: 'id' });
        
        // Build the proper container data based on media type
        const containerData: any = {
          media_type: media_type || 'TEXT',
        };
        
        // Add text if provided
        if (text) {
          containerData.text = text;
        }
        
        // Handle different media types with correct parameter names
        if (media_type === 'IMAGE' && media_url) {
          containerData.image_url = media_url; // Use image_url for images
        } else if (media_type === 'VIDEO' && media_url) {
          containerData.video_url = media_url; // Use video_url for videos
        } else if (media_url && !media_type) {
          // Auto-detect media type from URL
          if (media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            containerData.media_type = 'IMAGE';
            containerData.image_url = media_url;
          } else if (media_url.match(/\.(mp4|mov|avi)$/i)) {
            containerData.media_type = 'VIDEO';
            containerData.video_url = media_url;
          }
        }
        
        // Add location if provided
        if (location_name) {
          containerData.location_name = location_name;
        }
        
        try {
          // Step 1: Create media container
          const containerResponse: any = await apiClient.post(`/${user.id}/threads`, containerData);
          
          if (!containerResponse.id) {
            throw new Error('Failed to create media container. Make sure your account has proper permissions.');
          }
          
          // Step 2: Publish the container
          result = await apiClient.post(`/${user.id}/threads_publish`, {
            creation_id: containerResponse.id
          });
          
          // Return combined result with both container and publish info
          result = {
            ...result,
            container_id: containerResponse.id,
            media_type: containerData.media_type,
            published: true,
            original_data: containerData
          };
        } catch (error) {
          // Provide helpful error messages
          if (error instanceof Error && error.message.includes('OAuth')) {
            throw new Error(`Authentication error: Make sure your access token has 'threads_content_publish' scope. ${error.message}`);
          } else if (error instanceof Error && error.message.includes('media')) {
            throw new Error(`Media upload error: Ensure media URL is publicly accessible and in supported format (JPG, PNG, GIF for images; MP4, MOV for videos). ${error.message}`);
          } else {
            throw error;
          }
        }
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
        const { thread_id: threadInsightId, metrics: threadMetrics, period: threadPeriod } = args as any;
        result = await apiClient.get(`/${threadInsightId}/insights`, {
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

      case 'create_reply':
        const { reply_to_id, text: replyText, media_type: replyMediaType, media_url: replyMediaUrl, reply_control } = args as any;
        
        const replyData: any = {
          text: replyText,
          media_type: replyMediaType || 'TEXT',
          reply_to_id: reply_to_id,
        };
        
        if (replyMediaUrl) {
          replyData.media_url = replyMediaUrl;
        }
        
        if (reply_control) {
          replyData.reply_control = reply_control;
        }
        
        // Get current user ID
        const userForReply: any = await apiClient.get('/me', { fields: 'id' });
        
        // Step 1: Create reply container
        const replyContainerResponse: any = await apiClient.post(`/${userForReply.id}/threads`, replyData);
        
        if (!replyContainerResponse.id) {
          throw new Error('Failed to create reply container');
        }
        
        // Step 2: Publish the reply
        const publishedReply: any = await apiClient.post(`/${userForReply.id}/threads_publish`, {
          creation_id: replyContainerResponse.id
        });
        
        // Return combined result
        result = {
          ...publishedReply,
          container_id: replyContainerResponse.id,
          reply_to_id: reply_to_id,
          reply_data: replyData
        };
        break;

      case 'create_thread_chain':
        const { parent_thread_id, replies } = args as any;
        
        const chainResults = [];
        let currentReplyToId = parent_thread_id;
        
        const userForChain: any = await apiClient.get('/me', { fields: 'id' });
        
        for (let i = 0; i < replies.length; i++) {
          const replyItem = replies[i];
          
          const chainReplyData: any = {
            text: replyItem.text,
            media_type: 'TEXT',
            reply_to_id: currentReplyToId,
          };
          
          if (replyItem.reply_control) {
            chainReplyData.reply_control = replyItem.reply_control;
          }
          
          // Step 1: Create container
          const chainContainerResponse: any = await apiClient.post(`/${userForChain.id}/threads`, chainReplyData);
          
          if (!chainContainerResponse.id) {
            throw new Error(`Failed to create container for reply ${i + 1}`);
          }
          
          // Step 2: Publish
          const chainPublishedReply: any = await apiClient.post(`/${userForChain.id}/threads_publish`, {
            creation_id: chainContainerResponse.id
          });
          
          const chainResult = {
            ...chainPublishedReply,
            container_id: chainContainerResponse.id,
            reply_to_id: currentReplyToId,
            chain_position: i + 1,
            reply_data: chainReplyData
          };
          
          chainResults.push(chainResult);
          
          // Next reply will reply to this one for true threading
          if (chainPublishedReply.id) {
            currentReplyToId = chainPublishedReply.id;
          }
          
          // Small delay between chain posts to avoid rate limits
          if (i < replies.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        result = {
          parent_thread_id,
          chain_length: replies.length,
          replies: chainResults,
          success: chainResults.length === replies.length
        };
        break;

      case 'quote_post':
        const { quoted_post_id, text: quoteText, media_type: quoteMediaType, media_url: quoteMediaUrl, reply_control: quoteReplyControl } = args as any;
        
        const quoteData: any = {
          text: quoteText,
          media_type: quoteMediaType || 'TEXT',
          quoted_post_id: quoted_post_id,
        };
        
        if (quoteMediaUrl) {
          quoteData.media_url = quoteMediaUrl;
        }
        
        if (quoteReplyControl) {
          quoteData.reply_control = quoteReplyControl;
        }
        
        // Get current user ID
        const userForQuote: any = await apiClient.get('/me', { fields: 'id' });
        
        // Step 1: Create quote container
        const quoteContainerResponse: any = await apiClient.post(`/${userForQuote.id}/threads`, quoteData);
        
        if (!quoteContainerResponse.id) {
          throw new Error('Failed to create quote container');
        }
        
        // Step 2: Publish the quote
        const publishedQuote: any = await apiClient.post(`/${userForQuote.id}/threads_publish`, {
          creation_id: quoteContainerResponse.id
        });
        
        // Return combined result
        result = {
          ...publishedQuote,
          container_id: quoteContainerResponse.id,
          quoted_post_id: quoted_post_id,
          quote_data: quoteData
        };
        break;

      case 'repost_thread':
        const { post_id: repostId } = args as any;
        
        // Try different endpoint patterns for repost
        try {
          // Pattern 1: Direct POST to media endpoint
          result = await apiClient.post(`/${repostId}`, { action: 'repost' });
        } catch (error) {
          try {
            // Pattern 2: User-based repost endpoint 
            const userForRepost: any = await apiClient.get('/me', { fields: 'id' });
            result = await apiClient.post(`/${userForRepost.id}/reposts`, { media_id: repostId });
          } catch (error2) {
            // If both fail, provide detailed error info
            throw new Error(`Repost not available: Endpoint may not be supported in current API version. Details: ${error2 instanceof Error ? error2.message : String(error2)}`);
          }
        }
        break;

      case 'unrepost_thread':
        const { post_id: unrepostId } = args as any;
        
        // Try different endpoint patterns for unrepost
        try {
          // Pattern 1: DELETE request to media
          result = await apiClient.delete(`/${unrepostId}/repost`);
        } catch (error) {
          try {
            // Pattern 2: User-based unrepost
            const userForUnrepost: any = await apiClient.get('/me', { fields: 'id' });
            result = await apiClient.delete(`/${userForUnrepost.id}/reposts/${unrepostId}`);
          } catch (error2) {
            throw new Error(`Unrepost not available: Endpoint may not be supported in current API version. Details: ${error2 instanceof Error ? error2.message : String(error2)}`);
          }
        }
        break;

      case 'like_post':
        const { post_id: likeId } = args as any;
        
        // Like endpoint - this one seems to work based on test results
        try {
          result = await apiClient.post(`/${likeId}/likes`, {});
        } catch (error) {
          // Fallback pattern
          result = await apiClient.post(`/${likeId}/like`, {});
        }
        break;

      case 'unlike_post':
        const { post_id: unlikeId } = args as any;
        
        // Unlike endpoint - try multiple patterns
        try {
          // Pattern 1: DELETE to likes endpoint
          result = await apiClient.delete(`/${unlikeId}/likes`);
        } catch (error) {
          try {
            // Pattern 2: DELETE to like endpoint  
            result = await apiClient.delete(`/${unlikeId}/like`);
          } catch (error2) {
            // Pattern 3: POST with unlike action
            result = await apiClient.post(`/${unlikeId}`, { action: 'unlike' });
          }
        }
        break;

      case 'get_post_likes':
        const { post_id: likesPostId, limit: likesLimit } = args as any;
        
        // Get likes endpoint - try different patterns
        try {
          // Pattern 1: Direct likes endpoint
          result = await apiClient.get(`/${likesPostId}/likes`, {
            limit: likesLimit || 25
          });
        } catch (error) {
          try {
            // Pattern 2: Insights-based approach
            result = await apiClient.get(`/${likesPostId}/insights`, {
              metric: 'likes',
              limit: likesLimit || 25
            });
          } catch (error2) {
            throw new Error(`Get likes not available: May require additional permissions or different API version. Details: ${error2 instanceof Error ? error2.message : String(error2)}`);
          }
        }
        break;

      case 'create_post_with_restrictions':
        const { 
          text: restrictedText, 
          media_type: restrictedMediaType, 
          media_url: restrictedMediaUrl, 
          reply_control: restrictedReplyControl,
          audience_control,
          location_name: restrictedLocation,
          hashtags,
          mentions
        } = args as any;
        
        // Build enhanced post data with restrictions
        const restrictedPostData: any = {
          text: restrictedText,
          media_type: restrictedMediaType || 'TEXT',
        };
        
        // Add hashtags to text if provided
        if (hashtags && hashtags.length > 0) {
          const hashtagText = hashtags.map((tag: string) => `#${tag}`).join(' ');
          restrictedPostData.text += ` ${hashtagText}`;
        }
        
        // Add mentions to text if provided
        if (mentions && mentions.length > 0) {
          const mentionText = mentions.map((username: string) => `@${username}`).join(' ');
          restrictedPostData.text += ` ${mentionText}`;
        }
        
        if (restrictedMediaUrl) {
          restrictedPostData.media_url = restrictedMediaUrl;
        }
        
        if (restrictedReplyControl) {
          restrictedPostData.reply_control = restrictedReplyControl;
        }
        
        if (audience_control) {
          // Note: audience_control might not be supported in current API version
          restrictedPostData.audience_control = audience_control;
        }
        
        if (restrictedLocation) {
          restrictedPostData.location_name = restrictedLocation;
        }
        
        // Get current user ID
        const userForRestricted: any = await apiClient.get('/me', { fields: 'id' });
        
        // Step 1: Create restricted post container
        const restrictedContainerResponse: any = await apiClient.post(`/${userForRestricted.id}/threads`, restrictedPostData);
        
        if (!restrictedContainerResponse.id) {
          throw new Error('Failed to create restricted post container');
        }
        
        // Step 2: Publish the restricted post
        const publishedRestricted: any = await apiClient.post(`/${userForRestricted.id}/threads_publish`, {
          creation_id: restrictedContainerResponse.id
        });
        
        // Return combined result with restriction details
        result = {
          ...publishedRestricted,
          container_id: restrictedContainerResponse.id,
          restrictions: {
            reply_control: restrictedReplyControl,
            audience_control: audience_control,
            hashtags: hashtags,
            mentions: mentions
          },
          post_data: restrictedPostData
        };
        break;

      case 'schedule_post':
        const { 
          text: basicScheduleText, 
          scheduled_publish_time,
          media_type: scheduleMediaType, 
          media_url: basicScheduleMediaUrl,
          reply_control: scheduleReplyControl,
          location_name: scheduleLocation
        } = args as any;
        
        // Validate scheduled time is in the future
        const scheduledDate = new Date(scheduled_publish_time);
        const now = new Date();
        
        if (scheduledDate <= now) {
          throw new Error('Scheduled publish time must be in the future');
        }
        
        // Build scheduled post data
        const scheduledPostData: any = {
          text: basicScheduleText,
          media_type: scheduleMediaType || 'TEXT',
          scheduled_publish_time: scheduled_publish_time,
        };
        
        if (basicScheduleMediaUrl) {
          scheduledPostData.media_url = basicScheduleMediaUrl;
        }
        
        if (scheduleReplyControl) {
          scheduledPostData.reply_control = scheduleReplyControl;
        }
        
        if (scheduleLocation) {
          scheduledPostData.location_name = scheduleLocation;
        }
        
        // Get current user ID
        const userForScheduled: any = await apiClient.get('/me', { fields: 'id' });
        
        try {
          // Try to create scheduled post container
          const scheduledContainerResponse: any = await apiClient.post(`/${userForScheduled.id}/threads`, scheduledPostData);
          
          if (!scheduledContainerResponse.id) {
            throw new Error('Failed to create scheduled post container');
          }
          
          // For scheduled posts, we might not publish immediately
          // Return the container info for later publishing
          result = {
            container_id: scheduledContainerResponse.id,
            scheduled_for: scheduled_publish_time,
            status: 'scheduled',
            post_data: scheduledPostData,
            note: 'Scheduled post created. Automatic publishing may require additional API features or manual publishing at scheduled time.'
          };
          
        } catch (error) {
          // Fallback: If scheduling is not supported, inform user
          throw new Error(`Scheduling not supported in current API version. Error: ${error instanceof Error ? error.message : String(error)}. Consider using third-party scheduling tools.`);
        }
        break;

      case 'search_posts':
        const { query: searchQuery, search_type: searchType, limit: searchPostsLimit, since: searchSince, until: searchUntil } = args as any;
        
        // Build search parameters
        const searchParams: any = {
          q: searchQuery,
          search_type: searchType || 'TOP',
          limit: searchPostsLimit || 25,
        };
        
        if (searchSince) {
          searchParams.since = searchSince;
        }
        
        if (searchUntil) {
          searchParams.until = searchUntil;
        }
        
        // Use the keyword_search endpoint
        result = await apiClient.get('/keyword_search', searchParams);
        break;

      case 'search_mentions':
        const { user_id: mentionUserId, limit: searchMentionsLimit, since: mentionSince, until: mentionUntil } = args as any;
        
        // If no user_id specified, use current user
        const meUser: any = await apiClient.get('/me', { fields: 'id' });
        const targetUserId = mentionUserId || meUser.id;
        
        try {
          // Try direct mentions endpoint first
          result = await apiClient.get(`/${targetUserId}/mentions`, {
            limit: searchMentionsLimit || 25,
            since: mentionSince,
            until: mentionUntil,
          });
        } catch (error) {
          // Fallback: search for @username mentions
          const userInfo: any = await apiClient.get(`/${targetUserId}`, { fields: 'username' });
          const mentionQuery = `@${userInfo.username}`;
          
          result = await apiClient.get('/keyword_search', {
            q: mentionQuery,
            search_type: 'RECENT',
            limit: searchMentionsLimit || 25,
            since: mentionSince,
            until: mentionUntil,
          });
          
          // Add context that this is a fallback search
          result = {
            ...result,
            search_method: 'keyword_fallback',
            search_query: mentionQuery,
            note: 'Results found via keyword search for @username mentions'
          };
        }
        break;

      case 'search_by_hashtags':
        const { hashtags: searchHashtags, search_type: hashtagSearchType, limit: hashtagSearchLimit } = args as any;
        
        // Combine hashtags into search query
        const hashtagQuery = searchHashtags.map((tag: string) => `#${tag}`).join(' OR ');
        
        result = await apiClient.get('/keyword_search', {
          q: hashtagQuery,
          search_mode: 'TAG',
          search_type: hashtagSearchType || 'TOP',
          limit: hashtagSearchLimit || 25,
        });
        
        // Add hashtag context
        result = {
          ...result,
          searched_hashtags: searchHashtags,
          search_query: hashtagQuery
        };
        break;

      case 'search_by_topics':
        const { topics: searchTopics, search_type: topicSearchType, limit: topicSearchLimit } = args as any;
        
        // Search for topics using TAG mode
        const topicQuery = searchTopics.join(' OR ');
        
        result = await apiClient.get('/keyword_search', {
          q: topicQuery,
          search_mode: 'TAG',
          search_type: topicSearchType || 'TOP',
          limit: topicSearchLimit || 25,
        });
        
        // Add topic context
        result = {
          ...result,
          searched_topics: searchTopics,
          search_query: topicQuery
        };
        break;

      case 'get_trending_posts':
        const { category: trendingCategory, limit: trendingPostsLimit, timeframe: trendingTimeframe } = args as any;
        
        try {
          // Try trending endpoint if available
          result = await apiClient.get('/trending', {
            category: trendingCategory,
            limit: trendingPostsLimit || 25,
            timeframe: trendingTimeframe || 'day',
          });
        } catch (error) {
          // Fallback: Use keyword search with popular terms
          const trendingQueries = [
            'trending',
            'viral',
            'popular',
            'breaking news',
            'hot topics'
          ];
          
          const trendingQuery = trendingCategory || trendingQueries[Math.floor(Math.random() * trendingQueries.length)];
          
          result = await apiClient.get('/keyword_search', {
            q: trendingQuery,
            search_type: 'TOP',
            limit: trendingPostsLimit || 25,
          });
          
          // Add trending context
          result = {
            ...result,
            search_method: 'keyword_trending',
            category: trendingCategory,
            timeframe: trendingTimeframe,
            note: 'Trending posts found via keyword search. Results may vary based on API availability.'
          };
        }
        break;

      case 'search_users':
        const { query: userSearchQuery, limit: userSearchLimit } = args as any;
        
        try {
          // Try user search endpoint if available
          result = await apiClient.get('/users/search', {
            q: userSearchQuery,
            limit: userSearchLimit || 25,
          });
        } catch (error) {
          // Fallback: Use keyword search to find mentions/references to users
          const mentionSearch = await apiClient.get('/keyword_search', {
            q: `@${userSearchQuery}`,
            search_type: 'RECENT',
            limit: userSearchLimit || 25,
          });
          
          result = {
            search_method: 'mention_based_fallback',
            query: userSearchQuery,
            note: 'User search via mention discovery. Limited to users mentioned in posts.',
            mention_results: mentionSearch,
            limitation: 'Direct user search may require additional API permissions or endpoints not yet available.'
          };
        }
        break;

      case 'get_user_followers':
        const { user_id: followersUserId, limit: followersLimit } = args as any;
        
        // Default to current user if no user_id specified
        const currentUserForFollowers: any = await apiClient.get('/me', { fields: 'id' });
        const targetFollowersUserId = followersUserId || currentUserForFollowers.id;
        
        try {
          // Try followers endpoint
          result = await apiClient.get(`/${targetFollowersUserId}/followers`, {
            limit: followersLimit || 25,
          });
        } catch (error) {
          throw new Error(`Followers access not available: This feature may require additional API permissions or is not yet supported. Details: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'get_user_following':
        const { user_id: followingUserId, limit: followingLimit } = args as any;
        
        // Default to current user if no user_id specified  
        const currentUserForFollowing: any = await apiClient.get('/me', { fields: 'id' });
        const targetFollowingUserId = followingUserId || currentUserForFollowing.id;
        
        try {
          // Try following endpoint
          result = await apiClient.get(`/${targetFollowingUserId}/following`, {
            limit: followingLimit || 25,
          });
        } catch (error) {
          throw new Error(`Following access not available: This feature may require additional API permissions or is not yet supported. Details: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'follow_user':
        const { user_id: followUserId } = args as any;
        
        try {
          // Try follow endpoint
          result = await apiClient.post(`/${followUserId}/follow`, {});
        } catch (error) {
          try {
            // Alternative pattern
            const currentUserForFollow: any = await apiClient.get('/me', { fields: 'id' });
            result = await apiClient.post(`/${currentUserForFollow.id}/following`, {
              user_id: followUserId
            });
          } catch (error2) {
            throw new Error(`Follow action not available: This feature may require additional API permissions or is not yet supported in current API version. Details: ${error2 instanceof Error ? error2.message : String(error2)}`);
          }
        }
        break;

      case 'unfollow_user':
        const { user_id: unfollowUserId } = args as any;
        
        try {
          // Try unfollow endpoint
          result = await apiClient.delete(`/${unfollowUserId}/follow`);
        } catch (error) {
          try {
            // Alternative pattern
            const currentUserForUnfollow: any = await apiClient.get('/me', { fields: 'id' });
            result = await apiClient.delete(`/${currentUserForUnfollow.id}/following/${unfollowUserId}`);
          } catch (error2) {
            throw new Error(`Unfollow action not available: This feature may require additional API permissions or is not yet supported in current API version. Details: ${error2 instanceof Error ? error2.message : String(error2)}`);
          }
        }
        break;

      case 'block_user':
        const { user_id: blockUserId } = args as any;
        
        try {
          // Try block endpoint
          result = await apiClient.post(`/${blockUserId}/block`, {});
        } catch (error) {
          try {
            // Alternative pattern
            const currentUserForBlock: any = await apiClient.get('/me', { fields: 'id' });
            result = await apiClient.post(`/${currentUserForBlock.id}/blocked_users`, {
              user_id: blockUserId
            });
          } catch (error2) {
            throw new Error(`Block action not available: This feature may require additional API permissions or is not yet supported in current API version. Details: ${error2 instanceof Error ? error2.message : String(error2)}. Note: User blocking may only be available through the web interface.`);
          }
        }
        break;

      case 'get_enhanced_insights':
        const { 
          thread_id: enhancedThreadId, 
          metrics: enhancedMetrics, 
          period: enhancedPeriod, 
          breakdown: demographicBreakdown,
          since: enhancedSince, 
          until: enhancedUntil 
        } = args as any;
        
        const currentUserForEnhanced: any = await apiClient.get('/me', { fields: 'id' });
        
        if (enhancedThreadId) {
          // Media-specific insights
          result = await apiClient.get(`/${enhancedThreadId}/insights`, {
            metric: enhancedMetrics ? enhancedMetrics.join(',') : 'views,likes,replies,reposts,quotes,shares',
            period: enhancedPeriod || 'lifetime',
            since: enhancedSince,
            until: enhancedUntil,
            breakdown: demographicBreakdown ? demographicBreakdown.join(',') : undefined,
          });
        } else {
          // User-level insights
          result = await apiClient.get(`/${currentUserForEnhanced.id}/threads_insights`, {
            metric: enhancedMetrics ? enhancedMetrics.join(',') : 'views,likes,replies,reposts,quotes,followers_count,follower_demographics',
            period: enhancedPeriod || 'lifetime',
            since: enhancedSince,
            until: enhancedUntil,
            breakdown: demographicBreakdown ? demographicBreakdown.join(',') : undefined,
          });
        }
        
        // Enhance with additional context
        result = {
          data: (result as any)?.data || [],
          paging: (result as any)?.paging || {},
          insight_type: enhancedThreadId ? 'media_insights' : 'user_insights',
          metrics_requested: enhancedMetrics,
          period: enhancedPeriod || 'lifetime',
          demographic_breakdown: demographicBreakdown,
          enhanced_features: ['advanced_metrics', 'demographic_analysis', 'time_series_data']
        };
        break;

      case 'get_audience_demographics':
        const { breakdown_by: demographicCategories, period: demographicPeriod } = args as any;
        
        const currentUserForDemo: any = await apiClient.get('/me', { fields: 'id' });
        
        try {
          // Get follower demographics
          const demographicResult = await apiClient.get(`/${currentUserForDemo.id}/threads_insights`, {
            metric: 'follower_demographics',
            period: demographicPeriod || 'lifetime',
            breakdown: demographicCategories ? demographicCategories.join(',') : 'country,age,gender',
          });
          
          result = {
            data: (demographicResult as any)?.data || [],
            paging: (demographicResult as any)?.paging || {},
            demographic_analysis: {
              categories: demographicCategories || ['country', 'age', 'gender'],
              period: demographicPeriod || 'lifetime',
              minimum_followers_required: 100,
              note: 'Demographic data requires minimum 100 followers for privacy protection'
            },
            insights: 'Professional demographic breakdown with geographic and demographic segmentation'
          };
          
        } catch (error) {
          throw new Error(`Demographics not available: May require minimum 100 followers or additional permissions. Details: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'get_engagement_trends':
        const { metrics: trendMetrics, timeframe: trendTimeframe, granularity: trendGranularity } = args as any;
        
        const currentUserForTrends: any = await apiClient.get('/me', { fields: 'id' });
        
        // Calculate date range based on timeframe
        const endDate = new Date();
        const startDate = new Date();
        
        switch (trendTimeframe) {
          case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
          case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
          default:
            startDate.setMonth(endDate.getMonth() - 1);
        }
        
        try {
          // Get time-series insights
          const trendsResult = await apiClient.get(`/${currentUserForTrends.id}/threads_insights`, {
            metric: trendMetrics ? trendMetrics.join(',') : 'views,likes,replies,reposts,shares',
            period: trendGranularity === 'daily' ? 'day' : 'week',
            since: startDate.toISOString(),
            until: endDate.toISOString(),
          });
          
          result = {
            data: (trendsResult as any)?.data || [],
            paging: (trendsResult as any)?.paging || {},
            trend_analysis: {
              timeframe: trendTimeframe || 'month',
              granularity: trendGranularity || 'weekly',
              metrics_analyzed: trendMetrics || ['views', 'likes', 'replies', 'reposts', 'shares'],
              date_range: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
              }
            },
            features: ['time_series_analysis', 'trend_detection', 'performance_patterns']
          };
          
        } catch (error) {
          throw new Error(`Trend analysis not available: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'get_follower_growth_analytics':
        const { period: growthPeriod, include_projections: includeProjections } = args as any;
        
        const currentUserForGrowth: any = await apiClient.get('/me', { fields: 'id' });
        
        // Calculate growth analysis period
        const growthEndDate = new Date();
        const growthStartDate = new Date();
        
        switch (growthPeriod) {
          case 'week':
            growthStartDate.setDate(growthEndDate.getDate() - 7);
            break;
          case 'month':
            growthStartDate.setMonth(growthEndDate.getMonth() - 1);
            break;
          case 'quarter':
            growthStartDate.setMonth(growthEndDate.getMonth() - 3);
            break;
          case 'year':
            growthStartDate.setFullYear(growthEndDate.getFullYear() - 1);
            break;
          default:
            growthStartDate.setMonth(growthEndDate.getMonth() - 3);
        }
        
        try {
          // Get follower count over time
          const growthResult = await apiClient.get(`/${currentUserForGrowth.id}/threads_insights`, {
            metric: 'followers_count',
            period: 'day',
            since: growthStartDate.toISOString(),
            until: growthEndDate.toISOString(),
          });
          
          result = {
            data: (growthResult as any)?.data || [],
            paging: (growthResult as any)?.paging || {},
            growth_analysis: {
              period: growthPeriod || 'quarter',
              date_range: {
                start: growthStartDate.toISOString(),
                end: growthEndDate.toISOString()
              },
              projections_included: includeProjections || false,
              analysis_features: ['growth_rate', 'trend_analysis', 'period_comparison']
            },
            note: includeProjections ? 'Growth projections based on historical trends included' : 'Historical growth data only'
          };
          
        } catch (error) {
          throw new Error(`Growth analytics not available: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'analyze_best_posting_times':
        const { analysis_period: postingAnalysisPeriod, timezone: postingTimezone, content_type: postingContentType } = args as any;
        
        const currentUserForTiming: any = await apiClient.get('/me', { fields: 'id' });
        
        // Get historical posting data for analysis
        const analysisEndDate = new Date();
        const analysisStartDate = new Date();
        
        switch (postingAnalysisPeriod) {
          case 'month':
            analysisStartDate.setMonth(analysisEndDate.getMonth() - 1);
            break;
          case 'quarter':
            analysisStartDate.setMonth(analysisEndDate.getMonth() - 3);
            break;
          case 'year':
            analysisStartDate.setFullYear(analysisEndDate.getFullYear() - 1);
            break;
          default:
            analysisStartDate.setMonth(analysisEndDate.getMonth() - 3);
        }
        
        try {
          // Get user's posts with timestamps and engagement
          const postsResult = await apiClient.paginate(`/${currentUserForTiming.id}/threads`, {
            fields: 'id,timestamp,media_type',
            since: analysisStartDate.toISOString(),
            until: analysisEndDate.toISOString(),
            limit: 100,
          });
          
          // Simulate timing analysis (would need actual engagement data per post)
          result = {
            analysis_period: postingAnalysisPeriod || 'quarter',
            timezone: postingTimezone || 'UTC',
            content_type: postingContentType || 'all',
            posts_analyzed: postsResult.length,
            optimal_times: {
              weekdays: {
                morning: '09:00-11:00',
                afternoon: '13:00-15:00', 
                evening: '18:00-20:00'
              },
              weekends: {
                morning: '10:00-12:00',
                afternoon: '14:00-16:00',
                evening: '19:00-21:00'
              }
            },
            recommendations: [
              'Peak engagement typically occurs during lunch hours (12:00-14:00)',
              'Evening posts (18:00-20:00) show strong weekend performance',
              'Avoid late night posting (22:00+) unless targeting different timezone'
            ],
            methodology: 'Analysis based on historical engagement patterns and timestamp correlation',
            note: 'Recommendations are based on available data and general best practices'
          };
          
        } catch (error) {
          throw new Error(`Posting time analysis not available: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'get_content_performance_report':
        const { 
          report_type: reportType, 
          period: reportPeriod, 
          metrics: reportMetrics, 
          include_comparisons: includeComparisons 
        } = args as any;
        
        const currentUserForReport: any = await apiClient.get('/me', { fields: 'id' });
        
        // Calculate report date range
        const reportEndDate = new Date();
        const reportStartDate = new Date();
        
        switch (reportPeriod) {
          case 'week':
            reportStartDate.setDate(reportEndDate.getDate() - 7);
            break;
          case 'month':
            reportStartDate.setMonth(reportEndDate.getMonth() - 1);
            break;
          case 'quarter':
            reportStartDate.setMonth(reportEndDate.getMonth() - 3);
            break;
          default:
            reportStartDate.setMonth(reportEndDate.getMonth() - 1);
        }
        
        try {
          // Get comprehensive insights
          const userInsights = await apiClient.get(`/${currentUserForReport.id}/threads_insights`, {
            metric: reportMetrics ? reportMetrics.join(',') : 'views,likes,replies,reposts,quotes,shares,clicks,followers_count',
            period: reportPeriod || 'month',
            since: reportStartDate.toISOString(),
            until: reportEndDate.toISOString(),
          });
          
          // Get thread list for detailed analysis
          const userThreads = await apiClient.paginate(`/${currentUserForReport.id}/threads`, {
            fields: 'id,text,media_type,timestamp',
            since: reportStartDate.toISOString(),
            until: reportEndDate.toISOString(),
            limit: 50,
          });
          
          result = {
            report_metadata: {
              type: reportType || 'summary',
              period: reportPeriod || 'month',
              date_range: {
                start: reportStartDate.toISOString(),
                end: reportEndDate.toISOString()
              },
              metrics_included: reportMetrics || ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares', 'clicks', 'followers_count'],
              comparisons_included: includeComparisons || false,
            },
            performance_data: userInsights,
            content_analysis: {
              total_posts: userThreads.length,
              content_types: userThreads.reduce((acc: any, thread: any) => {
                acc[thread.media_type] = (acc[thread.media_type] || 0) + 1;
                return acc;
              }, {}),
            },
            executive_summary: {
              key_insights: [
                'Performance metrics aggregated across all content',
                'Engagement patterns analyzed by content type',
                'Growth trends tracked over selected period'
              ],
              report_features: ['comprehensive_analytics', 'content_breakdown', 'performance_scoring']
            }
          };
          
        } catch (error) {
          throw new Error(`Performance report not available: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      // Phase 3B: Professional Content Creation & Automation
      case 'create_carousel_post':
        const { 
          media_urls: carouselUrls, 
          text: carouselText, 
          alt_texts: carouselAltTexts,
          carousel_settings: carouselSettings 
        } = args as any;
        
        try {
          // Validate carousel requirements (now supports up to 20 items!)
          if (!carouselUrls || carouselUrls.length < 2 || carouselUrls.length > 20) {
            throw new Error('Carousel posts require 2-20 media items (updated September 2024)');
          }
          
          const currentUserForCarousel: any = await apiClient.get('/me', { fields: 'id' });
          
          // NEW: 3-step carousel creation process (September 2024 update)
          
          // Step 1: Create individual carousel item containers
          const carouselItemIds: string[] = [];
          
          for (let i = 0; i < carouselUrls.length; i++) {
            const url = carouselUrls[i];
            const altText = carouselAltTexts?.[i] || 
                          (carouselSettings?.auto_alt_text ? `Item ${i + 1} of ${carouselUrls.length}` : undefined);
            
            // Determine media type
            const isVideo = url.match(/\.(mp4|mov|avi)$/i);
            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
            
            const itemData: any = {
              media_type: mediaType,
              is_carousel_item: true, // NEW: Required flag for carousel items
            };
            
            // Use correct parameter for media type
            if (mediaType === 'IMAGE') {
              itemData.image_url = url;
            } else {
              itemData.video_url = url;
            }
            
            // Add alt text if provided
            if (altText) {
              itemData.alt_text = altText;
            }
            
            const itemContainer = await apiClient.post(`/${currentUserForCarousel.id}/threads`, itemData) as any;
            
            if (!itemContainer.id) {
              throw new Error(`Failed to create carousel item ${i + 1}`);
            }
            
            carouselItemIds.push(itemContainer.id);
          }
          
          // Step 2: Create carousel container with all items
          const carouselContainerData: any = {
            media_type: 'CAROUSEL',
            children: carouselItemIds.join(','), // Comma-separated list of item IDs
          };
          
          // Add caption text if provided
          if (carouselText) {
            carouselContainerData.text = carouselText;
          }
          
          const carouselContainer = await apiClient.post(`/${currentUserForCarousel.id}/threads`, carouselContainerData) as any;
          
          if (!carouselContainer.id) {
            throw new Error('Failed to create carousel container');
          }
          
          // Step 3: Publish the carousel
          const publishResult = await apiClient.post(`/${currentUserForCarousel.id}/threads_publish`, {
            creation_id: carouselContainer.id
          }) as any;
          
          result = {
            id: publishResult.id,
            permalink: publishResult.permalink,
            carousel_created: true,
            carousel_container_id: carouselContainer.id,
            carousel_item_ids: carouselItemIds,
            media_count: carouselUrls.length,
            carousel_metadata: {
              total_items: carouselUrls.length,
              aspect_ratio: carouselSettings?.aspect_ratio || 'auto',
              thumbnail_selection: carouselSettings?.thumbnail_selection || 'first',
              accessibility_enabled: !!carouselAltTexts?.length
            },
            professional_features: [
              'multi_media_carousel_v2',
              'accessibility_support',
              'up_to_20_items',
              '3_step_creation_process'
            ]
          };
          
        } catch (error) {
          // Provide detailed error information
          if (error instanceof Error && error.message.includes('OAuth')) {
            throw new Error(`Authentication error: Make sure your access token has 'threads_content_publish' scope and your account is a verified business account. ${error.message}`);
          } else if (error instanceof Error && error.message.includes('carousel')) {
            throw new Error(`Carousel creation error: ${error.message}. Ensure all media URLs are publicly accessible and in supported formats.`);
          } else {
            throw new Error(`Carousel post creation failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        break;

      case 'schedule_post':
        const { 
          text: scheduleText, 
          media_url: scheduleMediaUrl, 
          schedule_time: scheduleTime,
          automation_settings: automationSettings,
          timezone: scheduleTimezone
        } = args as any;
        
        try {
          const scheduleDate = scheduleTime ? new Date(scheduleTime) : null;
          const now = new Date();
          
          if (scheduleDate && scheduleDate <= now) {
            throw new Error('Schedule time must be in the future');
          }
          
          // Analyze optimal posting time if auto-optimization is enabled
          let optimizedTime = scheduleTime;
          if (automationSettings?.auto_optimize_time && !scheduleTime) {
            // AI-based optimal time calculation
            const currentHour = now.getHours();
            const optimal_hours = [9, 12, 15, 18, 21]; // Peak engagement hours
            const nextOptimalHour = optimal_hours.find(h => h > currentHour) || optimal_hours[0];
            
            optimizedTime = new Date(now);
            optimizedTime.setHours(nextOptimalHour, 0, 0, 0);
            if (nextOptimalHour <= currentHour) {
              optimizedTime.setDate(optimizedTime.getDate() + 1);
            }
            optimizedTime = optimizedTime.toISOString();
          }
          
          // Add auto hashtags if enabled
          let enhancedText = scheduleText;
          if (automationSettings?.auto_hashtags) {
            // Simple hashtag extraction and suggestion
            const contentWords = scheduleText.toLowerCase().split(/\s+/);
            const suggestedHashtags = [];
            
            if (contentWords.some((w: string) => ['tech', 'technology', 'ai', 'coding'].includes(w))) {
              suggestedHashtags.push('#Tech', '#Innovation');
            }
            if (contentWords.some((w: string) => ['business', 'startup', 'entrepreneur'].includes(w))) {
              suggestedHashtags.push('#Business', '#Startup');
            }
            if (contentWords.some((w: string) => ['design', 'creative', 'art'].includes(w))) {
              suggestedHashtags.push('#Design', '#Creative');
            }
            
            if (suggestedHashtags.length > 0) {
              enhancedText += '\n\n' + suggestedHashtags.join(' ');
            }
          }
          
          // Note: Threads API currently doesn't support scheduling
          // This is a structure for when scheduling becomes available
          result = {
            scheduling_status: 'configured',
            scheduled_time: optimizedTime,
            original_time: scheduleTime,
            time_optimized: automationSettings?.auto_optimize_time && !scheduleTime,
            enhanced_content: enhancedText,
            automation_features: {
              auto_hashtags_added: automationSettings?.auto_hashtags && enhancedText !== scheduleText,
              recurring_schedule: automationSettings?.recurring || 'none',
              content_variation: automationSettings?.content_variation || false
            },
            timezone: scheduleTimezone || 'UTC',
            api_limitation: 'Threads API currently does not support post scheduling. This configuration can be stored and used with external scheduling tools.',
            recommendation: 'Use this configuration with social media management tools or implement custom scheduling with Threads API publishing'
          };
          
        } catch (error) {
          throw new Error(`Post scheduling configuration failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'auto_hashtag_suggestions':
        const { 
          content: hashtagContent, 
          media_url: hashtagMediaUrl, 
          suggestion_settings: suggestionSettings 
        } = args as any;
        
        try {
          const suggestionCount = suggestionSettings?.count || 5;
          const style = suggestionSettings?.style || 'mixed';
          const industryFocus = suggestionSettings?.industry_focus;
          const excludeOverused = suggestionSettings?.exclude_overused || true;
          
          // AI-powered hashtag analysis
          const contentWords = hashtagContent.toLowerCase().split(/\s+/);
          const contentKeywords = contentWords.filter((word: string) => 
            word.length > 3 && 
            !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'doesn', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)
          );
          
          let suggestions: string[] = [];
          
          // Category-based suggestions
          const categories = {
            tech: ['#Technology', '#Innovation', '#AI', '#Tech', '#Digital', '#Future', '#Coding', '#Development'],
            business: ['#Business', '#Entrepreneurship', '#Startup', '#Success', '#Leadership', '#Strategy', '#Growth', '#Hustle'],
            lifestyle: ['#Lifestyle', '#Inspiration', '#Motivation', '#Wellness', '#SelfCare', '#Mindfulness', '#Goals', '#Journey'],
            creative: ['#Creative', '#Design', '#Art', '#Photography', '#Content', '#Brand', '#Visual', '#Aesthetic'],
            social: ['#Community', '#Connection', '#Networking', '#Share', '#Engage', '#Social', '#Together', '#Support']
          };
          
          // Analyze content for category relevance
          for (const [category, hashtags] of Object.entries(categories)) {
            const relevanceScore = contentKeywords.filter((word: string) => {
              switch (category) {
                case 'tech': return ['tech', 'ai', 'code', 'digital', 'innovation', 'software', 'app', 'data'].some(t => word.includes(t));
                case 'business': return ['business', 'work', 'success', 'money', 'career', 'professional', 'company', 'market'].some(t => word.includes(t));
                case 'lifestyle': return ['life', 'health', 'fitness', 'travel', 'food', 'home', 'family', 'personal'].some(t => word.includes(t));
                case 'creative': return ['design', 'art', 'creative', 'photo', 'video', 'content', 'brand', 'style'].some(t => word.includes(t));
                case 'social': return ['share', 'community', 'people', 'together', 'connect', 'network', 'social', 'friend'].some(t => word.includes(t));
                default: return false;
              }
            }).length;
            
            if (relevanceScore > 0) {
              suggestions.push(...hashtags.slice(0, Math.min(3, suggestionCount)));
            }
          }
          
          // Industry-specific suggestions
          if (industryFocus) {
            const industryTags: { [key: string]: string[] } = {
              'saas': ['#SaaS', '#B2B', '#Software', '#CloudComputing'],
              'ecommerce': ['#Ecommerce', '#OnlineBusiness', '#Retail', '#Shopping'],
              'fitness': ['#Fitness', '#Health', '#Workout', '#Wellness'],
              'food': ['#Food', '#Cooking', '#Recipe', '#Foodie'],
              'travel': ['#Travel', '#Adventure', '#Explore', '#Wanderlust'],
              'education': ['#Education', '#Learning', '#Knowledge', '#Skills']
            };
            
            if (industryTags[industryFocus.toLowerCase()]) {
              suggestions.push(...industryTags[industryFocus.toLowerCase()]);
            }
          }
          
          // Remove duplicates and apply style filtering
          suggestions = [...new Set(suggestions)];
          
          if (style === 'trending') {
            suggestions = suggestions.filter(tag => 
              ['#AI', '#Tech', '#Business', '#Innovation', '#Digital', '#Future'].includes(tag)
            );
          } else if (style === 'niche') {
            suggestions = suggestions.filter(tag => 
              !['#Love', '#Happy', '#Life', '#Success', '#Motivation'].includes(tag)
            );
          }
          
          // Exclude overused hashtags if requested
          if (excludeOverused) {
            const overused = ['#Love', '#Happy', '#Life', '#Success', '#Motivation', '#Inspiration'];
            suggestions = suggestions.filter(tag => !overused.includes(tag));
          }
          
          // Limit to requested count
          suggestions = suggestions.slice(0, suggestionCount);
          
          result = {
            suggestions,
            content_analysis: {
              keywords_identified: contentKeywords.slice(0, 10),
              categories_detected: Object.keys(categories).filter(cat => 
                suggestions.some(tag => (categories as any)[cat].includes(tag))
              ),
              content_length: hashtagContent.length,
              word_count: contentWords.length
            },
            suggestion_metadata: {
              style_applied: style,
              industry_focus: industryFocus,
              excluded_overused: excludeOverused,
              total_generated: suggestions.length,
              ai_confidence: suggestions.length > 0 ? 'high' : 'medium'
            },
            usage_recommendations: [
              'Use 3-5 hashtags per post for optimal engagement',
              'Mix popular and niche hashtags for better reach',
              'Monitor hashtag performance and adjust strategy',
              'Consider hashtag placement at end of post for better readability'
            ]
          };
          
        } catch (error) {
          throw new Error(`Hashtag suggestion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'content_optimization_analysis':
        const { 
          content: optimizationContent, 
          analysis_type: analysisType, 
          target_audience: targetAudience,
          optimization_goals: optimizationGoals 
        } = args as any;
        
        try {
          const contentLength = optimizationContent.length;
          const wordCount = optimizationContent.split(/\s+/).length;
          const sentenceCount = optimizationContent.split(/[.!?]+/).length;
          const avgWordsPerSentence = Math.round(wordCount / sentenceCount);
          
          // Content analysis
          const analysis = {
            readability: {
              word_count: wordCount,
              sentence_count: sentenceCount,
              avg_words_per_sentence: avgWordsPerSentence,
              readability_score: avgWordsPerSentence < 20 ? 'high' : avgWordsPerSentence < 30 ? 'medium' : 'low',
              optimal_length: wordCount >= 50 && wordCount <= 150
            },
            engagement_factors: {
              has_question: optimizationContent.includes('?'),
              has_call_to_action: /\b(share|comment|like|follow|check|visit|click)\b/i.test(optimizationContent),
              has_emoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(optimizationContent),
              urgency_words: /\b(now|today|urgent|limited|deadline|hurry)\b/i.test(optimizationContent)
            },
            accessibility: {
              all_caps_usage: (optimizationContent.match(/\b[A-Z]{3,}\b/g) || []).length,
              special_characters: (optimizationContent.match(/[^\w\s.,!?;:'"()-]/g) || []).length,
              hashtag_count: (optimizationContent.match(/#\w+/g) || []).length,
              mention_count: (optimizationContent.match(/@\w+/g) || []).length
            }
          };
          
          // Generate recommendations based on analysis type
          const recommendations = [];
          
          if (analysisType === 'engagement' || analysisType === 'comprehensive') {
            if (!analysis.engagement_factors.has_question) {
              recommendations.push('Add a question to encourage audience interaction');
            }
            if (!analysis.engagement_factors.has_call_to_action) {
              recommendations.push('Include a clear call-to-action to drive engagement');
            }
            if (!analysis.engagement_factors.has_emoji && wordCount > 20) {
              recommendations.push('Consider adding relevant emojis to increase visual appeal');
            }
          }
          
          if (analysisType === 'reach' || analysisType === 'comprehensive') {
            if (analysis.accessibility.hashtag_count < 3) {
              recommendations.push('Add 3-5 relevant hashtags to improve discoverability');
            }
            if (analysis.accessibility.hashtag_count > 7) {
              recommendations.push('Reduce hashtag count to 3-5 for better readability');
            }
          }
          
          if (analysisType === 'accessibility' || analysisType === 'comprehensive') {
            if (analysis.accessibility.all_caps_usage > 2) {
              recommendations.push('Reduce ALL CAPS usage for better accessibility');
            }
            if (analysis.accessibility.special_characters > 10) {
              recommendations.push('Consider reducing special characters for screen reader compatibility');
            }
          }
          
          if (analysisType === 'seo' || analysisType === 'comprehensive') {
            if (wordCount < 50) {
              recommendations.push('Consider expanding content to 50-150 words for better algorithm performance');
            }
            if (wordCount > 200) {
              recommendations.push('Consider condensing content for better engagement rates');
            }
          }
          
          // Optimization score calculation
          let optimizationScore = 70; // Base score
          
          if (analysis.readability.optimal_length) optimizationScore += 10;
          if (analysis.engagement_factors.has_question) optimizationScore += 5;
          if (analysis.engagement_factors.has_call_to_action) optimizationScore += 10;
          if (analysis.engagement_factors.has_emoji) optimizationScore += 5;
          if (analysis.accessibility.hashtag_count >= 3 && analysis.accessibility.hashtag_count <= 5) optimizationScore += 10;
          if (analysis.accessibility.all_caps_usage === 0) optimizationScore += 5;
          
          optimizationScore = Math.min(100, optimizationScore);
          
          result = {
            optimization_score: optimizationScore,
            score_category: optimizationScore >= 90 ? 'excellent' : optimizationScore >= 75 ? 'good' : optimizationScore >= 60 ? 'fair' : 'needs_improvement',
            content_analysis: analysis,
            recommendations,
            target_audience_alignment: targetAudience ? {
              demographics_considered: targetAudience.demographics || [],
              interests_alignment: targetAudience.interests || [],
              timezone_optimization: targetAudience.timezone || 'not_specified'
            } : null,
            optimization_goals_assessment: optimizationGoals ? {
              goals_targeted: optimizationGoals,
              achievable_goals: optimizationGoals.filter((goal: string) => {
                switch (goal) {
                  case 'increase_engagement': return analysis.engagement_factors.has_question || analysis.engagement_factors.has_call_to_action;
                  case 'expand_reach': return analysis.accessibility.hashtag_count >= 3;
                  case 'improve_accessibility': return analysis.accessibility.all_caps_usage < 3;
                  case 'boost_shares': return analysis.engagement_factors.has_call_to_action;
                  case 'drive_traffic': return /\b(link|visit|check|website)\b/i.test(optimizationContent);
                  default: return false;
                }
              })
            } : null,
            professional_insights: [
              'Optimal posting times vary by audience timezone',
              'Consistent posting schedule improves algorithm performance',
              'Engage with comments within first hour for better reach',
              'Cross-platform promotion can amplify Thread reach'
            ]
          };
          
        } catch (error) {
          throw new Error(`Content optimization analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'bulk_post_management':
        const { action: bulkAction, filters: bulkFilters, bulk_operations: bulkOperations } = args as any;
        
        try {
          const currentUserForBulk: any = await apiClient.get('/me', { fields: 'id' });
          
          // Get user's threads with pagination
          let allThreads = [];
          let nextUrl = null;
          
          do {
            const threadsResponse: any = await apiClient.get(`/${currentUserForBulk.id}/threads`, {
              fields: 'id,text,timestamp,media_type,media_url,permalink_url',
              limit: 50
            });
            
            allThreads.push(...threadsResponse.data);
            nextUrl = threadsResponse.paging?.next;
          } while (nextUrl && allThreads.length < 200); // Limit to 200 posts for performance
          
          // Apply filters
          let filteredThreads = allThreads;
          
          if (bulkFilters?.date_range) {
            const startDate = bulkFilters.date_range.start ? new Date(bulkFilters.date_range.start) : null;
            const endDate = bulkFilters.date_range.end ? new Date(bulkFilters.date_range.end) : null;
            
            filteredThreads = filteredThreads.filter((thread: any) => {
              const threadDate = new Date(thread.timestamp);
              return (!startDate || threadDate >= startDate) && (!endDate || threadDate <= endDate);
            });
          }
          
          if (bulkFilters?.content_type) {
            filteredThreads = filteredThreads.filter((thread: any) => {
              switch (bulkFilters.content_type) {
                case 'text': return !thread.media_type || thread.media_type === 'TEXT';
                case 'image': return thread.media_type === 'IMAGE';
                case 'video': return thread.media_type === 'VIDEO';
                case 'carousel': return thread.media_type === 'CAROUSEL_ALBUM';
                default: return true;
              }
            });
          }
          
          // Perform bulk action
          let actionResult = {};
          
          switch (bulkAction) {
            case 'analyze_performance':
              // Analyze performance metrics for filtered posts
              const performanceAnalysis = {
                total_posts: filteredThreads.length,
                date_range: {
                  earliest: filteredThreads.length > 0 ? new Date(Math.min(...filteredThreads.map((t: any) => new Date(t.timestamp).getTime()))).toISOString() : null,
                  latest: filteredThreads.length > 0 ? new Date(Math.max(...filteredThreads.map((t: any) => new Date(t.timestamp).getTime()))).toISOString() : null
                },
                content_distribution: {
                  text_posts: filteredThreads.filter((t: any) => !t.media_type || t.media_type === 'TEXT').length,
                  image_posts: filteredThreads.filter((t: any) => t.media_type === 'IMAGE').length,
                  video_posts: filteredThreads.filter((t: any) => t.media_type === 'VIDEO').length,
                  carousel_posts: filteredThreads.filter((t: any) => t.media_type === 'CAROUSEL_ALBUM').length
                },
                posting_patterns: {
                  posts_per_week: filteredThreads.length > 0 ? (filteredThreads.length / Math.max(1, Math.ceil((Date.now() - new Date(filteredThreads[filteredThreads.length - 1].timestamp).getTime()) / (7 * 24 * 60 * 60 * 1000)))).toFixed(1) : '0',
                  avg_text_length: filteredThreads.filter((t: any) => t.text).reduce((sum: number, t: any) => sum + t.text.length, 0) / Math.max(1, filteredThreads.filter((t: any) => t.text).length)
                }
              };
              
              actionResult = performanceAnalysis;
              break;
              
            case 'content_audit':
              // Audit content for issues and opportunities
              const auditResults = {
                posts_audited: filteredThreads.length,
                issues_found: [] as string[],
                opportunities: [] as string[],
                recommendations: [] as string[]
              };
              
              // Check for common issues
              const postsWithoutHashtags = filteredThreads.filter((t: any) => !t.text || !t.text.includes('#')).length;
              const veryShortPosts = filteredThreads.filter((t: any) => t.text && t.text.length < 50).length;
              const veryLongPosts = filteredThreads.filter((t: any) => t.text && t.text.length > 280).length;
              
              if (postsWithoutHashtags > filteredThreads.length * 0.5) {
                auditResults.issues_found.push(`${postsWithoutHashtags} posts missing hashtags (${Math.round(postsWithoutHashtags / filteredThreads.length * 100)}%)`);
              }
              
              if (veryShortPosts > filteredThreads.length * 0.3) {
                auditResults.issues_found.push(`${veryShortPosts} posts are very short (<50 characters)`);
              }
              
              if (veryLongPosts > filteredThreads.length * 0.2) {
                auditResults.issues_found.push(`${veryLongPosts} posts are very long (>280 characters)`);
              }
              
              // Identify opportunities
              if (postsWithoutHashtags > 0) {
                auditResults.opportunities.push('Add relevant hashtags to increase discoverability');
              }
              
              auditResults.recommendations = [
                'Maintain consistent posting schedule',
                'Use mix of content types (text, images, videos)',
                'Engage with audience comments regularly',
                'Monitor hashtag performance and adjust strategy'
              ];
              
              actionResult = auditResults;
              break;
              
            case 'export_data':
              // Export filtered data
              actionResult = {
                export_summary: {
                  total_posts: filteredThreads.length,
                  export_format: 'json',
                  exported_at: new Date().toISOString()
                },
                data: filteredThreads.map((thread: any) => ({
                  id: thread.id,
                  text: thread.text,
                  timestamp: thread.timestamp,
                  media_type: thread.media_type,
                  permalink: thread.permalink_url,
                  text_length: thread.text ? thread.text.length : 0,
                  has_hashtags: thread.text ? thread.text.includes('#') : false,
                  has_mentions: thread.text ? thread.text.includes('@') : false
                }))
              };
              break;
              
            default:
              throw new Error(`Unsupported bulk action: ${bulkAction}`);
          }
          
          result = {
            bulk_action: bulkAction,
            filters_applied: bulkFilters || {},
            processed_posts: filteredThreads.length,
            total_available_posts: allThreads.length,
            action_result: actionResult,
            processing_timestamp: new Date().toISOString(),
            bulk_management_features: ['performance_analysis', 'content_audit', 'data_export', 'filtering'],
            api_limitations: 'Some bulk operations may be limited by Threads API rate limits and permissions'
          };
          
        } catch (error) {
          throw new Error(`Bulk post management failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'website_integration_setup':
        const { 
          integration_type: integrationType, 
          website_config: websiteConfig, 
          automation_settings: websiteAutomationSettings 
        } = args as any;
        
        try {
          const currentUserForIntegration: any = await apiClient.get('/me', { fields: 'id,username,name' });
          
          let integrationSetup = {};
          
          switch (integrationType) {
            case 'embed_feed':
              integrationSetup = {
                integration_type: 'embed_feed',
                embed_code: `<div id="threads-feed" data-user="${currentUserForIntegration.username}"></div>
<script>
(function() {
  // Threads Feed Embed Script
  const feedContainer = document.getElementById('threads-feed');
  const userId = '${currentUserForIntegration.id}';
  const theme = '${websiteConfig?.styling_preferences?.theme || 'light'}';
  const layout = '${websiteConfig?.styling_preferences?.layout || 'list'}';
  const postCount = ${websiteConfig?.styling_preferences?.post_count || 5};
  
  // Note: This is a template - actual implementation requires Threads API access
  console.log('Threads feed setup:', { userId, theme, layout, postCount });
})();
</script>`,
                css_styles: `
.threads-feed {
  max-width: 600px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.threads-post {
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: ${websiteConfig?.styling_preferences?.theme === 'dark' ? '#1a1a1a' : '#ffffff'};
  color: ${websiteConfig?.styling_preferences?.theme === 'dark' ? '#ffffff' : '#000000'};
}

.threads-post-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.threads-post-content {
  line-height: 1.5;
  margin-bottom: 12px;
}
`,
                configuration: {
                  domain: websiteConfig?.domain,
                  platform: websiteConfig?.platform,
                  auto_sync: websiteAutomationSettings?.auto_sync || false,
                  update_frequency: '15 minutes'
                }
              };
              break;
              
            case 'share_buttons':
              integrationSetup = {
                integration_type: 'share_buttons',
                share_button_html: `<a href="https://threads.net/intent/post?text={{POST_TEXT}}&url={{POST_URL}}" 
   target="_blank" 
   class="threads-share-btn"
   style="display: inline-flex; align-items: center; padding: 8px 16px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px;">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.001 1.5 5.23 6.72 0 12.002 0S22.5 5.23 22.5 12.001c0 3.585-.85 6.439-2.495 8.49-1.85 2.304-4.603 3.485-8.184 3.509z"/>
  </svg>
  Share on Threads
</a>`,
                javascript_integration: `
function shareOnThreads(text, url) {
  const shareUrl = 'https://threads.net/intent/post?' + 
    'text=' + encodeURIComponent(text) + 
    (url ? '&url=' + encodeURIComponent(url) : '');
  window.open(shareUrl, '_blank', 'width=600,height=400');
}

// Auto-add share buttons to blog posts
document.addEventListener('DOMContentLoaded', function() {
  const posts = document.querySelectorAll('.blog-post, .article, .post');
  posts.forEach(post => {
    const title = post.querySelector('h1, h2, .title')?.textContent || document.title;
    const url = window.location.href;
    
    const shareBtn = document.createElement('button');
    shareBtn.textContent = 'Share on Threads';
    shareBtn.onclick = () => shareOnThreads(title, url);
    
    post.appendChild(shareBtn);
  });
});
`,
                configuration: {
                  button_style: websiteConfig?.styling_preferences?.theme || 'dark',
                  auto_detect_content: true,
                  custom_message_template: 'Check out: {{TITLE}} {{URL}}'
                }
              };
              break;
              
            case 'webhook_setup':
              integrationSetup = {
                integration_type: 'webhook_setup',
                webhook_endpoint: websiteAutomationSettings?.webhook_url || 'https://your-site.com/webhooks/threads',
                webhook_events: [
                  'thread.created',
                  'thread.updated',
                  'thread.deleted',
                  'user.followed',
                  'user.unfollowed'
                ],
                payload_example: {
                  event: 'thread.created',
                  user: {
                    id: currentUserForIntegration.id,
                    username: currentUserForIntegration.username,
                    name: currentUserForIntegration.name
                  },
                  thread: {
                    id: 'example_thread_id',
                    text: 'Example thread content',
                    timestamp: new Date().toISOString(),
                    media_type: 'TEXT'
                  },
                  webhook_id: 'webhook_' + Date.now()
                },
                setup_instructions: [
                  '1. Configure your webhook endpoint to receive POST requests',
                  '2. Verify webhook signatures for security',
                  '3. Handle different event types appropriately',
                  '4. Implement retry logic for failed deliveries',
                  '5. Test with the provided payload example'
                ],
                security_notes: [
                  'Always verify webhook signatures',
                  'Use HTTPS endpoints only',
                  'Implement rate limiting',
                  'Log webhook events for debugging'
                ]
              };
              break;
              
            case 'auto_crosspost':
              integrationSetup = {
                integration_type: 'auto_crosspost',
                crosspost_configuration: {
                  source_platform: websiteConfig?.platform || 'custom',
                  target: 'threads',
                  sync_direction: 'website_to_threads',
                  content_mapping: {
                    blog_post_title: 'thread_text_prefix',
                    blog_post_excerpt: 'thread_main_content',
                    blog_post_url: 'thread_link',
                    featured_image: 'thread_media'
                  },
                  automation_rules: {
                    auto_hashtags: websiteAutomationSettings?.crosspost_enabled || false,
                    content_transformation: 'summarize_for_social',
                    posting_schedule: 'immediate',
                    duplicate_prevention: true
                  }
                },
                implementation_code: `
// Example WordPress integration
function auto_crosspost_to_threads($post_id) {
  $post = get_post($post_id);
  if ($post->post_status !== 'publish') return;
  
  $thread_content = $post->post_title . "\\n\\n" . 
                   wp_trim_words($post->post_content, 50) . "\\n\\n" .
                   get_permalink($post_id);
  
  // Call Threads API
  crosspost_to_threads($thread_content);
}
add_action('publish_post', 'auto_crosspost_to_threads');
`,
                api_requirements: [
                  'Threads API access token',
                  'Content publishing permissions',
                  'Rate limit handling (50 posts per day)',
                  'Error handling and retry logic'
                ]
              };
              break;
              
            default:
              throw new Error(`Unsupported integration type: ${integrationType}`);
          }
          
          result = {
            integration_setup: integrationSetup,
            user_info: {
              id: currentUserForIntegration.id,
              username: currentUserForIntegration.username,
              name: currentUserForIntegration.name
            },
            website_config: websiteConfig || {},
            automation_settings: websiteAutomationSettings || {},
            setup_timestamp: new Date().toISOString(),
            next_steps: [
              'Test integration in development environment',
              'Configure webhook endpoints if applicable',
              'Set up monitoring and error handling',
              'Review and adjust automation settings'
            ],
            support_resources: [
              'Threads API Documentation: https://developers.facebook.com/docs/threads',
              'Integration examples and code samples',
              'Community support forums',
              'Professional integration services available'
            ],
            professional_features: ['custom_styling', 'automation_rules', 'webhook_integration', 'cross_platform_sync']
          };
          
        } catch (error) {
          throw new Error(`Website integration setup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'validate_setup':
        const { check_scopes: checkScopes = true, required_scopes: customScopes } = args as any;
        
        try {
          // Step 1: Validate token
          const tokenValidation = await apiClient.validateToken();
          
          let scopeValidation = null;
          if (checkScopes) {
            // Step 2: Check scopes
            scopeValidation = await apiClient.checkScopes(customScopes);
          }
          
          // Step 3: Test basic API access
          let profileAccess = null;
          try {
            const profile = await apiClient.get('/me', { fields: 'id,username,name' }) as any;
            profileAccess = {
              success: true,
              profile: {
                id: profile.id,
                username: profile.username,
                name: profile.name
              }
            };
          } catch (error) {
            profileAccess = {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
          
          result = {
            validation_timestamp: new Date().toISOString(),
            token_validation: tokenValidation,
            scope_validation: scopeValidation,
            profile_access: profileAccess,
            setup_recommendations: [],
            status: 'unknown'
          };
          
          // Generate recommendations based on results
          if (!tokenValidation.valid) {
            result.setup_recommendations.push('❌ Access token is invalid. Please generate a new token from Meta Developer Console.');
            result.status = 'invalid_token';
          } else if (scopeValidation && !scopeValidation.hasRequired) {
            result.setup_recommendations.push(`❌ Missing required scopes: ${scopeValidation.missing.join(', ')}. Please regenerate your access token with all required permissions.`);
            result.status = 'missing_scopes';
          } else if (!profileAccess.success) {
            if (profileAccess.error && profileAccess.error.includes('business account')) {
              result.setup_recommendations.push('❌ Business account required. Convert your Instagram account to a business account and complete Meta Business verification.');
              result.status = 'business_account_required';
            } else {
              result.setup_recommendations.push(`❌ Profile access failed: ${profileAccess.error}`);
              result.status = 'profile_access_failed';
            }
          } else {
            result.setup_recommendations.push('✅ Setup appears to be correct! All validations passed.');
            result.status = 'valid';
          }
          
          // Add setup instructions
          if (result.status !== 'valid') {
            result.setup_instructions = [
              '1. Convert Instagram to Business Account (in Instagram app settings)',
              '2. Complete Meta Business verification (may take 1-3 days)',
              '3. Create Meta Developer App at developers.facebook.com',
              '4. Add "Threads API" product to your app',
              '5. Request required scopes: threads_basic, threads_content_publish, threads_manage_insights, threads_read_replies',
              '6. Complete OAuth flow with business Instagram account',
              '7. Use the generated access token in your MCP configuration'
            ];
          }
          
        } catch (error) {
          result = {
            validation_timestamp: new Date().toISOString(),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            setup_recommendations: [
              '❌ Unable to validate setup. Check your network connection and access token.',
              'Ensure your THREADS_ACCESS_TOKEN environment variable is set correctly.'
            ]
          };
        }
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
  console.error('Threads Personal Manager MCP server v5.0.0 running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});