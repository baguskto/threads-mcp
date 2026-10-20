/** Default field sets requested from the Threads API. */

export const PROFILE_FIELDS = [
  'id',
  'username',
  'name',
  'threads_profile_picture_url',
  'threads_biography',
  'is_verified',
] as const;

export const MEDIA_FIELDS = [
  'id',
  'media_product_type',
  'media_type',
  'media_url',
  'thumbnail_url',
  'permalink',
  'shortcode',
  'username',
  'text',
  'timestamp',
  'is_quote_post',
  'quoted_post',
  'reposted_post',
  'alt_text',
  'link_attachment_url',
  'topic_tag',
  'children{id,media_type,media_url,thumbnail_url,alt_text}',
] as const;

export const REPLY_FIELDS = [
  'id',
  'text',
  'username',
  'permalink',
  'timestamp',
  'media_type',
  'media_url',
  'shortcode',
  'has_replies',
  'root_post',
  'replied_to',
  'is_reply',
  'is_reply_owned_by_me',
  'hide_status',
  'reply_audience',
] as const;

export const POST_INSIGHT_METRICS = ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'] as const;

export const USER_INSIGHT_METRICS = [
  'views',
  'likes',
  'replies',
  'reposts',
  'quotes',
  'clicks',
  'followers_count',
  'follower_demographics',
] as const;
