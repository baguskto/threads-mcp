#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { createServer, VERSION } from './server.js';

// Load a local .env if present. stdout carries the MCP protocol, so nothing
// here may print to it.
try {
  process.loadEnvFile?.();
} catch {
  // No .env file; rely on the environment set by the MCP client.
}

async function main() {
  const { server, scheduler } = createServer(loadConfig());
  scheduler?.start();
  await server.connect(new StdioServerTransport());
  console.error(`threads-mcp-server v${VERSION} running on stdio`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
