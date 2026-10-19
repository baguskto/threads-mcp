import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import type { Params } from '../threads/client.js';
import { createAndPublish, createContainer, publishContainer, waitForContainer } from '../threads/publish.js';
import {
  buildPostOptions,
  buildSinglePostParams,
  checkText,
  MAX_TEXT_LENGTH,
  mediaShape,
  postOptionsShape,
  textExtrasShape,
} from './post-options.js';
import { handler } from './util.js';

export const MAX_CAROUSEL_ITEMS = 20;

const text = z.string().max(MAX_TEXT_LENGTH).describe(`Post text (max ${MAX_TEXT_LENGTH} characters; up to 5 links)`);

/** Accepts the v5 `media_type` + `media_url` pair alongside image_url/video_url. */
const legacyMediaShape = {
  media_type: z.enum(['TEXT', 'IMAGE', 'VIDEO']).optional().describe('Deprecated: use image_url or video_url'),
  media_url: z.url().optional().describe('Deprecated: use image_url or video_url'),
};

const singlePostShape = {
  text: text.optional(),
  ...mediaShape,
  ...legacyMediaShape,
  ...postOptionsShape,
  ...textExtrasShape,
};
const singlePostSchema = z.object(singlePostShape);
type SinglePostInput = z.infer<typeof singlePostSchema>;

const carouselItem = z.object({
  url: z.url().describe('Public HTTPS URL of the image or video'),
  type: z.enum(['IMAGE', 'VIDEO']).optional().describe('Detected from the file extension when omitted'),
  alt_text: z.string().max(1000).optional(),
});

const carouselShape = {
  items: z.array(carouselItem).min(2).max(MAX_CAROUSEL_ITEMS).describe(`2–${MAX_CAROUSEL_ITEMS} images/videos`),
  text: text.optional(),
  is_spoiler_media: z.boolean().optional(),
  ...postOptionsShape,
};
const carouselSchema = z.object(carouselShape);
type CarouselInput = z.infer<typeof carouselSchema>;

export type ScheduledPayload =
  | { kind: 'post'; input: SinglePostInput & { reply_to_id?: string; quote_post_id?: string } }
  | { kind: 'carousel'; input: CarouselInput };

function normalizeLegacyMedia(input: SinglePostInput): SinglePostInput {
  const { media_type, media_url, ...rest } = input;
  if (!media_url || rest.image_url || rest.video_url) return rest;
  const isVideo = media_type === 'VIDEO' || (media_type !== 'IMAGE' && /\.(mp4|mov|m4v)(\?|$)/i.test(media_url));
  return isVideo ? { ...rest, video_url: media_url } : { ...rest, image_url: media_url };
}

function singlePostParams(input: SinglePostInput, extra: { reply_to_id?: string; quote_post_id?: string } = {}): Params {
  return { ...buildSinglePostParams({ ...normalizeLegacyMedia(input), reply_to_id: extra.reply_to_id }), ...extra };
}

const stageShape = {
  publish: z
    .boolean()
    .default(true)
    .describe('Set false to only create the container (a draft); publish it later with publish_container within 24 hours'),
};

/** Publishes now, or stops after creating the container when `publish` is false. */
async function publishOrStage(ctx: ToolContext, params: Params, publish: boolean) {
  const client = ctx.client();
  if (publish) return createAndPublish(client, params, ctx.publish);
  const containerId = await createContainer(client, params);
  return {
    container_id: containerId,
    published: false,
    note: 'Container created but not published. Publish it with publish_container within 24 hours.',
  };
}

async function publishCarousel(ctx: ToolContext, input: CarouselInput, publish = true) {
  checkText(input.text);
  const client = ctx.client();
  // Item containers are processed in parallel by Threads; create them in order
  // so the carousel keeps the requested sequence.
  const children: string[] = [];
  for (const item of input.items) {
    const isVideo = item.type === 'VIDEO' || (!item.type && /\.(mp4|mov|m4v)(\?|$)/i.test(item.url));
    children.push(
      await createContainer(client, {
        media_type: isVideo ? 'VIDEO' : 'IMAGE',
        [isVideo ? 'video_url' : 'image_url']: item.url,
        alt_text: item.alt_text,
        is_carousel_item: true,
      }),
    );
  }
  for (const id of children) await waitForContainer(client, id, ctx.publish);
  const params = {
    media_type: 'CAROUSEL',
    children,
    text: input.text,
    is_spoiler_media: input.is_spoiler_media,
    ...buildPostOptions(input),
  };
  const result = await publishOrStage(ctx, params, publish);
  return { ...result, media_count: children.length, item_container_ids: children };
}

