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

# Build the project
npm run build

# Run linting
npm run lint
```

## 📝 Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run lint` to check for issues
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
│   ├── index.ts          # Main server implementation
│   └── api/
│       ├── client.ts      # Threads API client
│       └── types.ts       # TypeScript types
├── tests/                 # Test files
├── dist/                  # Compiled JavaScript (git-ignored)
└── package.json          # Project configuration
```

## ✅ Testing

When adding new features:
1. Create test files in the `tests/` directory
2. Follow the naming pattern: `test-feature-name.mjs`
3. Test against the real Threads API when possible
4. Document any API limitations discovered

## 📊 Code Style

- Use TypeScript for all source files
- Follow existing code patterns
- Add proper error handling
- Include JSDoc comments for public functions
- Keep functions focused and modular

## 🚀 Adding New Tools

When adding new MCP tools:

1. Add tool definition in `ListToolsRequestSchema` handler
2. Implement handler in `CallToolRequestSchema` switch
3. Follow the existing pattern:
   ```typescript
   case 'your_tool_name':
     // Implementation
     break;
   ```
4. Add comprehensive error handling
5. Document in README.md
6. Update CHANGELOG.md

## 📖 Documentation

- Update README.md for new features
- Add entries to CHANGELOG.md
- Include TypeScript types in tool descriptions
- Provide usage examples

## 🔍 API Considerations

Be aware of Threads API limitations:
- Rate limits (50 posts/day, 2200 searches/day)
- Permission requirements (threads_basic, threads_manage_insights)
- Minimum follower requirements (100+ for demographics)
- Features in development (carousel posts, native scheduling)

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