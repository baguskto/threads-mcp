import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

server.on('error', (error) => {
  console.log('ERROR:', error);
});

server.on('close', (code) => {
  console.log('CLOSED with code:', code);
});

// Send a simple tools list request
setTimeout(() => {
  const listRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 1
  });
  
  console.log('Sending:', listRequest);
  server.stdin.write(listRequest + '\n');
}, 1000);

// Send a single reply request after server is ready
setTimeout(() => {
  const replyRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'create_reply',
      arguments: {
        reply_to_id: '17956475930846103',
        text: 'Debug test reply',
        reply_control: 'everyone'
      }
    },
    id: 2
  });
  
  console.log('Sending reply request:', replyRequest);
  server.stdin.write(replyRequest + '\n');
}, 3000);

setTimeout(() => {
  console.log('Killing server...');
  server.kill();
  process.exit(1);
}, 8000);