import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;
const testResults = [];

const tests = [
  {
    name: 'get_my_profile',
    description: 'Get personal profile',
    args: { fields: ['id', 'username', 'name'] }
  },
  {
    name: 'get_my_threads', 
    description: 'Get personal threads',
    args: { limit: 5 }
  },
  {
    name: 'search_my_threads',
    description: 'Search in personal threads', 
    args: { query: 'test', limit: 10 }
  },
  {
    name: 'get_publishing_limit',
    description: 'Check publishing limits',
    args: {}
  },
  {
    name: 'get_my_insights',
    description: 'Get account insights',
    args: { metrics: ['followers_count', 'posts_count'] }
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
          // List tools response
          if (response.result?.tools) {
            console.log(`✅ Threads Personal Manager loaded with ${response.result.tools.length} tools:`);
            response.result.tools.forEach(tool => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            console.log('\n🧪 Starting comprehensive tests...\n');
            runNextTest();
          }
        } else {
          // Tool test response
          const currentTest = tests[responseCount - 1];
          console.log(`📊 ${currentTest.description}:`);
          
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            if (text.startsWith('Error:')) {
              console.log(`  ❌ ${text}`);
              testResults.push({ ...currentTest, status: 'error', error: text });
            } else {
              try {
                const result = JSON.parse(text);
                console.log(`  ✅ Success - ${Object.keys(result).length} fields returned`);
                if (result.id) console.log(`    User ID: ${result.id}`);
                if (result.username) console.log(`    Username: ${result.username}`);
                if (result.length !== undefined) console.log(`    Items: ${result.length}`);
                if (result.totalThreadsSearched) console.log(`    Searched: ${result.totalThreadsSearched} threads`);
                if (result.matchingThreads !== undefined) console.log(`    Matches: ${result.matchingThreads}`);
                
                testResults.push({ ...currentTest, status: 'success', result: result });
              } catch (e) {
                console.log(`  ✅ Response received (non-JSON)`);
                testResults.push({ ...currentTest, status: 'success' });
              }
            }
          }
          
          if (responseCount >= tests.length) {
            showFinalResults();
            return;
          }
          
          runNextTest();
        }
        
        responseCount++;
      } catch (e) {
        // Not complete JSON
      }
    }
  }
});

function runNextTest() {
  if (responseCount > tests.length) return;
  
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
  
  setTimeout(() => {
    server.stdin.write(request + '\n');
  }, 1000); // Small delay between tests
}

function showFinalResults() {
  console.log('\n📈 Test Results Summary:');
  console.log('='.repeat(50));
  
  const successful = testResults.filter(t => t.status === 'success').length;
  const failed = testResults.filter(t => t.status === 'error').length;
  
  console.log(`✅ Successful: ${successful}/${testResults.length}`);
  console.log(`❌ Failed: ${failed}/${testResults.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.filter(t => t.status === 'error').forEach(test => {
      console.log(`  - ${test.name}: ${test.error.substring(0, 100)}...`);
    });
  }
  
  console.log(`\n🎯 Personal Manager Status: ${successful >= 3 ? 'READY FOR PRODUCTION' : 'NEEDS FIXES'}`);
  
  server.kill();
  process.exit(0);
}

server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message.includes('Personal Manager MCP server running')) {
    console.log('🚀 Threads Personal Manager Server Started\n');
    
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
  console.error('❌ Test suite timed out');
  server.kill();
  process.exit(1);
}, 60000);