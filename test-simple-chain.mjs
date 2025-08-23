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
          console.log('✅ Server ready');
          
          // Test with a simple chain of 2 replies
          const chainRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'create_thread_chain',
              arguments: {
                parent_thread_id: '17956475930846103', // Use previous test thread
                replies: [
                  { text: 'Simple chain test 1' },
                  { text: 'Simple chain test 2' }
                ]
              }
            },
            id: 2
          });
          
          console.log('🔗 Testing simple thread chain...');
          server.stdin.write(chainRequest + '\n');
          
        } else if (responseCount === 2) {
          console.log('📊 Chain result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            console.log('Response text:', text);
            
            if (text.startsWith('Error:')) {
              console.log(`❌ Chain failed: ${text}`);
            } else {
              try {
                const result = JSON.parse(text);
                console.log('✅ Chain created!');
                console.log(`Chain length: ${result.chain_length}`);
                console.log(`Success: ${result.success}`);
              } catch (e) {
                console.log('Response (not JSON):', text);
              }
            }
          }
          
          server.kill();
          process.exit(0);
        }
        
      } catch (e) {
        // Not complete JSON
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('Personal Manager MCP server running')) {
    console.log('🚀 Testing Simple Chain\n');
    
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
  console.error('❌ Simple chain test timed out');
  server.kill();
  process.exit(1);
}, 15000);