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
    
    // Test schedule_post with future time
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 1); // 1 hour from now
    
    const scheduleRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'schedule_post',
        arguments: {
          text: '[PHASE 1B] Scheduled post test!',
          scheduled_publish_time: futureTime.toISOString(),
          reply_control: 'everyone'
        }
      },
      id: 2
    });
    
    console.log('📅 Testing scheduled post...');
    console.log('Scheduled for:', futureTime.toISOString());
    server.stdin.write(scheduleRequest + '\n');
    
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