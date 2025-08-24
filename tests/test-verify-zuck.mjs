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
          // Test get_user_profile with zuck's ID
          const profileRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'get_user_profile',
              arguments: {
                userId: '7541850075452114403', // Zuck's resolved ID
                fields: ['id', 'username', 'name', 'threads_profile_picture_url', 'threads_biography']
              }
            },
            id: 2
          });
          
          console.log('🔍 Testing Zuck\'s profile with resolved ID...');
          server.stdin.write(profileRequest + '\n');
        } else if (responseCount === 2) {
          console.log('📊 Profile verification result:');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log('❌ Error:', text);
            } else {
              const profileData = JSON.parse(text);
              console.log('✅ Profile found:');
              console.log(`  ID: ${profileData.id}`);
              console.log(`  Username: ${profileData.username}`);
              console.log(`  Name: ${profileData.name}`);
              console.log(`  Bio: ${profileData.threads_biography || 'N/A'}`);
            }
          }
          
          // Also test resolving another username
          const resolveRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'resolve_username',
              arguments: {
                username: 'mosseri',
                method: 'profile_lookup'
              }
            },
            id: 3
          });
          
          console.log('\n🔍 Testing resolution for "mosseri"...');
          server.stdin.write(resolveRequest + '\n');
        } else if (responseCount === 3) {
          console.log('📊 Mosseri resolution result:');
          if (response.result?.content?.[0]?.text) {
            const result = JSON.parse(response.result.content[0].text);
            console.log(`  Success: ${result.success}`);
            if (result.success) {
              console.log(`  User ID: ${result.userId}`);
              console.log(`  Username: ${result.username}`);
              console.log(`  Method: ${result.method}`);
            } else {
              console.log(`  Error: ${result.error || result.note}`);
            }
          }
          
          console.log('\n✅ Verification tests completed!');
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
    console.log('✅ Server ready, starting verification...');
    
    // Start with a simple request
    responseCount = 0;
    const startRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    });
    
    server.stdin.write(startRequest + '\n');
  }
});

setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 20000);