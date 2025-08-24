import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('running on stdio')) {
    console.log('✅ Server ready');
    
    // Test profile access
    const request = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_user_profile',
        arguments: { userId: '7541851959841727431' }
      },
      id: 1
    });
    
    server.stdin.write(request + '\n');
    
    setTimeout(() => {
      console.log('📦 Raw output length:', output.length);
      
      // Try to extract the JSON response
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim() && line.startsWith('{')) {
          try {
            const response = JSON.parse(line);
            console.log('✅ Parsed response successfully');
            
            if (response.result?.content?.[0]?.text) {
              console.log('📄 Response content:');
              console.log(response.result.content[0].text);
            }
            break;
          } catch (e) {
            console.log('❌ Parse failed for line:', line.substring(0, 100) + '...');
          }
        }
      }
      
      server.kill();
      process.exit(0);
    }, 5000);
  }
});

setTimeout(() => {
  console.error('❌ Timeout');
  server.kill();
  process.exit(1);
}, 10000);