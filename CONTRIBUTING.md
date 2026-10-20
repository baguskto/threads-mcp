# Contributing to Threads MCP Server

Thank you for your interest in contributing to the Threads MCP Server! This document provides guidelines and instructions for contributing to the project.

## 🤝 Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming and inclusive environment for all contributors.

## 🐛 Reporting Issues

1. Check existing issues to avoid duplicates
2. Use the issue template when available
3. Provide clear reproduction steps
4. Include relevant error messages and logs
5. Specify your environment (Node version, OS, etc.)

## 💡 Suggesting Features

1. Check the roadmap in CHANGELOG.md
2. Open a discussion before implementing major features
3. Explain the use case and benefits
4. Consider API limitations documented in the README

## 🔧 Development Setup

```bash
# Clone the repository
git clone https://github.com/baguskto/threads-mcp.git
cd threads-mcp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your THREADS_ACCESS_TOKEN to .env

# Run in development mode
npm run dev

# Type-check, test and build
npm run typecheck
npm test
npm run build
```

## 📝 Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run typecheck` and `npm test`
5. Commit with descriptive messages
6. Push to your fork
7. Open a Pull Request

### Commit Message Format

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Formatting changes
- `refactor:` Code restructuring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

Example: `feat: add bulk post scheduling feature`

## 🏗️ Project Structure

```
threads-mcp/
├── src/
│   ├── index.ts          # Entry point (stdio transport)
│   ├── server.ts         # Creates the McpServer and registers tool groups
│   ├── config.ts         # Environment variables
│   ├── scheduler.ts      # Local scheduled-post queue
│   ├── threads/          # Threads API client, publishing flow, errors, field lists
│   └── tools/            # One module per tool group (account, posts, publishing, replies, insights, search)
├── test/                 # node:test suites run against a mocked Threads API
├── tests/                # Legacy manual scripts (not run in CI)
└── dist/                 # Compiled output (git-ignored)
```

## ✅ Testing

- Tests live in `test/*.test.ts` and run with `npm test` — no token needed.
- Use the `mockFetch` / `testClient` helpers in `test/helpers.ts` to stub Threads API responses and assert on the requests the server sends.
- Every new tool should have at least one test covering the request it makes.

## 📊 Code Style

- Use TypeScript for all source files
- Follow existing code patterns
- Add proper error handling
- Include JSDoc comments for public functions
- Keep functions focused and modular

## 🚀 Adding New Tools

1. Add the tool to the matching module in `src/tools/` with `server.registerTool(name, { title, description, inputSchema, annotations }, handler(...))`.
2. Use a zod `inputSchema` and set `annotations.readOnlyHint` correctly — read-only mode relies on it.
3. Only call endpoints documented at [developers.facebook.com/docs/threads](https://developers.facebook.com/docs/threads).
4. Add a test in `test/tools.test.ts`.
5. Document it in README.md and CHANGELOG.md.

## 📖 Documentation

- Update README.md for new features
- Add entries to CHANGELOG.md
- Include TypeScript types in tool descriptions
- Provide usage examples

## 🔍 API Considerations

Be aware of Threads API limitations (see LIMITASI_DAN_SOLUSI.md):
- Rate limits: 250 posts, 1,000 replies, 100 deletes and 2,200 keyword searches per 24 hours
- Advanced access is needed before search, profile lookup and mentions return other people's content
- 100+ followers for demographics
- No endpoints for likes, follows, follower lists or native scheduling

## 📦 Release Process

Releases are managed by maintainers:
1. Update version in package.json
2. Update CHANGELOG.md
3. Build and test thoroughly
4. Publish to NPM
5. Create GitHub release

## 🙏 Recognition

Contributors will be recognized in:
- GitHub contributors list
- CHANGELOG.md for significant contributions
- Special mentions for major features

## 📫 Contact

- GitHub Issues: Best for bugs and features
- Discussions: For questions and ideas
- Email: For security issues (see SECURITY.md)

Thank you for contributing to make Threads MCP Server better!