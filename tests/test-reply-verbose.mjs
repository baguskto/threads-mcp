import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('RAW OUTPUT:', output);
  
  const lines = output.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.startsWith('{')) {
      try {
        const response = JSON.parse(trimmed);
        responseCount++;
        
        console.log(`\n=== RESPONSE ${responseCount} ===`);
        console.log(JSON.stringify(response, null, 2));
        
        if (responseCount === 1) {
          // Tools list received, now send reply
          setTimeout(() => {
            const replyRequest = JSON.stringify({
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: 'create_reply',
                arguments: {
                  reply_to_id: '17956475930846103',
                  text: 'Simple test reply'
                }
              },
              id: 2
            });
            
            console.log('\n=== SENDING REPLY REQUEST ===');
            console.log(replyRequest);
            server.stdin.write(replyRequest + '\n');
          }, 1000);
          
        } else if (responseCount === 2) {
          console.log('\n=== REPLY RESPONSE RECEIVED ===');
          server.kill();
          process.exit(0);
        }
        
      } catch (e) {
        console.log('Failed to parse JSON:', e.message);
        console.log('Content:', trimmed);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('STDERR:', message);
  
  if (message.includes('Personal Manager MCP server running')) {
    // Send tools list first
    setTimeout(() => {
      const listRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1
      });
      
      console.log('\n=== SENDING TOOLS LIST ===');
      console.log(listRequest);
      server.stdin.write(listRequest + '\n');
    }, 500);
  }
});

server.on('error', (error) => {
  console.log('SERVER ERROR:', error);
});

setTimeout(() => {
  console.log('\n=== TIMEOUT REACHED ===');
  server.kill();
  process.exit(1);
}, 15000);