# 🚀 Enterprise Threads MCP Server

A comprehensive MCP (Model Context Protocol) server for **professional Threads management** with enterprise-grade analytics, AI-powered optimization, and automation features.

## 🎯 **Enterprise-Ready Platform**

Complete social media management solution with advanced analytics, content optimization, and professional automation tools for businesses and power users.

## ✨ Enterprise Features

### 📊 **Phase 3A: Enhanced Analytics & Performance Analysis**
- **Advanced Insights**: Demographic breakdowns, geographic analysis, time-series data
- **Audience Analytics**: Detailed follower demographics and behavior patterns
- **Engagement Trends**: Comprehensive trend analysis with growth projections
- **AI-Driven Optimization**: Optimal posting times and performance recommendations
- **Business Intelligence**: Professional reporting with comprehensive metrics

### 🚀 **Phase 3B: Professional Content Creation & Automation**
- **AI Hashtag Suggestions**: Smart, industry-specific hashtag recommendations
- **Content Optimization**: Professional analysis with scoring and recommendations
- **Advanced Scheduling**: Automation with optimal timing and recurring posts
- **Bulk Operations**: Performance analysis, content audit, and data export
- **Website Integration**: Embed feeds, share buttons, and cross-platform sync
- **Carousel Posts**: Multi-media posts with accessibility features

### 🎯 **Core Management Features**
- **Content Management**: Create, view, search, and delete your threads
- **Analytics Dashboard**: Real-time insights and performance metrics
- **Interaction Management**: Handle replies, mentions, and user relationships
- **Search & Discovery**: Advanced search with filters and content discovery
- **Publishing Control**: Rate limits, scheduling, and automation

## 🚀 Quick Start

### Installation

```bash
npm install -g threads-mcp-server
```

### Configuration

Create a `.env` file with your Threads access token:

```env
THREADS_ACCESS_TOKEN=your_access_token_here
```

