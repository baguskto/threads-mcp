import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ToolContext } from '../server.js';
import type { ThreadsClient } from '../threads/client.js';
import { describeError } from '../threads/errors.js';
import { POST_INSIGHT_METRICS, USER_INSIGHT_METRICS } from '../threads/fields.js';
import { handler, toUnixSeconds } from './util.js';

/** User insights are not available before this date (2024-04-13). */
export const INSIGHTS_EPOCH = 1712991600;

interface InsightValue {
  name: string;
  period?: string;
  values?: { value: number; end_time?: string }[];
  total_value?: { value: number; breakdowns?: unknown };
  link_total_values?: { value: number; link_url?: string }[];
  title?: string;
}

/** Collapses the Graph insights payload into { metric: number }. */
export function flattenInsights(data: InsightValue[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const metric of data) {
    if (metric.total_value && typeof metric.total_value.value === 'number') {
      out[metric.name] = metric.total_value.value;
    } else if (metric.link_total_values) {
      out[metric.name] = metric.link_total_values.reduce((sum, v) => sum + (v.value ?? 0), 0);
    } else if (metric.values?.length) {
      out[metric.name] = metric.values.reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0);
    }
  }
  return out;
}

interface PostStats {
  id: string;
  text?: string;
  media_type?: string;
  permalink?: string;
  timestamp: string;
  metrics: Record<string, number>;
  engagement: number;
  engagement_rate?: number;
}

