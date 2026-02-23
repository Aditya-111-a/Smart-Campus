#!/bin/bash

# Script to run frontend development server
# Ensures dependencies are installed

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if node_modules exists
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Starting frontend development server..."
echo "Frontend will be available at http://localhost:5173"
echo ""

npm run dev
