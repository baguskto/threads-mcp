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
    
    // Test enhanced insights
    const enhancedRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_enhanced_insights',
        arguments: {
          metrics: ['views', 'likes', 'followers_count'],
          period: 'lifetime'
        }
      },
      id: 2
    });
    
    console.log('🔍 Testing get_enhanced_insights...');
    server.stdin.write(enhancedRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 15000);
  }
});

setTimeout(() => {
  console.log('❌ Simple Phase 3A test timed out');
  server.kill();
  process.exit(1);
}, 20000);