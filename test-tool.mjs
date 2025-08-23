import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;

server.stdout.on('data', (data) => {
  const output = data.toString();
  const lines = output.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.startsWith('{')) {
      try {
        const response = JSON.parse(trimmed);
        responseCount++;
        
        if (responseCount === 1) {
          console.log(`✅ Found ${response.result.tools.length} tools available`);
          
          // Test get_current_user
          const toolRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'get_current_user',
              arguments: {}
            },
            id: 2
          });
          
          console.log('📞 Testing get_current_user tool...');
          server.stdin.write(toolRequest + '\n');
        } else if (responseCount === 2) {
          console.log('📦 Tool response received:');
          if (response.error) {
            console.log('⚠️  Error (expected if token is invalid):', response.error);
          } else if (response.result) {
            console.log('✅ Tool executed successfully!');
            if (response.result.content && response.result.content[0] && response.result.content[0].text) {
              const text = response.result.content[0].text;
              if (text.startsWith('Error:')) {
                console.log('⚠️  API Error (expected):', text);
              } else {
                console.log('📊 Response data:', text);
              }
            }
          }
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not JSON
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('running on stdio')) {
    console.log('✅ Server ready');
    
    // First get the tools list
    const listRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    });
    
    server.stdin.write(listRequest + '\n');
  }
});

setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);