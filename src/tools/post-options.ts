import { z } from 'zod';
import type { Params } from '../threads/client.js';

export const MAX_TEXT_LENGTH = 500;
export const MAX_LINKS = 5;

/** Threads media, user, container and location IDs are numeric strings. */
export const threadsId = z.string().regex(/^\d+$/, 'Must be a numeric Threads ID');

export const spoilersSchema = z
  .array(z.object({ offset: z.number().int().min(0), length: z.number().int().min(1) }))
  .max(10)
  .describe('Ranges of the text to hide as spoilers (character offset and length)');

export const replyControl = z
  .enum(['everyone', 'accounts_you_follow', 'mentioned_only', 'parent_post_author_only', 'followers_only'])
  .describe('Who can reply to the post');

/** Options shared by every tool that creates a post, reply or quote. */
export const postOptionsShape = {
  reply_control: replyControl.optional(),
  topic_tag: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[^.&]+$/, 'Topic tags cannot contain periods or ampersands')
    .optional()
    .describe('One topic tag for the post (how Threads groups posts by topic; inline #hashtags are not needed)'),
  location_id: threadsId.optional().describe('Location ID from search_locations (needs threads_location_tagging)'),
  allowlisted_country_codes: z
    .array(z.string().length(2))
    .optional()
    .describe('Only show the post in these ISO 3166-1 alpha-2 countries (accounts eligible for geo-gating only)'),
  enable_reply_approvals: z.boolean().optional().describe('Hold replies for your approval before they are shown'),
  share_to_instagram_story: z
    .boolean()
    .optional()
    .describe('Also share the post to your linked Instagram Story (needs threads_share_to_instagram)'),
} as const;

/** Text-only extras (link previews, polls, GIFs, long text, ghost posts) plus spoilers, which work on any post. */
export const textExtrasShape = {
  link_attachment: z.url().optional().describe('URL to show as a link preview card (text posts only)'),
  poll_options: z
    .array(z.string().min(1).max(25))
    .min(2)
    .max(4)
    .optional()
    .describe('Attach a 24-hour poll with 2–4 options of up to 25 characters (text posts only)'),
  gif_id: z.string().optional().describe('GIPHY GIF ID to attach (text posts only; GIPHY is the only supported provider)'),
  spoilers: spoilersSchema.optional(),
  text_attachment: z
    .object({
      plaintext: z.string().min(1).max(10_000),
      link_attachment_url: z.url().optional(),
      styling: z
        .array(
          z.object({
            offset: z.number().int().min(0),
            length: z.number().int().min(1),
            styles: z.array(z.enum(['bold', 'italic', 'highlight', 'underline', 'strikethrough'])).min(1),
          }),
        )
        .optional(),
    })
    .optional()
    .describe('Attach a long-form text block of up to 10,000 characters (text posts only)'),
  is_ghost_post: z.boolean().optional().describe('Publish as a ghost post that disappears after 24 hours (text posts only)'),
} as const;

export const mediaShape = {
  image_url: z.url().optional().describe('Public HTTPS URL of a JPEG or PNG (max 8 MB)'),
  video_url: z.url().optional().describe('Public HTTPS URL of an MP4 or MOV (max 5 minutes, 1 GB)'),
  alt_text: z.string().max(1000).optional().describe('Alt text for the image or video'),
  is_spoiler_media: z.boolean().optional().describe('Blur the media as a spoiler'),
} as const;

export type PostOptions = {
  reply_control?: z.infer<typeof replyControl>;
  topic_tag?: string;
  location_id?: string;
  allowlisted_country_codes?: string[];
  enable_reply_approvals?: boolean;
  share_to_instagram_story?: boolean;
};

export type TextExtras = {
  link_attachment?: string;
  poll_options?: string[];
  gif_id?: string;
  spoilers?: { offset: number; length: number }[];
  text_attachment?: {
    plaintext: string;
    link_attachment_url?: string;
    styling?: { offset: number; length: number; styles: string[] }[];
  };
  is_ghost_post?: boolean;
};

export type MediaInput = {
  image_url?: string;
  video_url?: string;
  alt_text?: string;
  is_spoiler_media?: boolean;
};

export function buildPostOptions(o: PostOptions): Params {
  return {
    reply_control: o.reply_control,
    topic_tag: o.topic_tag,
    location_id: o.location_id,
    allowlisted_country_codes: o.allowlisted_country_codes,
    enable_reply_approvals: o.enable_reply_approvals,
    crossreshare_to_ig: o.share_to_instagram_story,
  };
}

/** Spoiler ranges as the `text_entities` param; valid on text, media and carousel posts. */
export function spoilerEntities(spoilers?: { offset: number; length: number }[]): string | undefined {
  if (!spoilers?.length) return undefined;
  return JSON.stringify(spoilers.map((s) => ({ entity_type: 'SPOILER', offset: s.offset, length: s.length })));
}