/** Publishes a payload saved by schedule_post. */
export async function publishScheduled(ctx: ToolContext, payload: ScheduledPayload) {
  if (payload.kind === 'carousel') return publishCarousel(ctx, payload.input);
  const { reply_to_id, quote_post_id, ...input } = payload.input;
  return createAndPublish(ctx.client(), singlePostParams(input, { reply_to_id, quote_post_id }), ctx.publish);
}

const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export function registerPublishingTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    'publish_thread',
    {
      title: 'Publish a post',
      description:
        'Publish a text, image or video post. Text posts can carry a link preview, poll, GIF, spoilers, long-form text attachment, ' +
        'or be a 24-hour ghost post. Waits for media processing before publishing.',
      inputSchema: singlePostSchema.extend(stageShape),
      annotations: writeAnnotations,
    },
    handler(async ({ publish, ...input }) => publishOrStage(ctx, singlePostParams(input), publish)),
  );

  server.registerTool(
    'create_carousel_post',
    {
      title: 'Publish a carousel',
      description: `Publish a carousel of 2–${MAX_CAROUSEL_ITEMS} images and/or videos with an optional caption.`,
      inputSchema: carouselSchema.extend(stageShape),
      annotations: writeAnnotations,
    },
    handler(async ({ publish, ...input }) => publishCarousel(ctx, input, publish)),
  );

  server.registerTool(
    'create_reply',
    {
      title: 'Reply to a post',
      description: 'Reply to any post or reply you can see. Supports the same media and options as publish_thread.',
      inputSchema: z.object({ reply_to_id: z.string().describe('Media ID to reply to'), ...singlePostShape }),
      annotations: writeAnnotations,
    },
    handler(async ({ reply_to_id, ...input }) => {
      const result = await createAndPublish(ctx.client(), singlePostParams(input, { reply_to_id }), ctx.publish);
      return { ...result, reply_to_id };
    }),
  );

  server.registerTool(
    'quote_post',
    {
      title: 'Quote a post',
      description: 'Publish a post that quotes another post, with your own text and optional media.',
      inputSchema: z.object({ quoted_post_id: z.string().describe('Media ID of the post to quote'), ...singlePostShape }),
      annotations: writeAnnotations,
    },
    handler(async ({ quoted_post_id, ...input }) => {
      const result = await createAndPublish(ctx.client(), singlePostParams(input, { quote_post_id: quoted_post_id }), ctx.publish);
      return { ...result, quoted_post_id };
    }),
  );

  server.registerTool(
    'create_thread_chain',
    {
      title: 'Publish a thread chain',
      description:
        'Publish a multi-part thread where each part replies to the previous one. Pass parent_thread_id to continue an existing ' +
        'post; otherwise the first part becomes a new post.',
      inputSchema: z.object({
        parent_thread_id: z.string().optional().describe('Existing post to continue; omit to start a new thread'),
        replies: z
          .array(
            z.object({
              text: text,
              image_url: mediaShape.image_url,
              video_url: mediaShape.video_url,
              alt_text: mediaShape.alt_text,
              reply_control: postOptionsShape.reply_control,
            }),
          )
          .min(1)
          .max(25)
          .describe('Parts of the thread, in order'),
        topic_tag: postOptionsShape.topic_tag,
      }),
      annotations: writeAnnotations,
    },
    handler(async ({ parent_thread_id, replies, topic_tag }) => {
      const client = ctx.client();
      // Validate every part before anything goes live.
      const parts = replies.map((part, index) => {
        try {
          const isRoot = index === 0 && !parent_thread_id;
          return buildSinglePostParams({ ...part, topic_tag: isRoot ? topic_tag : undefined });
        } catch (error) {
          throw new Error(`Part ${index + 1}: ${(error as Error).message}`);
        }
      });
      const published: Array<Record<string, unknown>> = [];
      let replyTo = parent_thread_id;
      for (const [index, params] of parts.entries()) {
        try {
          const result = await createAndPublish(client, { ...params, reply_to_id: replyTo }, ctx.publish);
          published.push({ position: index + 1, reply_to_id: replyTo, ...result });
          replyTo = result.id;
        } catch (error) {
          // Report what made it out so the chain can be resumed.
          throw new Error(
            `Part ${index + 1} of ${parts.length} failed: ${(error as Error).message}. ` +
              `Published so far: ${JSON.stringify(published.map((p) => p.id))}. ` +
              (replyTo ? `Resume with parent_thread_id=${replyTo} and the remaining parts.` : 'Nothing was published.'),
          );
        }
      }
      return { root_id: parent_thread_id ?? published[0]?.id, count: published.length, posts: published };
    }),
  );

  server.registerTool(
    'repost_thread',
    {
      title: 'Repost',
      description: 'Repost a post to your profile. The API has no documented way to undo a repost.',
      inputSchema: z.object({ post_id: z.string().describe('Media ID to repost') }),
      annotations: writeAnnotations,
    },
    handler(async ({ post_id }) => {
      const res = await ctx.client().post<{ id: string }>(`/${post_id}/repost`);
      return { repost_id: res.id, reposted_post_id: post_id };
    }),
  );

  server.registerTool(
    'get_container_status',
    {
      title: 'Check media container status',
      description: 'Check whether a media container is still processing, ready (FINISHED), published, failed or expired.',
      inputSchema: z.object({ container_id: z.string() }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ container_id }) => ctx.client().get(`/${container_id}`, { fields: 'id,status,error_message' })),
  );

  server.registerTool(
    'publish_container',
    {
      title: 'Publish a media container',
      description: 'Publish a container created earlier (for example one that was still processing when a publish timed out).',
      inputSchema: z.object({ container_id: z.string() }),
      annotations: writeAnnotations,
    },
    handler(async ({ container_id }) => publishContainer(ctx.client(), container_id, ctx.publish)),
  );

  registerSchedulingTools(server, ctx);
}

