#!/bin/bash

# Start the server in background
node dist/index.js &
SERVER_PID=$!
sleep 2

# Try to list tools
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | nc localhost 3000

# Kill the server
kill $SERVER_PID