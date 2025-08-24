import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('STDERR:', message);
  
  if (message.includes('Personal Manager MCP server running')) {
    console.log('✅ Server started');
    
    // Test hashtag suggestions
    const hashtagRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'auto_hashtag_suggestions',
        arguments: {
          content: 'Working on exciting new AI technology for developers',
          suggestion_settings: {
            count: 3,
            style: 'tech',
            exclude_overused: true
          }
        }
      },
      id: 2
    });
    
    console.log('🔍 Testing auto_hashtag_suggestions...');
    server.stdin.write(hashtagRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 15000);
  }
});

setTimeout(() => {
  console.log('❌ Simple Phase 3B test timed out');
  server.kill();
  process.exit(1);
}, 20000);