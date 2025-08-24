import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📦 Raw server output:', JSON.stringify(output));
  
  buffer += output;
  
  // Try to find JSON-RPC responses
  const lines = buffer.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('Content-Length'))) {
      console.log('📄 Line:', trimmed);
      if (trimmed.startsWith('{')) {
        try {
          const response = JSON.parse(trimmed);
          console.log('✅ Parsed response:', response);
          if (response.result) {
            server.kill();
            process.exit(0);
          }
        } catch (e) {
          console.log('❌ JSON parse error:', e.message);
        }
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('🔧 Server stderr:', message.trim());
  
  if (message.includes('running on stdio')) {
    console.log('✅ Server ready, sending request...');
    
    // Send just the JSON, no HTTP headers
    const request = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    });
    
    console.log('📤 Sending:', request);
    server.stdin.write(request + '\n');
  }
});

server.on('error', (error) => {
  console.error('💥 Server error:', error);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);