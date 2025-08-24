import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;

// Quick test focusing on the working and potentially working functions
const tests = [
  {
    name: 'like_post',
    description: 'Test like post (should work)',
    args: {
      post_id: '17956475930846103'
    }
  },
  {
    name: 'unlike_post', 
    description: 'Test unlike post (with improved endpoints)',
    args: {
      post_id: '17956475930846103'
    }
  },
  {
    name: 'repost_thread',
    description: 'Test repost (with improved endpoints)',
    args: {
      post_id: '17956475930846103'
    }
  }
];

server.stdout.on('data', (data) => {
  const output = data.toString();
  const lines = output.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.startsWith('{')) {
      try {
        const response = JSON.parse(trimmed);
        
        if (responseCount === 0) {
          // Tools list response
          console.log('✅ Server ready for Phase 1A testing');
          runNextTest();
          
        } else {
          // Test response
          const currentTest = tests[responseCount - 1];
          console.log(`\n📊 ${currentTest.description}:`);
          
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            
            if (text.startsWith('Error:')) {
              console.log(`  ❌ ${text.substring(0, 100)}...`);
            } else {
              try {
                const result = JSON.parse(text);
                if (result.id) {
                  console.log(`  ✅ Success - ID: ${result.id}`);
                } else {
                  console.log(`  ✅ Success - Response received`);
                }
              } catch (e) {
                console.log(`  ✅ Success - Response: ${text.substring(0, 50)}...`);
              }
            }
          }
          
          if (responseCount >= tests.length) {
            console.log('\n🎯 Phase 1A Quick Test Complete!');
            server.kill();
            process.exit(0);
          }
          
          // Small delay before next test
          setTimeout(() => {
            runNextTest();
          }, 1000);
        }
        
        responseCount++;
      } catch (e) {
        // Not complete JSON
      }
    }
  }
});

function runNextTest() {
  const currentTest = tests[responseCount];
  if (!currentTest) return;
  
  console.log(`🔍 Testing: ${currentTest.description}...`);
  
  const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: currentTest.name,
      arguments: currentTest.args
    },
    id: responseCount + 1
  });
  
  server.stdin.write(request + '\n');
}

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('Personal Manager MCP server running')) {
    console.log('🚀 Phase 1A Quick Test - Updated Endpoints\n');
    
    // Start with tools list
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
  console.error('\n❌ Quick test timed out');
  server.kill();
  process.exit(1);
}, 30000);