export function buildTextExtras(o: TextExtras): Params {
  const params: Params = {
    link_attachment: o.link_attachment,
    is_ghost_post: o.is_ghost_post,
  };
  if (o.poll_options) {
    const keys = ['option_a', 'option_b', 'option_c', 'option_d'];
    params.poll_attachment = Object.fromEntries(o.poll_options.map((text, i) => [keys[i], text]));
  }
  if (o.gif_id) params.gif_attachment = { gif_id: o.gif_id, provider: 'GIPHY' };
  if (o.text_attachment) {
    const { plaintext, link_attachment_url, styling } = o.text_attachment;
    params.text_attachment = {
      plaintext,
      link_attachment_url,
      text_with_styling_info: styling?.map(({ offset, length, styles }) => ({ offset, length, styling_info: styles })),
    };
  }
  return params;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const EMOJI_LIKE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/**
 * Length as Threads counts it: an emoji (including flags, keycaps, skin tones
 * and ZWJ sequences) counts as its full UTF-8 byte length, anything else as one.
 */
export function threadsTextLength(text: string): number {
  let length = 0;
  for (const { segment } of graphemes.segment(text)) {
    length += EMOJI_LIKE.test(segment) ? Buffer.byteLength(segment, 'utf8') : 1;
  }
  return length;
}

/** Strips the scheme, `www.` and trailing punctuation; lowercases only the host (paths are case-sensitive). */
const normalizeLink = (url: string) => {
  const bare = url
    .replace(/[).,!?'"]+$/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
  const slash = bare.indexOf('/');
  return slash === -1 ? bare.toLowerCase() : bare.slice(0, slash).toLowerCase() + bare.slice(slash);
};

/** Unique links as Threads counts them, including scheme-less `www.` links. */
export function countLinks(text = '', linkAttachment?: string): number {
  const urls = new Set((text.match(/(?:https?:\/\/|(?<![\w.])www\.)[^\s]+/gi) ?? []).map(normalizeLink));
  if (linkAttachment) urls.add(normalizeLink(linkAttachment));
  return urls.size;
}

/** Enforces the text length and link limits Threads applies to every post. */
export function checkText(text?: string, linkAttachment?: string) {
  if (text) {
    const length = threadsTextLength(text);
    if (length > MAX_TEXT_LENGTH) {
      throw new Error(
        `Text is ${length} characters as Threads counts them (emoji count as several); the limit is ${MAX_TEXT_LENGTH}. ` +
          'Shorten it, split it with create_thread_chain, or use text_attachment for long-form text.',
      );
    }
  }
  if (countLinks(text, linkAttachment) > MAX_LINKS) {
    throw new Error(`Posts can contain at most ${MAX_LINKS} links`);
  }
}

/**
 * Builds container params for a single TEXT, IMAGE or VIDEO post and checks the
 * combinations the API rejects, so the model gets a clear error up front.
 */
export function buildSinglePostParams(
  input: { text?: string; reply_to_id?: string } & MediaInput & PostOptions & TextExtras,
): Params {
  const { text, image_url, video_url } = input;
  if (image_url && video_url) throw new Error('Provide either image_url or video_url, not both');
  const mediaType = image_url ? 'IMAGE' : video_url ? 'VIDEO' : 'TEXT';
  if (mediaType === 'TEXT' && !text?.trim() && !input.gif_id && !input.text_attachment) {
    throw new Error('A text post needs text (or a GIF or text attachment)');
  }
  checkText(text, input.link_attachment);

  const textOnly = (['link_attachment', 'poll_options', 'gif_id', 'text_attachment', 'is_ghost_post'] as const).filter(
    (k) => input[k] !== undefined && input[k] !== false,
  );
  if (mediaType !== 'TEXT' && textOnly.length) {
    throw new Error(`${textOnly.join(', ')} can only be used on text posts`);
  }
  if (input.poll_options && (input.link_attachment || input.text_attachment)) {
    throw new Error('A poll cannot be combined with link_attachment or text_attachment');
  }
  if (input.is_ghost_post && (input.enable_reply_approvals || input.reply_to_id)) {
    throw new Error('Ghost posts cannot be replies or use reply approvals');
  }

  return {
    media_type: mediaType,
    text,
    image_url,
    video_url,
    alt_text: mediaType === 'TEXT' ? undefined : input.alt_text,
    is_spoiler_media: mediaType === 'TEXT' ? undefined : input.is_spoiler_media,
    text_entities: spoilerEntities(input.spoilers),
    ...buildPostOptions(input),
    ...(mediaType === 'TEXT' ? buildTextExtras(input) : {}),
  };
}
