import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Look for complete JSON-RPC messages
  const lines = buffer.split('\n');
  for (const line of lines) {
    if (line.trim() && line.startsWith('{')) {
      try {
        const response = JSON.parse(line);
        console.log('📦 Response:', JSON.stringify(response, null, 2));
        if (response.result && response.result.tools) {
          console.log(`\n✅ Server working! Found ${response.result.tools.length} tools:`);
          response.result.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
          });
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not JSON or incomplete
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('🔧 Server log:', message.trim());
  
  if (message.includes('running on stdio')) {
    // Server is ready, send list tools request
    const request = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    };
    
    const message_str = JSON.stringify(request);
    const content_length = Buffer.byteLength(message_str);
    const full_message = `Content-Length: ${content_length}\r\n\r\n${message_str}`;
    
    console.log('📤 Sending request:', request);
    server.stdin.write(full_message);
  }
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 5000);