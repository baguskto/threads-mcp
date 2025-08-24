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
          console.log('✅ Server ready, testing error handling improvements...');
          
          // Test get_user_profile with external user ID that should fail
          const profileRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'get_user_profile',
              arguments: {
                userId: '7541851959841727431', // dedi.nugroho_ ID
                fields: ['id', 'username', 'name', 'threads_biography']
              }
            },
            id: 2
          });
          
          console.log('\n🔍 Testing improved error handling for external user profile...');
          server.stdin.write(profileRequest + '\n');
        } else if (responseCount === 2) {
          console.log('\n📊 Profile access result:');
          if (response.result?.content?.[0]?.text) {
            const result = JSON.parse(response.result.content[0].text);
            
            if (result.error) {
              console.log('✅ Enhanced error handling working:');
              console.log(`  Error: ${result.error}`);
              console.log(`  Message: ${result.message}`);
              console.log(`  Suggestions: ${result.suggestions.length} provided`);
              console.log(`  Note: ${result.note}`);
            } else {
              console.log('✅ Profile access successful:', result);
            }
          }
          
          // Test get_user_threads with same user
          const threadsRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'get_user_threads',
              arguments: {
                userId: '7541851959841727431',
                limit: 5
              }
            },
            id: 3
          });
          
          console.log('\n🔍 Testing threads access with improved error handling...');
          server.stdin.write(threadsRequest + '\n');
        } else if (responseCount === 3) {
          console.log('\n📊 Threads access result:');
          if (response.result?.content?.[0]?.text) {
            const result = JSON.parse(response.result.content[0].text);
            
            if (result.error) {
              console.log('✅ Enhanced threads error handling working:');
              console.log(`  Error: ${result.error}`);
              console.log(`  Message: ${result.message}`);
              console.log(`  Workaround: ${result.workaround}`);
            } else {
              console.log('✅ Threads access successful, got threads:', result.length || 0);
            }
          }
          
          console.log('\n✅ Error handling tests completed!');
          server.kill();
          process.exit(0);
        }
        
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('running on stdio')) {
    console.log('🚀 Server started');
    
    // Start with tools list
    const listRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    });
    
    server.stdin.write(listRequest + '\n');
  } else if (message.includes('Attempt')) {
    console.log('🔄 Retry logic:', message);
  }
});

setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 30000);