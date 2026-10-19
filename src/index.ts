#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { createServer, VERSION } from './server.js';

// Configuration comes only from the environment the MCP client passes in. A
// .env in the working directory is deliberately not read: the client may
// launch this server inside an untrusted project. stdout carries the MCP
// protocol, so log to stderr only.
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
