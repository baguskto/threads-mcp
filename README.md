# 📱 Threads Personal Manager - MCP Server

A focused MCP (Model Context Protocol) server for **personal Threads management**. Manage your own Threads content, analytics, and interactions with ease.

## 🎯 **Personal Management Focus**

This MCP server is designed specifically for managing **YOUR OWN** Threads content. No more external user limitations - just powerful personal content management tools.

## ✨ Features

- **Content Management**: Create, view, search, and delete your threads
- **Analytics**: Get insights on your account and thread performance  
- **Interaction Management**: Handle replies and mentions
- **Search**: Find content within your own threads
- **Publishing Control**: Check limits and manage your posting

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