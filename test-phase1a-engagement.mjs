import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;
let testThreadId = null;

// Test cases for Phase 1A engagement functions
const tests = [
  {
    name: 'quote_post',
    description: 'Test quote post functionality',
    args: {
      quoted_post_id: '17956475930846103', // Use existing test thread
      text: '[PHASE 1A TEST] Testing quote functionality! 🔄'
    }
  },
  {
    name: 'like_post',
    description: 'Test like post functionality', 
    args: {
      post_id: '17956475930846103'
    }
  },
  {
    name: 'repost_thread',
    description: 'Test repost functionality',
    args: {
      post_id: '17956475930846103'
    }
  },
  {
    name: 'get_post_likes',
    description: 'Test get post likes functionality',
    args: {
      post_id: '17956475930846103',
      limit: 10
    }
  },
  {
    name: 'unlike_post',
    description: 'Test unlike post functionality',
    args: {
      post_id: '17956475930846103'
    }
  },
  {
    name: 'unrepost_thread',
    description: 'Test unrepost functionality',
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
          if (response.result?.tools) {
            const engagementTools = response.result.tools.filter(tool => 
              ['quote_post', 'repost_thread', 'unrepost_thread', 'like_post', 'unlike_post', 'get_post_likes'].includes(tool.name)
            );
            
            console.log(`✅ Phase 1A tools loaded: ${engagementTools.length}/6`);
            engagementTools.forEach(tool => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            console.log('\n🧪 Starting Phase 1A engagement tests...\n');
            runNextTest();
          }
          
        } else {
          // Test response
          const currentTest = tests[responseCount - 1];
          console.log(`📊 ${currentTest.description}:`);
          
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            console.log(`  Response: ${text.substring(0, 200)}...`);
            
            if (text.startsWith('Error:')) {
              console.log(`  ❌ ${text}`);
            } else {
              try {
                const result = JSON.parse(text);
                if (result.id) {
                  console.log(`  ✅ Success - ID: ${result.id}`);
                  if (currentTest.name === 'quote_post') {
                    console.log(`    Quote of: ${result.quoted_post_id}`);
                    testThreadId = result.id; // Save for cleanup
                  }
                } else if (result.success !== undefined) {
                  console.log(`  ${result.success ? '✅' : '❌'} ${result.success ? 'Success' : 'Failed'}`);
                } else {
                  console.log(`  ✅ Response received`);
                }
              } catch (e) {
                console.log(`  ✅ Response received (non-JSON)`);
              }
            }
          } else if (response.result?.isError) {
            console.log(`  ❌ Error response received`);
          } else {
            console.log(`  ✅ Response received`);
          }
          
          if (responseCount >= tests.length) {
            showFinalResults();
            return;
          }
          
          // Wait before next test to avoid rate limits
          setTimeout(() => {
            runNextTest();
          }, 2000);
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

function showFinalResults() {
  console.log('\n📈 Phase 1A Test Results Summary:');
  console.log('='.repeat(50));
  
  console.log('✨ New Engagement Features Tested:');
  console.log('  - Quote Post: Creates quote with commentary');
  console.log('  - Like/Unlike: Basic engagement actions');  
  console.log('  - Repost/Unrepost: Content sharing');
  console.log('  - Get Post Likes: Engagement analytics');
  
  console.log('\n🎯 Phase 1A Status: TESTING COMPLETE');
  console.log('📝 Results logged above for each function');
  
  // Cleanup: Delete the test quote if created
  if (testThreadId) {
    console.log(`\n🗑️ Cleaning up test quote: ${testThreadId}`);
    const cleanupRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'delete_thread',
        arguments: {
          thread_id: testThreadId
        }
      },
      id: 999
    });
    
    server.stdin.write(cleanupRequest + '\n');
    
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 3000);
  } else {
    server.kill();
    process.exit(0);
  }
}

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('Personal Manager MCP server running')) {
    console.log('🚀 Testing Phase 1A: Core Engagement Functions\n');
    
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
  console.error('\n❌ Phase 1A test timed out');
  server.kill();
  process.exit(1);
}, 120000); // 2 minutes timeout for all tests