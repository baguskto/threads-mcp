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
    
    // Get tools list to count total functions
    const listRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    });
    
    console.log('📊 Getting total tool count...');
    server.stdin.write(listRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 5000);
  }
});

setTimeout(() => {
  console.log('❌ Tools count test timed out');
  server.kill();
  process.exit(1);
}, 10000);