import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;
const responses = [];

server.stdout.on('data', (data) => {
  const output = data.toString();
  const lines = output.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.startsWith('{')) {
      try {
        const response = JSON.parse(trimmed);
        responseCount++;
        responses.push(response);
        
        console.log(`\n📦 Response ${responseCount}:`);
        
        if (responseCount === 1) {
          // List tools response
          if (response.result?.tools) {
            console.log(`✅ Found ${response.result.tools.length} tools:`);
            response.result.tools.forEach(tool => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            // Test resolve_username
            const resolveRequest = JSON.stringify({
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: 'resolve_username',
                arguments: {
                  username: 'zuck',
                  method: 'profile_lookup'
                }
              },
              id: 2
            });
            
            console.log('\n🔍 Testing username resolution for "zuck"...');
            server.stdin.write(resolveRequest + '\n');
          }
        } else if (responseCount === 2) {
          // resolve_username response
          console.log('📊 Username resolution result:');
          if (response.result?.content?.[0]?.text) {
            const result = JSON.parse(response.result.content[0].text);
            console.log(`  Success: ${result.success}`);
            console.log(`  Method: ${result.method}`);
            if (result.success) {
              console.log(`  User ID: ${result.userId}`);
              console.log(`  Username: ${result.username}`);
            } else {
              console.log(`  Note: ${result.note}`);
            }
          }
          
          // Test search_user_threads
          const searchRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'search_user_threads',
              arguments: {
                userId: '24316150841377351', // Your user ID
                query: 'test',
                limit: 10
              }
            },
            id: 3
          });
          
          console.log('\n🔍 Testing search within user threads...');
          server.stdin.write(searchRequest + '\n');
        } else if (responseCount === 3) {
          // search_user_threads response
          console.log('📊 Search results:');
          if (response.result?.content?.[0]?.text) {
            const result = JSON.parse(response.result.content[0].text);
            console.log(`  Query: "${result.searchQuery}"`);
            console.log(`  Threads searched: ${result.totalThreadsSearched}`);
            console.log(`  Matching threads: ${result.matchingThreads}`);
          }
          
          console.log('\n✅ All tests completed!');
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
    console.log('✅ Server ready, starting tests...');
    
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
}, 30000);