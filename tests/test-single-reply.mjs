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
          
          // Test single reply
          const replyRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'create_reply',
              arguments: {
                reply_to_id: '17956475930846103',
                text: 'Testing single reply functionality! 💬',
                reply_control: 'everyone'
              }
            },
            id: 2
          });
          
          console.log('💬 Testing single reply...');
          server.stdin.write(replyRequest + '\n');
          
        } else if (responseCount === 2) {
          console.log('📊 Reply result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            
            if (text.startsWith('Error:')) {
              console.log(`❌ Reply failed: ${text}`);
            } else {
              try {
                const result = JSON.parse(text);
                console.log('✅ Reply created successfully!');
                console.log(`Reply ID: ${result.id}`);
                console.log(`Replied to: ${result.reply_to_id}`);
                console.log(`Container ID: ${result.container_id}`);
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
    console.log('🚀 Testing Single Reply\n');
    
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
  console.error('❌ Single reply test timed out');
  server.kill();
  process.exit(1);
}, 10000);