#!/bin/bash
set -e

if [ ! -f "dist/index.html" ]; then
  echo "[VeeGo] First-time setup: installing dependencies..."
  npm install
  echo "[VeeGo] Building web app..."
  npm run build:web
fi

node server.js
