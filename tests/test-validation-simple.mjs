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
    
    // Test the new validation tool
    const validationRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'validate_setup',
        arguments: {
          check_scopes: true
        }
      },
      id: 2
    });
    
    console.log('🔍 Testing validate_setup tool...');
    server.stdin.write(validationRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 15000);
  }
});

setTimeout(() => {
  console.log('❌ Simple validation test timed out');
  server.kill();
  process.exit(1);
}, 20000);