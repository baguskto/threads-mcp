#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'threads-test',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const testTool = {
  name: 'test_tool',
  description: 'A test tool',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Test message',
      },
    },
    required: ['message'],
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('Received ListTools request');
  return {
    tools: [testTool],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('Received CallTool request:', request.params.name);
  return {
    content: [
      {
        type: 'text',
        text: `Called ${request.params.name} with ${JSON.stringify(request.params.arguments)}`,
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});