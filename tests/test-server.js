const { spawn } = require('child_process');
const path = require('path');

// Test the MCP server by sending a list tools request
const server = spawn('node', [path.join(__dirname, 'dist', 'index.js')]);

let response = '';

server.stdout.on('data', (data) => {
  response += data.toString();
  console.log('Server output:', data.toString());
});

server.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

// Send a test request
const testRequest = {
  jsonrpc: '2.0',
  method: 'tools/list',
  params: {},
  id: 1
};

setTimeout(() => {
  const message = JSON.stringify(testRequest);
  const fullMessage = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
  server.stdin.write(fullMessage);
}, 100);

// Give the server time to respond
setTimeout(() => {
  console.log('\nTest completed');
  server.kill();
  process.exit(0);
}, 2000);