function registerSchedulingTools(server: McpServer, ctx: ToolContext) {
  const scheduler = ctx.scheduler;
  if (!scheduler) return;

  server.registerTool(
    'schedule_post',
    {
      title: 'Schedule a post',
      description:
        'Schedule a post or carousel for later. Threads has no native scheduling, so the post is saved locally and published by ' +
        'this MCP server — it must be running at (or after) publish_at; overdue posts go out as soon as it starts.',
      inputSchema: z.object({
        publish_at: z.string().describe('When to publish, ISO 8601 with timezone offset, e.g. 2026-11-01T09:00:00+07:00'),
        ...singlePostShape,
        reply_to_id: z.string().optional().describe('Publish as a reply to this media ID'),
        quote_post_id: z.string().optional().describe('Publish as a quote of this media ID'),
        carousel_items: carouselShape.items.optional().describe('Schedule a carousel instead of a single post'),
      }),
      annotations: writeAnnotations,
    },
    handler(async ({ publish_at, carousel_items, ...input }) => {
      let payload: ScheduledPayload;
      // Validate now so mistakes surface immediately rather than at publish time.
      if (carousel_items) {
        payload = { kind: 'carousel', input: carouselSchema.parse({ ...input, items: carousel_items }) };
        checkText(payload.input.text);
      } else {
        const { reply_to_id, quote_post_id, ...post } = input;
        singlePostParams(post, { reply_to_id, quote_post_id });
        payload = { kind: 'post', input };
      }
      const post = await scheduler.add(payload, new Date(publish_at));
      return { ...post, note: 'Saved locally. It will be published while this MCP server is running.' };
    }),
  );

  server.registerTool(
    'list_scheduled_posts',
    {
      title: 'List scheduled posts',
      description: 'List posts scheduled with schedule_post, with their status and results.',
      inputSchema: z.object({
        status: z.enum(['pending', 'publishing', 'published', 'failed', 'cancelled']).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler(async ({ status }) => {
      const posts = await scheduler.list(status);
      return { count: posts.length, posts };
    }),
  );

  server.registerTool(
    'cancel_scheduled_post',
    {
      title: 'Cancel a scheduled post',
      description: 'Cancel a pending scheduled post.',
      inputSchema: z.object({ id: z.string().describe('ID returned by schedule_post') }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    handler(async ({ id }) => scheduler.cancel(id)),
  );
}
