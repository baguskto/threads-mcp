import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('STDERR:', message);
  
  if (message.includes('Personal Manager MCP server running')) {
    console.log('✅ Server started');
    
    // Test create_post_with_restrictions
    const restrictedPostRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'create_post_with_restrictions',
        arguments: {
          text: '[PHASE 1B] Advanced post test with hashtags!',
          hashtags: ['MCPTest', 'Phase1B'],
          reply_control: 'everyone'
        }
      },
      id: 2
    });
    
    console.log('📤 Testing advanced post...');
    server.stdin.write(restrictedPostRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 10000);
  }
});

setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 15000);