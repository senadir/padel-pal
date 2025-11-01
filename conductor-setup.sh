#!/bin/bash

# Conductor setup script for Padel Pal workspace
# This script sets up a new workspace by installing dependencies and copying environment variables

set -e  # Exit on error

echo "🔧 Setting up Padel Pal workspace..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if we're in a git worktree
if [ ! -f .git ]; then
    echo "❌ Error: Not in a git worktree. This script should be run from a Conductor workspace."
    exit 1
fi

# Get the base repository path
BASE_REPO=$(cat .git | grep gitdir | cut -d' ' -f2 | sed 's|/.git/worktrees/.*||')

if [ -z "$BASE_REPO" ]; then
    echo "❌ Error: Could not determine base repository path."
    exit 1
fi

echo "📦 Installing npm dependencies..."
npm install

# Copy environment variables from base repo
ENV_FILE="$BASE_REPO/.env.local"

if [ -f "$ENV_FILE" ]; then
    echo "📋 Copying environment variables from base repository..."
    cp "$ENV_FILE" .env.local
    echo "✅ Environment variables copied successfully"
else
    echo "⚠️  Warning: .env.local not found in base repository at $ENV_FILE"
    echo "    Please create a .env.local file with the following variables:"
    echo "    - VITE_SUPABASE_URL"
    echo "    - VITE_SUPABASE_PUBLIC_KEY"
    echo "    - VITE_SUPABASE_PRIVATE_KEY"
    exit 1
fi

# Validate required environment variables
if [ -f .env.local ]; then
    source .env.local

    if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLIC_KEY" ]; then
        echo "❌ Error: Missing required environment variables in .env.local"
        echo "    Required: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLIC_KEY"
        exit 1
    fi
fi

echo ""
echo "✅ Workspace setup complete!"
echo ""
echo "🚀 You can now run the development server with: npm run dev"
