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
          console.log('✅ Server ready for publish test');
          
          // Test publish thread
          const publishRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'publish_thread',
              arguments: {
                text: '[MCP TEST] Testing Threads Personal Manager publish functionality - this is automated test',
                media_type: 'TEXT'
              }
            },
            id: 2
          });
          
          console.log('📤 Testing publish thread functionality...');
          server.stdin.write(publishRequest + '\n');
        } else if (responseCount === 2) {
          console.log('📊 Publish result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log(`❌ Publish failed: ${text}`);
              console.log('\n💡 This might be due to:');
              console.log('  - Missing publish permissions in app configuration');
              console.log('  - Rate limiting or quota exceeded');
              console.log('  - API endpoint differences');
            } else {
              try {
                const result = JSON.parse(text);
                console.log('✅ Thread published successfully!');
                if (result.id) {
                  console.log(`  Thread ID: ${result.id}`);
                  
                  // Test delete the thread we just created
                  setTimeout(() => {
                    const deleteRequest = JSON.stringify({
                      jsonrpc: '2.0',
                      method: 'tools/call',
                      params: {
                        name: 'delete_thread',
                        arguments: {
                          thread_id: result.id
                        }
                      },
                      id: 3
                    });
                    
                    console.log('\n🗑️ Testing delete thread functionality...');
                    server.stdin.write(deleteRequest + '\n');
                  }, 2000);
                } else {
                  console.log('Response:', result);
                  server.kill();
                  process.exit(0);
                }
              } catch (e) {
                console.log('✅ Publish response received (non-JSON)');
                server.kill();
                process.exit(0);
              }
            }
          }
        } else if (responseCount === 3) {
          console.log('\n📊 Delete result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log(`❌ Delete failed: ${text}`);
            } else {
              console.log('✅ Thread deleted successfully!');
              console.log('\n🎉 PUBLISH/DELETE CYCLE COMPLETED SUCCESSFULLY!');
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
    console.log('🚀 Testing publish/delete functionality\n');
    
    // Start with tools list to wake up server
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
  console.error('❌ Publish test timed out');
  server.kill();
  process.exit(1);
}, 30000);