# Threads MCP Server

An [MCP](https://modelcontextprotocol.io) server for the **official Meta Threads API**. Let Claude (or any MCP client) publish posts, carousels, polls, replies and quotes, read your posts, replies, mentions and insights, search public posts, and schedule posts — using only endpoints Meta documents.

- Built on the MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), works with clients on protocol 2024-11-05 through 2025-11-25
- 42 tools, each annotated as read-only or write so clients can auto-approve reads and confirm writes
- Waits for media processing before publishing, retries transient errors, and validates posts before anything goes live
- Optional read-only mode, and no token required just to start the server and list tools

> **v6 is a rewrite.** Tools that called endpoints the Threads API does not have (likes, follows, blocks, follower lists, trending) were removed, and several were renamed or merged. See [Migrating from v5](#migrating-from-v5).

## Quick start

### 1. Get an access token

1. Create an app at [developers.facebook.com](https://developers.facebook.com/apps) and add the **Threads API** use case.
2. Add yourself as a Threads tester and accept the invite in Threads (Settings → Account → Website permissions).
3. Request the scopes you need (see [Permissions](#permissions)); `threads_basic` and `threads_content_publish` cover posting.
4. Generate a user token, then turn it into a **long-lived token** (60 days). You can do the exchange from the server with `exchange_for_long_lived_token` if you set `THREADS_APP_SECRET`.

A Threads profile no longer needs a linked Instagram account, except for follower counts and demographics.

### 2. Add the server to your client

**Claude Code**

```bash
claude mcp add threads --env THREADS_ACCESS_TOKEN=your_token -- npx -y threads-mcp-server
```

**Claude Desktop** (`claude_desktop_config.json`) and other clients that use the same format:

```json
{
  "mcpServers": {
    "threads": {
      "command": "npx",
      "args": ["-y", "threads-mcp-server"],
      "env": {
        "THREADS_ACCESS_TOKEN": "your_long_lived_token"
      }
    }
  }
}
```

Requires Node.js 20 or newer.

### 3. Check the setup

Ask the assistant to run `validate_setup`. It confirms the token works, shows when it expires, and lists missing scopes together with the tools they unlock.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `THREADS_ACCESS_TOKEN` | yes | Long-lived Threads user token |
| `THREADS_USER_ID` | no | Your Threads user ID; skips one `/me` lookup |
| `THREADS_APP_SECRET` | no | Enables `exchange_for_long_lived_token` |
| `THREADS_READ_ONLY` | no | `true` to expose only read tools (no publishing, deleting or scheduling) |
| `THREADS_PUBLISH_WAIT_SECONDS` | no | How long a publish call waits for media processing before returning the pending container (default 45) |
| `THREADS_SCHEDULE_FILE` | no | Where scheduled posts are stored (default `~/.threads-mcp/scheduled-posts.json`) |
| `THREADS_API_VERSION` | no | Graph API version (default `v1.0`) |
| `THREADS_API_BASE_URL` | no | Graph host (default `https://graph.threads.net`; must be HTTPS) |

Configuration is read only from the environment your MCP client passes in. A `.env` file in the working directory is intentionally ignored, because clients often launch servers inside projects you may not trust.

## Tools

### Account

| Tool | What it does |
| --- | --- |
| `get_my_profile` | Your profile: username, name, bio, avatar, verification |
| `validate_setup` | Token check, expiry, granted vs. missing scopes |
| `get_publishing_limit` | 24-hour quota usage for posts (250), replies (1,000), deletes (100), location searches (500) |
| `refresh_access_token` | Extend a long-lived token by 60 days and use it for the session |
| `exchange_for_long_lived_token` | Swap a short-lived token for a long-lived one (needs `THREADS_APP_SECRET`) |

### Publishing

| Tool | What it does |
| --- | --- |
| `publish_thread` | Text, image or video post. Text posts can add a link preview, a poll (2–4 options), a GIPHY GIF, a long-form text attachment (up to 10,000 characters) or be a 24-hour ghost post. Every post can set spoiler ranges, a topic tag, reply control, location, country allowlist, reply approvals and Instagram Story cross-sharing. `publish: false` creates a draft container instead. |
| `create_carousel_post` | 2–20 images and/or videos with alt text |
| `create_reply` | Reply to a post, with the same options as `publish_thread` |
| `quote_post` | Quote another post |
| `create_thread_chain` | Multi-part thread; every part is validated before the first one goes live, and a failure tells you where to resume |
| `repost_thread` | Repost a post |
| `delete_thread` | Delete one of your posts |
| `get_container_status` / `publish_container` | Inspect and publish a container later (drafts, or slow videos) |

Video and image processing can take a while. A publish call waits up to 45 seconds (so it finishes before typical MCP client timeouts) and sends progress notifications while it waits; if the media is still processing after that, it returns the pending `container_id` instead of failing, and `publish_container` finishes the job. Cancelling a request stops it before anything is published.

### Scheduling

The Threads API has no native scheduling, so `schedule_post` saves the post locally and this server publishes it at the requested time. The server has to be running then; anything overdue is published as soon as it starts. Media containers are created at publish time, since they expire after 24 hours.

| Tool | What it does |
| --- | --- |
| `schedule_post` | Schedule a post, reply, quote or carousel for an ISO 8601 time |
| `list_scheduled_posts` | Pending, published, failed and cancelled posts with their results |
| `cancel_scheduled_post` | Cancel a pending post |

### Reading

| Tool | What it does |
| --- | --- |
| `get_my_threads` | Your posts, with date filters |
| `get_thread` | One post by ID |
| `search_my_threads` | Find text in your own posts |
| `get_mentions` | Public posts that mention you |
| `get_ghost_posts` | Your ghost posts |
| `get_poll_results` | Options, vote percentages and expiry of a poll |
| `lookup_profile` / `get_profile_posts` | Public profiles and their posts, by username |
| `get_oembed` | Embed HTML for a post |
| `create_web_intent_link` | A threads.com link that opens a prefilled composer or a follow prompt — for things the API can't do, like following |

### Replies

| Tool | What it does |
| --- | --- |
| `get_thread_replies` | Top-level replies to a post |
| `get_conversation` | The whole conversation, flattened |
| `get_my_replies` | Replies you posted |
| `manage_reply` | Hide or unhide a reply |
| `get_pending_replies` / `manage_pending_reply` | Review replies on posts published with reply approvals |

### Insights

| Tool | What it does |
| --- | --- |
| `get_thread_insights` | Views, likes, replies, reposts, quotes and shares for a post |
| `get_my_insights` | Account views (per day), likes, replies, reposts, quotes, link clicks and follower count |
| `get_audience_demographics` | Followers by country, city, age or gender (100+ followers) |
| `get_content_performance_report` | Totals, averages, engagement rate, results by media type and top posts over a window, from real per-post insights |
| `analyze_best_posting_times` | Weekdays and hours when your own posts performed best, in your timezone |

### Search and locations

| Tool | What it does |
| --- | --- |
| `search_posts` | Keyword or topic-tag search, TOP or RECENT, filtered by media type, author and date |
| `get_recently_searched_keywords` | Your recent searches |
| `search_locations` / `get_location` | Find location IDs to tag |

## Permissions

| Scope | Unlocks |
| --- | --- |
| `threads_basic` | Every tool |
| `threads_content_publish` | Posts, carousels, quotes, reposts, thread chains |
| `threads_manage_replies` | Publishing replies, hiding replies, reply approvals |
| `threads_read_replies` | Reading replies and conversations |
| `threads_manage_insights` | Insights, demographics, reports |
| `threads_manage_mentions` | Mentions |
| `threads_keyword_search` | Searching beyond your own posts |
| `threads_delete` | Deleting posts |
| `threads_location_tagging` | Location search and tagging |
| `threads_profile_discovery` | Public profile lookup |
| `threads_share_to_instagram` | Cross-sharing to Instagram Stories |

Until Meta approves an advanced permission, some tools only see your own or your testers' data — for example, search returns only your posts and profile lookup works only for official Meta accounts.

## What the Threads API can't do

There are no endpoints for liking, following, blocking, listing followers, listing likers, trending feeds, direct messages, editing posts, uploading files (media must be public URLs) or undoing a repost. This server doesn't pretend otherwise. For following, `create_web_intent_link` gives you a link to click.

## Migrating from v5

| v5 tool | v6 |
| --- | --- |
| `like_post`, `unlike_post`, `get_post_likes` | Removed — no API endpoint. Like counts are in `get_thread_insights`. |
| `follow_user`, `unfollow_user`, `block_user`, `get_user_followers`, `get_user_following` | Removed — no API endpoint. Use `create_web_intent_link` for follow links. |
| `unrepost_thread` | Removed — not supported by the API |
| `get_trending_posts` | Use `search_posts` with `search_type: "TOP"` |
| `search_users` | `lookup_profile` (exact username) |
| `search_mentions` | `get_mentions` |
| `search_by_hashtags`, `search_by_topics` | `search_posts` with `search_mode: "TAG"` |
| `create_post_with_restrictions` | `publish_thread` (`reply_control`, `allowlisted_country_codes`, `topic_tag`) |
| `get_enhanced_insights`, `get_engagement_trends`, `get_follower_growth_analytics` | `get_my_insights` / `get_thread_insights` |
| `schedule_post` (two conflicting versions) | `schedule_post` with `publish_at`, plus `list_scheduled_posts` and `cancel_scheduled_post` |
| `auto_hashtag_suggestions`, `content_optimization_analysis` | Removed — they were keyword heuristics; your assistant does this better directly |
| `bulk_post_management` | `get_content_performance_report` |
| `website_integration_setup` | `get_oembed` |
| `create_carousel_post` `media_urls` / `alt_texts` | `items: [{ url, type?, alt_text? }]` |
| `publish_thread` `media_type` + `media_url` | Still accepted; prefer `image_url` / `video_url` |
| `get_thread_replies` `reverse` | `oldest_first` |

## Development

```bash
npm install
npm run typecheck
npm test          # unit and tool tests against a mocked Threads API, no token needed
npm run build
npm run dev       # run from source with tsx
```

The code is split into `src/threads` (HTTP client, publishing flow, errors) and `src/tools` (one module per tool group). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
