# Meta Threads MCP Server

A comprehensive Model Context Protocol (MCP) server for Meta's Threads API, enabling data analysis, content management, and analytics capabilities.

## Features

- **User Management**: Retrieve user profiles and current user information
- **Content Retrieval**: Access threads, media objects, replies, and conversations
- **Analytics & Insights**: Get detailed performance metrics and account analytics
- **Search Functionality**: Search threads by keywords and hashtags
- **Content Moderation**: Manage and moderate replies
- **Rate Limiting**: Built-in rate limiting and quota management

## Installation

```bash
npm install @threads/mcp-server
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Meta Threads API Configuration
THREADS_ACCESS_TOKEN=your_access_token_here

# Server Configuration (optional)
MCP_SERVER_NAME=threads-mcp
LOG_LEVEL=info
RATE_LIMIT_REQUESTS_PER_HOUR=200
CACHE_TTL_SECONDS=3600
CACHE_ENABLED=true
```

### Obtaining Access Token

1. Visit [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add the Threads API product to your app
4. Generate an access token with the required permissions
5. Convert short-lived token to long-lived token if needed

## Usage

### With Claude Desktop

Add the server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "threads": {
      "command": "npx",
      "args": ["@threads/mcp-server"],
      "env": {
        "THREADS_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

### Available Tools

#### User Management

- **get_user_profile**: Retrieve a user's Threads profile information
  ```typescript
  {
    userId: string;
    fields?: string[];
  }
  ```

- **get_current_user**: Get the authenticated user's profile
  ```typescript
  {
    userFields?: string[];
  }
  ```

- **get_user_threads**: Retrieve a user's threads/posts
  ```typescript
  {
    userId: string;
    fields?: string[];
    since?: string;
    until?: string;
    limit?: number;
  }
  ```

#### Content Tools

- **get_media_object**: Get details of a specific thread/media object
  ```typescript
  {
    mediaId: string;
    mediaFields?: string[];
  }
  ```

- **get_replies**: Retrieve replies to a specific thread
  ```typescript
  {
    mediaId: string;
    fields?: string[];
    reverse?: boolean;
    since?: string;
    until?: string;
  }
  ```

- **get_conversation**: Get full conversation thread
  ```typescript
  {
    conversationId: string;
    fields?: string[];
    reverse?: boolean;
  }
  ```

- **manage_reply**: Hide or show replies (moderation)
  ```typescript
  {
    replyId: string;
    hide: boolean;
  }
  ```

- **get_publishing_limit**: Check posting quotas and limits
  ```typescript
  {
    limitUserId: string;
  }
  ```

#### Analytics Tools

- **get_media_insights**: Retrieve performance metrics for specific posts
  ```typescript
  {
    mediaId: string;
    metrics: string[];
    period?: string;
    since?: string;
    until?: string;
  }
  ```

- **get_account_insights**: Get account-level analytics
  ```typescript
  {
    userId: string;
    metrics: string[];
    period?: string;
    since?: string;
    until?: string;
  }
  ```

#### Search Tools

- **search_threads**: Search for threads by keyword or hashtag
  ```typescript
  {
    query: string;
    type?: 'top' | 'recent';
    count?: number;
    since?: string;
    until?: string;
  }
  ```

## Available Metrics

### Media Insights
- `views`: Number of times the media was viewed
- `likes`: Number of likes
- `replies`: Number of replies
- `reposts`: Number of reposts
- `quotes`: Number of quote posts
- `reach`: Unique accounts reached
- `impressions`: Total impressions
- `shares`: Number of shares
- `total_interactions`: Total engagement

### Account Insights
- `followers_count`: Current follower count
- `following_count`: Current following count
- `posts_count`: Total number of posts
- `profile_views`: Profile view count
- `reach`: Account reach
- `impressions`: Account impressions
- `website_clicks`: Website click count
- `follower_demographics`: Demographic data

## Examples

### Basic User Analysis
```javascript
// Get user profile
const profile = await tools.get_user_profile({
  userId: "12345",
  fields: ["id", "username", "name", "threads_biography"]
});

// Get recent threads
const threads = await tools.get_user_threads({
  userId: "12345",
  limit: 50,
  since: "2024-01-01"
});
```

### Content Performance Analysis
```javascript
// Get thread insights
const insights = await tools.get_media_insights({
  mediaId: "thread123",
  metrics: ["views", "likes", "replies"],
  period: "lifetime"
});

// Get account analytics
const analytics = await tools.get_account_insights({
  userId: "12345",
  metrics: ["followers_count", "posts_count"],
  period: "days_28"
});
```

### Search and Discovery
```javascript
// Search for threads
const results = await tools.search_threads({
  query: "#technology",
  type: "recent",
  count: 25
});
```

## Error Handling

The server includes comprehensive error handling for:
- Invalid authentication tokens
- Rate limiting exceeded
- Network timeouts
- Invalid parameters
- Permission denied scenarios

## Rate Limiting

The server implements rate limiting to comply with Threads API limits:
- Default: 200 requests per hour
- Configurable via environment variables
- Automatic retry with exponential backoff

## Security Considerations

- **Token Security**: Store access tokens securely in environment variables
- **Scope Validation**: Ensure your token has the required permissions
- **Data Privacy**: Handle user data according to privacy regulations
- **HTTPS Only**: All API communications use HTTPS

## Development

### Building from Source
```bash
npm install
npm run build
```

### Testing
```bash
npm test
```

### Running in Development Mode
```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **Authentication Error**: Verify your access token is valid and has the required permissions
2. **Rate Limit Exceeded**: Wait for the rate limit window to reset or reduce request frequency
3. **Permission Denied**: Check if your app has the necessary Threads API permissions
4. **Network Timeout**: Increase timeout settings or check your network connection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and feature requests, please visit our [GitHub repository](https://github.com/baguskto/threads-mcp).

## Changelog

### Version 1.0.0
- Initial release with full Threads API coverage
- User management tools
- Content retrieval and management
- Analytics and insights
- Search functionality
- Rate limiting and caching