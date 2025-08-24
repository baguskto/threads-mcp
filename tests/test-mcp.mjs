import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMCPServer() {
  console.log('Starting MCP server test...');
  
  const server = spawn('node', [join(__dirname, 'dist', 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseBuffer = '';
  let hasInitialized = false;

  server.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    
    // Try to parse complete messages
    const lines = responseBuffer.split('\n');
    for (const line of lines) {
      if (line.trim() && line.startsWith('{')) {
        try {
          const response = JSON.parse(line);
          console.log('Response:', JSON.stringify(response, null, 2));
          
          if (response.result && response.result.tools) {
            console.log(`\n✅ Server successfully returned ${response.result.tools.length} tools`);
            console.log('Tool names:', response.result.tools.map(t => t.name).join(', '));
            server.kill();
            process.exit(0);
          }
        } catch (e) {
          // Not a complete JSON message yet
        }
      }
    }
  });

  server.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('running on stdio')) {
      hasInitialized = true;
      console.log('✅ Server initialized');
      sendListToolsRequest();
    }
  });

  function sendListToolsRequest() {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    };
    
    const message = JSON.stringify(request);
    const fullMessage = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
    
    console.log('Sending list tools request...');
    server.stdin.write(fullMessage);
  }

  // Timeout after 5 seconds
  setTimeout(() => {
    console.error('❌ Test timed out');
    server.kill();
    process.exit(1);
  }, 5000);
}

testMCPServer().catch(console.error);