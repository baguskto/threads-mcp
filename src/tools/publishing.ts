import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import type { Params } from '../threads/client.js';
import {
  ContainerPendingError,
  createAndPublish,
  createContainer,
  publishContainer,
  waitForContainer,
  type PublishOptions,
} from '../threads/publish.js';
import {
  buildPostOptions,
  buildSinglePostParams,
  checkText,
  MAX_TEXT_LENGTH,
  mediaShape,
  postOptionsShape,
  spoilerEntities,
  spoilersSchema,
  textExtrasShape,
  threadsId,
} from './post-options.js';
import { handler } from './util.js';

export const MAX_CAROUSEL_ITEMS = 20;

/** Scheduled posts have no client waiting on them, so they can wait the full 5 minutes Meta suggests. */
const SCHEDULED_WAIT_MS = 300_000;

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
  spoilers: spoilersSchema.optional(),
  ...postOptionsShape,
};
const carouselSchema = z.object(carouselShape);
type CarouselInput = z.infer<typeof carouselSchema>;

/** Fields that only make sense on a single post, rejected when scheduling a carousel. */
const SINGLE_POST_ONLY = [
  'image_url',
  'video_url',
  'alt_text',
  'media_type',
  'media_url',
  'link_attachment',
  'poll_options',
  'gif_id',
  'text_attachment',
  'is_ghost_post',
] as const;

type Target = { reply_to_id?: string; quote_post_id?: string };

export type ScheduledPayload =
  | { kind: 'post'; input: SinglePostInput & Target }
  | { kind: 'carousel'; input: CarouselInput & Target };

function normalizeLegacyMedia(input: SinglePostInput): SinglePostInput {
  const { media_type, media_url, ...rest } = input;
  if (!media_url || rest.image_url || rest.video_url) return rest;
  const isVideo = media_type === 'VIDEO' || (media_type !== 'IMAGE' && /\.(mp4|mov|m4v)(\?|$)/i.test(media_url));
  return isVideo ? { ...rest, video_url: media_url } : { ...rest, image_url: media_url };
}

function singlePostParams(input: SinglePostInput, extra: Target = {}): Params {
  return { ...buildSinglePostParams({ ...normalizeLegacyMedia(input), reply_to_id: extra.reply_to_id }), ...extra };
}

const stageShape = {
  publish: z
    .boolean()
    .default(true)
    .describe('Set false to only create the container (a draft); publish it later with publish_container within 24 hours'),
};

const pendingResult = (containerId: string) => ({
  container_id: containerId,
  published: false,
  status: 'IN_PROGRESS',
  note: 'Media is still processing. Call publish_container with this container_id in a minute or two (it expires after 24 hours).',
});

/**
 * Publishes now, or stops after creating the container when `publish` is false.
 * Media that is still processing when the wait budget runs out is returned as
 * a pending container instead of an error, so it can be finished later.
 */
async function publishOrStage(ctx: ToolContext, params: Params, publish: boolean, options: PublishOptions) {
  const client = ctx.client();
  const containerId = await createContainer(client, params);
  if (!publish) {
    return {
      container_id: containerId,
      published: false,
      note: 'Container created but not published. Publish it with publish_container within 24 hours.',
    };
  }
  try {
    return await publishContainer(client, containerId, options);
  } catch (error) {
    if (error instanceof ContainerPendingError) return pendingResult(containerId);
    throw error;
  }
}

async function publishCarousel(
  ctx: ToolContext,
  input: CarouselInput & Target,
  { publish = true, options }: { publish?: boolean; options: PublishOptions },
) {
  checkText(input.text);
  const client = ctx.client();
  // Create item containers in order so the carousel keeps the requested sequence.
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
  try {
    for (const id of children) await waitForContainer(client, id, options);
  } catch (error) {
    if (error instanceof ContainerPendingError) {
      throw new Error(
        `Carousel items are still processing (${error.containerId}); nothing was published. ` +
          `Item containers: ${children.join(', ')}. Try again in a few minutes, or schedule the carousel instead.`,
      );
    }
    throw error;
  }
  const params = {
    media_type: 'CAROUSEL',
    children,
    text: input.text,
    is_spoiler_media: input.is_spoiler_media,
    text_entities: spoilerEntities(input.spoilers),
    reply_to_id: input.reply_to_id,
    quote_post_id: input.quote_post_id,
    ...buildPostOptions(input),
  };
  const result = await publishOrStage(ctx, params, publish, options);
  return { ...result, media_count: children.length, item_container_ids: children };
}

/** Publishes a payload saved by schedule_post. */
export async function publishScheduled(ctx: ToolContext, payload: ScheduledPayload) {
  const options = { ...ctx.publish, timeoutMs: ctx.publish.timeoutMs ?? SCHEDULED_WAIT_MS };
  if (payload.kind === 'carousel') return publishCarousel(ctx, payload.input, { options });
  const { reply_to_id, quote_post_id, ...input } = payload.input;
  return createAndPublish(ctx.client(), singlePostParams(input, { reply_to_id, quote_post_id }), options);
}