/** Fetches your posts in a window plus each post's insights. */
async function collectPostStats(client: ThreadsClient, since: number, until: number, maxPosts: number) {
  const userId = await client.getUserId();
  const posts = await client.paginate<{ id: string; text?: string; media_type?: string; permalink?: string; timestamp: string; media_product_type?: string }>(
    `/${userId}/threads`,
    { fields: 'id,text,media_type,media_product_type,permalink,timestamp', since, until, limit: 100 },
    maxPosts,
  );
  // Reposts have no insights of their own.
  const own = posts.filter((p) => p.media_type !== 'REPOST_FACADE');
  const stats: PostStats[] = [];
  const errors: string[] = [];
  const queue = [...own];
  const worker = async () => {
    for (let post = queue.shift(); post; post = queue.shift()) {
      try {
        const res = await client.get<{ data: InsightValue[] }>(`/${post.id}/insights`, { metric: POST_INSIGHT_METRICS });
        const metrics = flattenInsights(res.data);
        const engagement = (metrics.likes ?? 0) + (metrics.replies ?? 0) + (metrics.reposts ?? 0) + (metrics.quotes ?? 0) + (metrics.shares ?? 0);
        stats.push({
          id: post.id,
          text: post.text?.slice(0, 140),
          media_type: post.media_type,
          permalink: post.permalink,
          timestamp: post.timestamp,
          metrics,
          engagement,
          engagement_rate: metrics.views ? round(engagement / metrics.views, 4) : undefined,
        });
      } catch (error) {
        errors.push(`${post.id}: ${describeError(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  stats.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { stats, errors, skipped_reposts: posts.length - own.length };
}

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function windowFromDays(days: number, untilInput?: string) {
  const until = toUnixSeconds(untilInput) ?? Math.floor(Date.now() / 1000);
  const since = Math.max(until - days * 86_400, INSIGHTS_EPOCH);
  return { since, until };
}

function sumMetrics(stats: PostStats[]) {
  const totals: Record<string, number> = {};
  for (const s of stats) for (const [k, v] of Object.entries(s.metrics)) totals[k] = (totals[k] ?? 0) + v;
  return totals;
}

export function registerInsightTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    'get_thread_insights',
    {
      title: 'Get post insights',
      description: 'Get views, likes, replies, reposts, quotes and shares for one of your posts (needs threads_manage_insights).',
      inputSchema: z.object({
        thread_id: z.string(),
        metrics: z.array(z.enum(POST_INSIGHT_METRICS)).optional().describe('Default: all'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ thread_id, metrics }) => {
      const res = await ctx.client().get<{ data: InsightValue[] }>(`/${thread_id}/insights`, {
        metric: metrics?.length ? metrics : POST_INSIGHT_METRICS,
      });
      return { thread_id, metrics: flattenInsights(res.data), raw: res.data };
    }),
  );

  server.registerTool(
    'get_my_insights',
    {
      title: 'Get account insights',
      description:
        'Get account-level insights: views (daily time series), likes, replies, reposts, quotes, link clicks and follower count. ' +
        'Data is available from 2024-04-13 onward (needs threads_manage_insights).',
      inputSchema: z.object({
        metrics: z
          .array(z.enum(USER_INSIGHT_METRICS.filter((m) => m !== 'follower_demographics') as [string, ...string[]]))
          .optional()
          .describe('Default: views, likes, replies, reposts, quotes, clicks, followers_count'),
        since: z.string().optional().describe('ISO 8601 date/time or Unix timestamp (default: 30 days ago)'),
        until: z.string().optional().describe('ISO 8601 date/time or Unix timestamp (default: now)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ metrics, since, until }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const window = windowFromDays(30, until);
      const sinceTs = Math.max(toUnixSeconds(since) ?? window.since, INSIGHTS_EPOCH);
      const requested = metrics?.length ? metrics : USER_INSIGHT_METRICS.filter((m) => m !== 'follower_demographics');
      // followers_count does not accept a date range, so it is fetched on its own.
      const ranged = requested.filter((m) => m !== 'followers_count');
      const data: InsightValue[] = [];
      if (ranged.length) {
        const res = await client.get<{ data: InsightValue[] }>(`/${userId}/threads_insights`, {
          metric: ranged,
          since: sinceTs,
          until: window.until,
        });
        data.push(...(res.data ?? []));
      }
      const notes: string[] = [];
      if (requested.includes('followers_count')) {
        try {
          const res = await client.get<{ data: InsightValue[] }>(`/${userId}/threads_insights`, { metric: 'followers_count' });
          data.push(...(res.data ?? []));
        } catch (error) {
          notes.push(`followers_count unavailable: ${describeError(error)}`);
        }
      }
      const clicks = data.find((m) => m.name === 'clicks')?.link_total_values;
      return {
        since: new Date(sinceTs * 1000).toISOString(),
        until: new Date(window.until * 1000).toISOString(),
        totals: flattenInsights(data),
        views_by_day: data.find((m) => m.name === 'views')?.values,
        clicks_by_link: clicks,
        notes: notes.length ? notes : undefined,
      };
    }),
  );

  server.registerTool(
    'get_audience_demographics',
    {
      title: 'Get follower demographics',
      description:
        'Break down your followers by country, city, age or gender (needs 100+ followers, a linked Instagram account and threads_manage_insights).',
      inputSchema: z.object({
        breakdown_by: z
          .array(z.enum(['country', 'city', 'age', 'gender']))
          .min(1)
          .default(['country', 'age', 'gender']),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ breakdown_by }) => {
      const client = ctx.client();
      const userId = await client.getUserId();
      const result: Record<string, unknown> = {};
      // The API accepts one breakdown per request.
      for (const breakdown of breakdown_by) {
        try {
          const res = await client.get<{ data: InsightValue[] }>(`/${userId}/threads_insights`, {
            metric: 'follower_demographics',
            breakdown,
          });
          result[breakdown] = res.data?.[0]?.total_value?.breakdowns ?? res.data;
        } catch (error) {
          result[breakdown] = { error: describeError(error) };
        }
      }
      return result;
    }),
  );

  server.registerTool(
    'get_content_performance_report',
    {
      title: 'Content performance report',
      description:
        'Build a performance report from your posts in a recent window: totals, averages, engagement rate, results by media type ' +
        'and your top posts. Uses one insights call per post.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(30).describe('Look-back window in days'),
        max_posts: z.number().int().min(1).max(200).default(50),
        rank_by: z.enum(['views', 'likes', 'replies', 'reposts', 'quotes', 'shares', 'engagement', 'engagement_rate']).default('engagement'),
        top: z.number().int().min(1).max(25).default(5),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ days, max_posts, rank_by, top }) => {
      const { since, until } = windowFromDays(days);
      const { stats, errors, skipped_reposts } = await collectPostStats(ctx.client(), since, until, max_posts);
      const totals = sumMetrics(stats);
      const byType: Record<string, { posts: number; avg_views: number; avg_engagement: number }> = {};
      for (const s of stats) {
        const key = s.media_type ?? 'UNKNOWN';
        const t = (byType[key] ??= { posts: 0, avg_views: 0, avg_engagement: 0 });
        t.posts++;
        t.avg_views += s.metrics.views ?? 0;
        t.avg_engagement += s.engagement;
      }
      for (const t of Object.values(byType)) {
        t.avg_views = round(t.avg_views / t.posts);
        t.avg_engagement = round(t.avg_engagement / t.posts);
      }
      const score = (s: PostStats) =>
        rank_by === 'engagement' ? s.engagement : rank_by === 'engagement_rate' ? s.engagement_rate ?? 0 : s.metrics[rank_by] ?? 0;
      const engagement = stats.reduce((sum, s) => sum + s.engagement, 0);
      return {
        window: { since: new Date(since * 1000).toISOString(), until: new Date(until * 1000).toISOString() },
        posts_analyzed: stats.length,
        skipped_reposts,
        totals: { ...totals, engagement },
        averages_per_post: stats.length
          ? Object.fromEntries(Object.entries({ ...totals, engagement }).map(([k, v]) => [k, round(v / stats.length)]))
          : {},
        overall_engagement_rate: totals.views ? round(engagement / totals.views, 4) : undefined,
        by_media_type: byType,
        top_posts: [...stats].sort((a, b) => score(b) - score(a)).slice(0, top),
        errors: errors.length ? errors : undefined,
      };
    }),
  );

  server.registerTool(
    'analyze_best_posting_times',
    {
      title: 'Best times to post',
      description:
        'Find the weekdays and hours when your own posts got the most views and engagement, in your timezone. ' +
        'Based on your post history, so more posts give a more reliable answer.',
      inputSchema: z.object({
        days: z.number().int().min(7).max(365).default(90),
        max_posts: z.number().int().min(5).max(200).default(100),
        timezone: z.string().default('UTC').describe('IANA timezone, e.g. Asia/Jakarta'),
        metric: z.enum(['views', 'engagement', 'engagement_rate']).default('engagement'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handler(async ({ days, max_posts, timezone, metric }) => {
      let parts: Intl.DateTimeFormat;
      try {
        parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: 'numeric', hourCycle: 'h23' });
      } catch {
        throw new Error(`Unknown timezone: ${timezone}`);
      }
      const { since, until } = windowFromDays(days);
      const { stats, errors } = await collectPostStats(ctx.client(), since, until, max_posts);
      const value = (s: PostStats) =>
        metric === 'views' ? s.metrics.views ?? 0 : metric === 'engagement' ? s.engagement : s.engagement_rate ?? 0;

      const buckets = { weekday: new Map<string, number[]>(), hour: new Map<string, number[]>(), slot: new Map<string, number[]>() };
      for (const s of stats) {
        const p = Object.fromEntries(parts.formatToParts(new Date(s.timestamp)).map((x) => [x.type, x.value]));
        const hour = `${p.hour.padStart(2, '0')}:00`;
        const add = (map: Map<string, number[]>, key: string) => map.set(key, [...(map.get(key) ?? []), value(s)]);
        add(buckets.weekday, p.weekday);
        add(buckets.hour, hour);
        add(buckets.slot, `${p.weekday} ${hour}`);
      }
      const rank = (map: Map<string, number[]>, minPosts = 1) =>
        [...map.entries()]
          .filter(([, v]) => v.length >= minPosts)
          .map(([key, v]) => ({ key, posts: v.length, [`avg_${metric}`]: round(v.reduce((a, b) => a + b, 0) / v.length, 4) }))
          .sort((a, b) => (b[`avg_${metric}`] as number) - (a[`avg_${metric}`] as number));

      return {
        timezone,
        metric,
        posts_analyzed: stats.length,
        best_weekdays: rank(buckets.weekday),
        best_hours: rank(buckets.hour).slice(0, 8),
        best_slots: rank(buckets.slot, stats.length >= 30 ? 2 : 1).slice(0, 8),
        caveat:
          stats.length < 20
            ? 'Fewer than 20 posts analysed; treat these results as a rough signal.'
            : 'Averages of your own past posts; timing is one factor among content, topic and audience.',
        errors: errors.length ? errors : undefined,
      };
    }),
  );
}
