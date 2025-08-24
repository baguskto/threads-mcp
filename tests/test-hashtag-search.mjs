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
    
    // Test hashtag search
    const hashtagRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_by_hashtags',
        arguments: {
          hashtags: ['AI', 'tech'],
          limit: 3
        }
      },
      id: 2
    });
    
    console.log('🔍 Testing hashtag search...');
    server.stdin.write(hashtagRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 15000);
  }
});

setTimeout(() => {
  console.log('❌ Hashtag test timed out');
  server.kill();
  process.exit(1);
}, 20000);