/** Accepts only timestamps with an explicit offset, so the time doesn't depend on where the server runs. */
const publishAt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/, 'Use ISO 8601 with a timezone offset, e.g. 2026-11-01T09:00:00+07:00')
  .describe('When to publish, ISO 8601 with timezone offset, e.g. 2026-11-01T09:00:00+07:00');

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
    handler(async ({ publish, ...input }, req) => publishOrStage(ctx, singlePostParams(input), publish, ctx.publishOptions(req))),
  );

  server.registerTool(
    'create_carousel_post',
    {
      title: 'Publish a carousel',
      description: `Publish a carousel of 2–${MAX_CAROUSEL_ITEMS} images and/or videos with an optional caption.`,
      inputSchema: carouselSchema.extend(stageShape),
      annotations: writeAnnotations,
    },
    handler(async ({ publish, ...input }, req) => publishCarousel(ctx, input, { publish, options: ctx.publishOptions(req) })),
  );

  server.registerTool(
    'create_reply',
    {
      title: 'Reply to a post',
      description: 'Reply to any post or reply you can see. Supports the same media and options as publish_thread.',
      inputSchema: z.object({ reply_to_id: threadsId.describe('Media ID to reply to'), ...singlePostShape }),
      annotations: writeAnnotations,
    },
    handler(async ({ reply_to_id, ...input }, req) => {
      const result = await publishOrStage(ctx, singlePostParams(input, { reply_to_id }), true, ctx.publishOptions(req));
      return { ...result, reply_to_id };
    }),
  );

  server.registerTool(
    'quote_post',
    {
      title: 'Quote a post',
      description: 'Publish a post that quotes another post, with your own text and optional media.',
      inputSchema: z.object({ quoted_post_id: threadsId.describe('Media ID of the post to quote'), ...singlePostShape }),
      annotations: writeAnnotations,
    },
    handler(async ({ quoted_post_id, ...input }, req) => {
      const params = singlePostParams(input, { quote_post_id: quoted_post_id });
      const result = await publishOrStage(ctx, params, true, ctx.publishOptions(req));
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
        parent_thread_id: threadsId.optional().describe('Existing post to continue; omit to start a new thread'),
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
    handler(async ({ parent_thread_id, replies, topic_tag }, req) => {
      const client = ctx.client();
      const options = ctx.publishOptions(req);
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
          const result = await createAndPublish(client, { ...params, reply_to_id: replyTo }, options);
          published.push({ position: index + 1, reply_to_id: replyTo, ...result });
          replyTo = result.id;
        } catch (error) {
          // Report what made it out so the chain can be resumed.
          const done = published.map((p) => p.id);
          throw new Error(
            `Part ${index + 1} of ${parts.length} did not complete: ${(error as Error).message} ` +
              `Published before it: ${done.length ? done.join(', ') : 'none'}. ` +
              `If part ${index + 1} turns out to be published, continue from its ID; otherwise ` +
              (replyTo
                ? `resume with parent_thread_id=${replyTo} and parts ${index + 1}–${parts.length}.`
                : 'retry the whole chain.'),
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
      inputSchema: z.object({ post_id: threadsId.describe('Media ID to repost') }),
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
      inputSchema: z.object({ container_id: threadsId }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ container_id }) => ctx.client().get(`/${container_id}`, { fields: 'id,status,error_message' })),
  );

  server.registerTool(
    'publish_container',
    {
      title: 'Publish a media container',
      description: 'Publish a container created earlier (for example one that was still processing when a publish timed out).',
      inputSchema: z.object({ container_id: threadsId }),
      annotations: writeAnnotations,
    },
    handler(async ({ container_id }, req) => {
      try {
        return await publishContainer(ctx.client(), container_id, ctx.publishOptions(req));
      } catch (error) {
        if (error instanceof ContainerPendingError) return pendingResult(container_id);
        throw error;
      }
    }),
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
        publish_at: publishAt,
        ...singlePostShape,
        reply_to_id: threadsId.optional().describe('Publish as a reply to this media ID'),
        quote_post_id: threadsId.optional().describe('Publish as a quote of this media ID'),
        carousel_items: carouselShape.items
          .optional()
          .describe('Schedule a carousel instead of a single post (text, spoilers and post options still apply)'),
      }),
      annotations: writeAnnotations,
    },
    handler(async ({ publish_at, carousel_items, ...input }) => {
      let payload: ScheduledPayload;
      // Validate now so mistakes surface immediately rather than at publish time.
      if (carousel_items) {
        const invalid = SINGLE_POST_ONLY.filter((key) => input[key] !== undefined);
        if (invalid.length) throw new Error(`${invalid.join(', ')} cannot be used with carousel_items`);
        const { reply_to_id, quote_post_id } = input;
        const carousel = carouselSchema.parse({ ...input, items: carousel_items });
        checkText(carousel.text);
        payload = { kind: 'carousel', input: { ...carousel, reply_to_id, quote_post_id } };
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
