import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;
let parentThreadId = null;

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
          console.log('✅ Server ready for reply testing');
          
          // First, create a parent thread to reply to
          const createThreadRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'publish_thread',
              arguments: {
                text: '[REPLY TEST] This is a parent thread for testing reply functionality',
                media_type: 'TEXT'
              }
            },
            id: 2
          });
          
          console.log('📤 Creating parent thread...');
          server.stdin.write(createThreadRequest + '\n');
          
        } else if (responseCount === 2) {
          console.log('📊 Parent thread result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log(`❌ Parent thread creation failed: ${text}`);
              server.kill();
              process.exit(1);
            } else {
              try {
                const result = JSON.parse(text);
                console.log('✅ Parent thread created successfully!');
                if (result.id) {
                  parentThreadId = result.id;
                  console.log(`  Parent Thread ID: ${parentThreadId}`);
                  
                  // Now create a reply to this thread
                  setTimeout(() => {
                    const replyRequest = JSON.stringify({
                      jsonrpc: '2.0',
                      method: 'tools/call',
                      params: {
                        name: 'create_reply',
                        arguments: {
                          reply_to_id: parentThreadId,
                          text: 'This is a reply to the parent thread! 🧵',
                          reply_control: 'everyone'
                        }
                      },
                      id: 3
                    });
                    
                    console.log('\n💬 Creating reply...');
                    server.stdin.write(replyRequest + '\n');
                  }, 3000);
                } else {
                  console.log('❌ No thread ID returned');
                  server.kill();
                  process.exit(1);
                }
              } catch (e) {
                console.log('❌ Failed to parse parent thread response');
                server.kill();
                process.exit(1);
              }
            }
          }
          
        } else if (responseCount === 3) {
          console.log('\n📊 Reply result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log(`❌ Reply creation failed: ${text}`);
            } else {
              try {
                const result = JSON.parse(text);
                console.log('✅ Reply created successfully!');
                if (result.id) {
                  console.log(`  Reply ID: ${result.id}`);
                  console.log(`  Replied to: ${result.reply_to_id}`);
                  
                  // Now test thread chain creation
                  setTimeout(() => {
                    const chainRequest = JSON.stringify({
                      jsonrpc: '2.0',
                      method: 'tools/call',
                      params: {
                        name: 'create_thread_chain',
                        arguments: {
                          parent_thread_id: parentThreadId,
                          replies: [
                            { text: 'First reply in chain 🔗' },
                            { text: 'Second reply in chain ⛓️' },
                            { text: 'Third reply in chain 🧵' }
                          ]
                        }
                      },
                      id: 4
                    });
                    
                    console.log('\n🔗 Creating thread chain...');
                    server.stdin.write(chainRequest + '\n');
                  }, 3000);
                } else {
                  console.log('❌ No reply ID returned');
                  server.kill();
                  process.exit(1);
                }
              } catch (e) {
                console.log('❌ Failed to parse reply response');
                server.kill();
                process.exit(1);
              }
            }
          }
          
        } else if (responseCount === 4) {
          console.log('\n📊 Thread chain result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log(`❌ Thread chain creation failed: ${text}`);
            } else {
              try {
                const result = JSON.parse(text);
                console.log('✅ Thread chain created successfully!');
                console.log(`  Chain length: ${result.chain_length}`);
                console.log(`  Success: ${result.success}`);
                console.log(`  Total replies created: ${result.replies.length}`);
                
                result.replies.forEach((reply, index) => {
                  console.log(`    Reply ${index + 1}: ID ${reply.id} → replying to ${reply.reply_to_id}`);
                });
                
                console.log('\n🎉 REPLY FUNCTIONALITY TEST COMPLETED!');
                console.log('✅ Parent thread creation: SUCCESS');
                console.log('✅ Single reply creation: SUCCESS');  
                console.log('✅ Thread chain creation: SUCCESS');
                console.log('\n🧵 Your Threads now supports true nested conversations!');
                
              } catch (e) {
                console.log('❌ Failed to parse chain response');
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
    console.log('🚀 Testing Reply Functionality\n');
    
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
  console.error('❌ Reply test timed out');
  server.kill();
  process.exit(1);
}, 60000);