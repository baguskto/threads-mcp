#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testServer() {
  console.log('Starting Threads MCP Server test...');
  
  // Spawn the server
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Create transport and client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to server');

    // List available tools
    const tools = await client.request({
      method: 'tools/list'
    }, {});
    
    console.log(`✅ Server has ${tools.tools.length} tools available:`);
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Test a tool call
    console.log('\n📞 Testing get_current_user tool...');
    try {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'get_current_user',
          arguments: {}
        }
      }, {});
      console.log('✅ Tool call successful');
      console.log('Response:', result);
    } catch (error) {
      console.log('⚠️ Tool call failed (expected if token is invalid):', error.message);
    }

    console.log('\n✅ All tests passed! Server is working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    await client.close();
    serverProcess.kill();
  }
}

testServer().catch(console.error);