### Claude Desktop Setup

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "threads": {
      "command": "threads-mcp-server",
      "env": {
        "THREADS_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

## 🛠️ Available Tools

### Profile & Account Management

#### `get_my_profile`
Get your Threads profile information
```typescript
{
  fields?: string[] // Profile fields to retrieve
}
```

#### `get_my_insights`
Get analytics for your account
```typescript
{
  metrics: string[];    // e.g., ['followers_count', 'posts_count']
  period?: string;      // 'day', 'week', 'days_28', 'month', 'lifetime'
  since?: string;       // ISO 8601 date
  until?: string;       // ISO 8601 date
}
```

#### `get_publishing_limit`
Check your current posting quotas and limits
```typescript
{} // No parameters needed
```

### Content Management

#### `get_my_threads`
Get your own threads/posts
```typescript
{
  fields?: string[];    // Thread fields to retrieve
  limit?: number;       // Number of threads to get
  since?: string;       // ISO 8601 date filter
  until?: string;       // ISO 8601 date filter
}
```

#### `publish_thread`
Create and publish a new thread using Threads API two-step process
```typescript
{
  text: string;           // Thread content (required)
  media_type?: string;    // 'TEXT', 'IMAGE', 'VIDEO'
  media_url?: string;     // URL for media content
  location_name?: string; // Location tagging
}
```
*Note: This function implements the proper two-step Threads publishing flow: first creates a media container, then publishes it. The response includes both the container ID and final thread ID.*

#### `delete_thread`
Delete one of your threads
```typescript
{
  thread_id: string; // ID of your thread to delete
}
```

#### `search_my_threads`
Search within your own threads
```typescript
{
  query: string;   // Search keywords
  limit?: number;  // Threads to search through
}
```

### Thread Interactions

#### `get_thread_replies`
Get replies to your specific thread
```typescript
{
  thread_id: string;    // Your thread ID
  fields?: string[];    // Reply fields to retrieve
}
```

#### `manage_reply`
Hide or show replies to your threads
```typescript
{
  reply_id: string; // Reply ID to manage
  hide: boolean;    // true to hide, false to show
}
```

#### `get_mentions`
Get threads where you are mentioned
```typescript
{
  fields?: string[];  // Fields to retrieve
  limit?: number;     // Number of mentions
}
```

#### `create_reply`
Reply to a specific thread or post
```typescript
{
  reply_to_id: string;     // Thread/post ID to reply to (required)
  text: string;            // Reply content (required)
  media_type?: string;     // 'TEXT', 'IMAGE', 'VIDEO'
  media_url?: string;      // Media URL for IMAGE/VIDEO
  reply_control?: string;  // 'everyone', 'accounts_you_follow', etc.
}
```
*Note: Uses two-step process like publish_thread. Creates real replies that appear in thread conversations.*

#### `create_thread_chain`
Create connected reply chains for threaded conversations
```typescript
{
  parent_thread_id: string;  // Starting thread ID (required)
  replies: Array<{           // Array of replies (required)
    text: string;            // Reply text
    reply_control?: string;  // Who can reply to this reply
  }>;
}
```
*Note: Creates true threaded conversations where each reply responds to the previous one, enabling Twitter-like thread chains.*

### Analytics & Performance

#### `get_thread_insights`
Get performance metrics for your specific thread
```typescript
{
  thread_id: string;    // Your thread ID
  metrics: string[];    // e.g., ['views', 'likes', 'replies']
  period?: string;      // Time period for metrics
}
```

## 🏢 Enterprise Analytics & Automation Tools (Phase 3)

### 📊 Advanced Analytics

#### `get_enhanced_insights`
Get comprehensive analytics with demographic breakdowns
```typescript
{
  thread_id?: string;           // Optional thread ID for media insights
  metrics: string[];            // views, likes, replies, followers_count, follower_demographics
  period?: string;              // day, week, month, lifetime
  breakdown?: string[];         // country, city, age, gender
  since?: string;               // ISO 8601 start date
  until?: string;               // ISO 8601 end date
}
```

#### `get_audience_demographics`
Detailed audience demographic analysis
```typescript
{
  categories: string[];         // country, age, gender, city
  period?: string;             // day, week, month, lifetime
  breakdown?: string;          // Demographic breakdown level
}
```

#### `get_engagement_trends`
Time-series analysis of engagement patterns
```typescript
{
  metrics: string[];           // views, likes, replies, shares
  timeframe?: string;          // week, month, quarter
  granularity?: string;        // daily, weekly
}
```

#### `get_follower_growth_analytics`
Follower growth analysis with projections
```typescript
{
  period?: string;             // month, quarter, year
  include_projections?: boolean; // Include growth forecasts
  projection_days?: number;    // Days to project forward
}
```

#### `analyze_best_posting_times`
AI-driven optimal posting time analysis
```typescript
{
  analysis_period?: string;    // week, month, quarter
  timezone?: string;           // User's timezone
  content_type?: string;       // general, promotional, educational
}
```

#### `get_content_performance_report`
Comprehensive performance reporting
```typescript
{
  report_type: string;         // summary, detailed, top_performers
  period: string;              // week, month, quarter
  metrics: string[];           // Performance metrics to include
  include_comparisons?: boolean; // Period-over-period comparisons
}
```

### 🚀 Professional Content Creation & Automation

#### `auto_hashtag_suggestions`
AI-powered hashtag recommendations
```typescript
{
  content: string;             // Content to analyze
  media_url?: string;          // Optional media for visual analysis
  suggestion_settings?: {
    count?: number;            // Number of suggestions (1-10)
    style?: string;            // trending, niche, branded, mixed
    exclude_overused?: boolean; // Filter out overused hashtags
    industry_focus?: string;   // Industry/niche focus
  }
}
```

#### `content_optimization_analysis`
Professional content analysis with recommendations
```typescript
{
  content: string;             // Content to analyze
  analysis_type?: string;      // engagement, reach, accessibility, seo, comprehensive
  target_audience?: {
    demographics?: string[];   // Target demographic groups
    interests?: string[];      // Target interests
    timezone?: string;         // Primary audience timezone
  };
  optimization_goals?: string[]; // increase_engagement, expand_reach, etc.
}
```

#### `schedule_post`
Advanced scheduling with automation features
```typescript
{
  text: string;                // Post content
  media_url?: string;          // Optional media URL
  schedule_time?: string;      // ISO 8601 datetime for scheduling
  automation_settings?: {
    auto_optimize_time?: boolean; // Auto-optimize posting time
    recurring?: string;        // none, daily, weekly, monthly
    auto_hashtags?: boolean;   // Auto-add relevant hashtags
    content_variation?: boolean; // Create variations for recurring posts
  };
  timezone?: string;           // Timezone for scheduling
}
```

#### `create_carousel_post`
Multi-media carousel posts with accessibility
```typescript
{
  media_urls: string[];        // 2-10 image/video URLs
  text: string;                // Post caption
  alt_texts?: string[];        // Alt text for accessibility
  carousel_settings?: {
    auto_alt_text?: boolean;   // Generate alt text automatically
    aspect_ratio?: string;     // square, portrait, landscape
    thumbnail_selection?: string; // auto, first, custom
  }
}
```

#### `bulk_post_management`
Bulk operations and content management
```typescript
{
  action: string;              // analyze_performance, content_audit, export_data
  filters?: {
    date_range?: { start: string; end: string };
    content_type?: string;     // text, image, video, carousel
    performance_threshold?: string; // low, medium, high
  };
  bulk_operations?: {
    add_hashtags?: string[];   // Hashtags to add
    update_alt_text?: boolean; // Update alt text
    archive_low_performers?: boolean; // Archive underperforming posts
  }
}
```

#### `website_integration_setup`
Website integration and cross-platform sync
```typescript
{
  integration_type: string;    // embed_feed, share_buttons, webhook_setup, auto_crosspost
  website_config?: {
    domain?: string;           // Website domain
    platform?: string;        // wordpress, shopify, custom, react, vue, angular
    styling_preferences?: {
      theme?: string;          // light, dark, auto
      layout?: string;         // grid, list, carousel
      post_count?: number;     // Number of posts to display
    }
  };
  automation_settings?: {
    auto_sync?: boolean;       // Auto-sync new posts
    crosspost_enabled?: boolean; // Enable cross-posting
    webhook_url?: string;      // Webhook endpoint URL
  }
}
```

## 📊 Test Results

**Latest Test Results**: ✅ 10+ functions working + Complete Phase 1 implementation!

### Core Functions
| Tool | Status | Notes |
|------|--------|-------|
| `get_my_profile` | ✅ Working | Full profile data |
| `get_my_threads` | ✅ Working | Returns thread list |
| `search_my_threads` | ✅ Working | Client-side filtering |
| `get_publishing_limit` | ✅ Working | Quota information |
| `publish_thread` | ✅ Working | **Successfully publishes!** |
| `delete_thread` | ⚠️ Limited | Error 400 (endpoint issue) |
| `get_my_insights` | ⚠️ Limited | Error 500 (permission/endpoint) |

### Phase 1: Complete Engagement & Advanced Posting (NEW)
| Tool | Status | Notes |
|------|--------|-------|
| `create_reply` | ✅ **Phase 1** | **Creates real replies!** |
| `create_thread_chain` | ✅ **Phase 1** | **True threaded conversations!** |
| `quote_post` | ✅ **Phase 1A** | **Quote tweets with commentary!** |
| `like_post` | 🔧 **Phase 1A** | Implemented with fallback patterns |
| `unlike_post` | 🔧 **Phase 1A** | Implemented with fallback patterns |
| `repost_thread` | 🔧 **Phase 1A** | Implemented with fallback patterns |
| `unrepost_thread` | 🔧 **Phase 1A** | Implemented with fallback patterns |
| `get_post_likes` | 🔧 **Phase 1A** | Implemented with fallback patterns |
| `create_post_with_restrictions` | ✅ **Phase 1B** | **Advanced posts with hashtags!** |
| `schedule_post` | ✅ **Phase 1B** | **Future post scheduling!** |

**Total Tools**: 21 functions (11 original + 10 new Phase 1 features)

## 💡 Usage Examples

### Content Creation & Management
```bash
# Publish a new thread
@threads publish "Just testing my personal Threads manager! 🚀"

# Get my recent threads
@threads get my recent threads limit 10

# Search my content
@threads search "project" in my threads
```

### Phase 1A: Engagement & Interaction
```bash
# Quote another post with your commentary
@threads quote post 123456 "This is exactly what I was thinking! Adding my perspective..."

# Like and unlike posts
@threads like post 123456
@threads unlike post 123456

# Repost content (share to your timeline)
@threads repost thread 123456
@threads unrepost thread 123456

# Get engagement data
@threads get likes for post 123456 limit 50
```

### Phase 1B: Advanced Posting
```bash  
# Create post with hashtags and restrictions
@threads create advanced post "My latest project update!" 
  hashtags: ["WebDev", "MCP", "Threads"]
  mentions: ["techfriend", "developer"]
  reply_control: "followers_only"
  location: "San Francisco"

# Schedule posts for future publishing
@threads schedule post "Good morning! ☀️" 
  for: "2025-08-25T08:00:00+07:00"
  reply_control: "everyone"
```

### Reply & Thread Management
```bash
# Reply to a specific thread
@threads reply to thread 123456 "Great post! Thanks for sharing"

# Create a thread chain (multiple connected replies)
@threads create chain from thread 123456 with replies:
- "First point in my response 🧵"  
- "Second point continuing the thought"
- "Final point wrapping up"

# Get replies to my thread
@threads get replies to my thread 123456
```

### Analytics & Performance
```bash
# Check my publishing limits
@threads check my publishing quotas

# Get my profile stats
@threads get my profile information

# Get thread performance (if available)
@threads get insights for thread 123456
```

### Interaction Management
```bash
# Get replies to my thread
@threads get replies for my thread 123456

# Hide a reply
@threads hide reply 789012

# Get my mentions
@threads get where I am mentioned
```

## 🔧 Technical Details

### Personal Focus Benefits
- **No External User Limitations**: Only works with your own content
- **Full Access**: All permissions work on your own data
- **Reliable**: No privacy restrictions or access denials
- **Fast**: Direct API calls without workarounds

### Error Handling
- Automatic retry for transient errors
- Clear error messages for permission issues
- Graceful handling of API limitations

### Rate Limiting
- Built-in exponential backoff
- Respects Threads API rate limits
- Smart retry logic for temporary failures

## 🚨 Important Notes

### Permissions Required
Ensure your Threads app has these permissions enabled:
- `threads_basic` - Basic thread access
- `threads_content_publish` - Create/publish content
- `threads_delete` - Delete threads (if using delete functionality)
- `threads_manage_insights` - Analytics access
- `threads_manage_replies` - Reply management

### Limitations
- **Delete Function**: Currently returns 400 error (API endpoint needs verification)
- **Insights**: Some analytics endpoints return 500 error (may need additional permissions)
- **Personal Only**: Designed only for your own content management

## 📈 Roadmap

### Planned Improvements
- [ ] Fix delete thread endpoint
- [ ] Resolve insights API issues  
- [ ] Add batch operations
- [ ] Enhanced search filters
- [ ] Thread scheduling
- [ ] Content analytics dashboard

## 🤝 Contributing

This is a focused personal management tool. Feature requests should align with personal Threads management use cases.

## 📄 License

MIT

---

## 🎯 **Perfect For:**
- **Content Creators**: Manage your Threads content efficiently
- **Social Media Managers**: Handle personal brand accounts  
- **Analysts**: Track your own content performance
- **Developers**: Integrate Threads into personal workflows

**Focus**: Your content, your control, your insights! 🚀