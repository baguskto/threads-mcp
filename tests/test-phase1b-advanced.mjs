import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;
let createdPostIds = [];

// Test cases for Phase 1B advanced posting functions
const tests = [
  {
    name: 'create_post_with_restrictions',
    description: 'Test advanced post with hashtags and restrictions',
    args: {
      text: '[PHASE 1B TEST] Advanced post with restrictions! 🔒',
      reply_control: 'followers_only',
      hashtags: ['MCPThreads', 'Phase1B', 'Advanced'],
      mentions: ['example'], // Safe mention that won't bother real users
      location_name: 'Test Location'
    }
  },
  {
    name: 'schedule_post',
    description: 'Test post scheduling functionality',
    args: {
      text: '[PHASE 1B TEST] This post should be scheduled for the future! ⏰',
      scheduled_publish_time: '2025-08-25T10:00:00+07:00',
      reply_control: 'everyone'
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
            const phase1bTools = response.result.tools.filter(tool => 
              ['create_post_with_restrictions', 'schedule_post'].includes(tool.name)
            );
            
            console.log(`✅ Phase 1B tools loaded: ${phase1bTools.length}/2`);
            phase1bTools.forEach(tool => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            console.log('\n🧪 Starting Phase 1B advanced posting tests...\n');
            runNextTest();
          }
          
        } else {
          // Test response
          const currentTest = tests[responseCount - 1];
          console.log(`📊 ${currentTest.description}:`);
          
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            
            if (text.startsWith('Error:')) {
              console.log(`  ❌ ${text.substring(0, 150)}...`);
            } else {
              try {
                const result = JSON.parse(text);
                
                if (result.id) {
                  console.log(`  ✅ Success - Post ID: ${result.id}`);
                  createdPostIds.push(result.id);
                  
                  if (result.restrictions) {
                    console.log(`    Restrictions applied:`);
                    console.log(`      Reply control: ${result.restrictions.reply_control}`);
                    console.log(`      Hashtags: ${result.restrictions.hashtags?.join(', ') || 'None'}`);
                    console.log(`      Mentions: ${result.restrictions.mentions?.join(', ') || 'None'}`);
                  }
                  
                } else if (result.container_id && result.status === 'scheduled') {
                  console.log(`  ✅ Scheduled - Container ID: ${result.container_id}`);
                  console.log(`    Scheduled for: ${result.scheduled_for}`);
                  console.log(`    Status: ${result.status}`);
                  console.log(`    Note: ${result.note}`);
                  
                } else {
                  console.log(`  ✅ Response received`);
                  console.log(`    Details: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
                }
                
              } catch (e) {
                console.log(`  ✅ Response received: ${text.substring(0, 100)}...`);
              }
            }
          }
          
          if (responseCount >= tests.length) {
            showFinalResults();
            return;
          }
          
          // Wait before next test
          setTimeout(() => {
            runNextTest();
          }, 3000);
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
  console.log('\n📈 Phase 1B Test Results Summary:');
  console.log('='.repeat(50));
  
  console.log('✨ Advanced Posting Features Tested:');
  console.log('  - Advanced Posts: Enhanced with hashtags, mentions, restrictions');
  console.log('  - Scheduling: Future post publishing (container creation)');
  
  console.log('\n🎯 Phase 1B Status: TESTING COMPLETE');
  console.log(`📝 Created ${createdPostIds.length} test posts`);
  
  // Cleanup: Delete test posts if any were created
  if (createdPostIds.length > 0) {
    console.log(`\n🗑️ Cleaning up ${createdPostIds.length} test posts...`);
    
    createdPostIds.forEach((postId, index) => {
      setTimeout(() => {
        const cleanupRequest = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'delete_thread',
            arguments: {
              thread_id: postId
            }
          },
          id: 900 + index
        });
        
        server.stdin.write(cleanupRequest + '\n');
      }, index * 1000); // Stagger cleanup requests
    });
    
    // Wait for cleanup then exit
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, (createdPostIds.length + 2) * 1000);
    
  } else {
    server.kill();
    process.exit(0);
  }
}

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('Personal Manager MCP server running')) {
    console.log('🚀 Testing Phase 1B: Advanced Posting Functions\n');
    
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
  console.error('\n❌ Phase 1B test timed out');
  server.kill();
  process.exit(1);
}, 60000); // 1 minute timeout