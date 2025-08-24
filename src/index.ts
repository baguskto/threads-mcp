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
          text: scheduleText, 
          scheduled_publish_time,
          media_type: scheduleMediaType, 
          media_url: scheduleMediaUrl,
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
          text: scheduleText,
          media_type: scheduleMediaType || 'TEXT',
          scheduled_publish_time: scheduled_publish_time,
        };
        
        if (scheduleMediaUrl) {
          scheduledPostData.media_url = scheduleMediaUrl;
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