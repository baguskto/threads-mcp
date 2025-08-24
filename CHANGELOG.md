# Changelog

All notable changes to the Threads MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.1] - 2024-08-24

### 🧹 Project Cleanup & Organization

#### Changed
- Moved all test files to `tests/` directory for better organization
- Enhanced `.gitignore` with comprehensive patterns
- Added `.npmignore` for optimized NPM package size
- Updated server name to match package name
- Added clean and lint scripts to package.json

#### Added
- Comprehensive `CHANGELOG.md` with full version history
- `CONTRIBUTING.md` with contribution guidelines
- `.env.example` for easy project setup

#### Fixed
- Version consistency across all files
- Removed empty utils directory
- Organized project structure following best practices

## [4.0.0] - 2024-08-24

### 🚀 Major Release - Enterprise Platform

#### Added - Phase 3A: Enhanced Analytics & Performance Analysis
- `get_enhanced_insights` - Advanced metrics with demographic breakdowns
- `get_audience_demographics` - Geographic and demographic analysis
- `get_engagement_trends` - Time-series trend analysis
- `get_follower_growth_analytics` - Analytics with growth projections
- `analyze_best_posting_times` - AI-driven optimal timing analysis
- `get_content_performance_report` - Comprehensive business intelligence

#### Added - Phase 3B: Professional Content Creation & Automation
- `create_carousel_post` - Multi-media carousel posts with accessibility
- `schedule_post` - Advanced scheduling with automation features
- `auto_hashtag_suggestions` - AI-powered hashtag recommendations
- `content_optimization_analysis` - Professional content analysis with scoring
- `bulk_post_management` - Performance analysis and content audit at scale
- `website_integration_setup` - Embed feeds and cross-platform sync

#### Changed
- Updated package description to reflect enterprise capabilities
- Enhanced README with comprehensive Phase 3 documentation
- Added professional keywords for better NPM discoverability

## [3.0.0] - 2024-08-23

### 🎯 Phase 2 Complete - Search & User Management

#### Added - Phase 2A: Content Discovery & Search
- `search_posts` - Keyword-based post search
- `search_by_hashtags` - Hashtag-based content discovery
- `search_mentions` - Monitor brand mentions
- `get_trending_posts` - Discover trending content
- `search_by_topics` - Topic-based search

#### Added - Phase 2B: User Discovery & Management
- `search_users` - Find users by username/name
- `get_user_followers` - Get follower lists
- `get_user_following` - Get following lists
- `follow_user` - Follow users programmatically
- `unfollow_user` - Unfollow users
- `block_user` - Block users

## [2.0.0] - 2024-08-22

### 🎉 Phase 1 Complete - Engagement Platform

#### Added - Phase 1A: Engagement & Interaction
- `quote_thread` - Quote posts with commentary
- `like_thread` - Like posts
- `unlike_thread` - Unlike posts
- `repost_thread` - Share to timeline
- `unrepost_thread` - Remove reposts
- `get_likes` - Get list of users who liked

#### Added - Phase 1B: Advanced Posting
- `publish_advanced_thread` - Posts with hashtags, mentions, restrictions
- `schedule_post` - Schedule future posts
- `create_thread_chain` - Multi-reply thread chains

## [1.0.0] - 2024-08-21

### 🚀 Initial Release - Core Features

#### Added - Core Functionality
- `get_my_profile` - Get profile information
- `get_my_threads` - List user's threads
- `publish_thread` - Create new posts with media support
- `delete_thread` - Delete threads
- `get_my_insights` - Basic analytics
- `get_publishing_limit` - Check rate limits
- `reply_to_thread` - Reply to threads
- `search_my_threads` - Search within own content
- `get_thread_replies` - Get replies to a thread
- `get_mentions` - Get mentions of user

#### Infrastructure
- TypeScript implementation with strict mode
- MCP SDK integration
- Threads API client with OAuth support
- Comprehensive error handling
- Rate limit awareness

## [0.1.0] - 2024-08-20

### 🏗️ Project Setup

#### Added
- Initial project structure
- Basic TypeScript configuration
- MCP server setup
- Package.json with dependencies
- MIT License
- README documentation

---

## Roadmap

### Future Phases (Under Consideration)
- **Phase 4**: Advanced AI Integration
  - Sentiment analysis
  - Content generation assistance
  - Automated responses
  - Trend prediction

- **Phase 5**: Enterprise Administration
  - Team collaboration features
  - Role-based access control
  - Audit logging
  - Compliance tools

### API Limitations Being Monitored
- Carousel post creation (awaiting API support)
- Native post scheduling (currently configuration only)
- Real-time webhooks (limited availability)
- Advanced demographic filters (100+ followers required)

---

## Migration Guide

### From 3.x to 4.0
- New enterprise features require additional API permissions
- Demographic data requires minimum 100 followers
- Some features return configuration for external tools due to API limitations

### From 2.x to 3.0
- Search functions now use keyword_search endpoint
- User management functions have fallback patterns
- Rate limits apply to search operations (2200 queries/day)

### From 1.x to 2.0
- Engagement functions fully implemented
- Advanced posting features available
- Thread chain creation supported

---

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/baguskto/threads-mcp/issues
- NPM Package: https://www.npmjs.com/package/threads-mcp-server
- Documentation: See README.md for detailed API documentation

---

*Maintained by @baguskto*