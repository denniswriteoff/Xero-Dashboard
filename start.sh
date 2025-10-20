#!/bin/bash

# Writeoff Dashboard Startup Script
echo "🚀 Starting Writeoff Dashboard..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found. Please copy from .env.example and configure."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the development server
echo "🌐 Starting development server on http://localhost:3001"
npm run dev
