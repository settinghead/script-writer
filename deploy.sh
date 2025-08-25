#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Exit if any command in a pipeline fails
set -o pipefail

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
nvm use 22

# Project configuration
PROJECT_NAME="script-writer"
GITHUB_REPO="settinghead/script-writer"
BRANCH="${DEPLOY_BRANCH:-main}"

# Create deployment directory with timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)
DEPLOY_DIR="/var/www/$PROJECT_NAME-$TIMESTAMP"
CURRENT_LINK="/var/www/$PROJECT_NAME-current"

echo "🚀 Starting deployment to $DEPLOY_DIR"

# Create deployment directory
mkdir -p $DEPLOY_DIR

# Clone repository
echo "📥 Cloning repository (branch: $BRANCH)..."
git clone --depth 1 --branch $BRANCH git@github.com:$GITHUB_REPO.git $DEPLOY_DIR
cd $DEPLOY_DIR

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm run test:run



NODE_ENV=production


# Copy environment file
cp /var/www/.env.prod .env

npm run build

# Run database migrations
echo "🔄 Running database migrations..."
cd $DEPLOY_DIR
NODE_ENV=production ./run-ts src/server/scripts/migrate.ts
NODE_ENV=production ./run-ts src/server/scripts/seed.ts


# Create symlink for new deployment
ln -sfn $DEPLOY_DIR /var/www/script-writer-current

# Update symlink for Nginx
mkdir -p /var/www/script-writer
ln -sfn $DEPLOY_DIR/dist-client /var/www/script-writer-current/dist-client
ln -sfn $DEPLOY_DIR/dist-server /var/www/script-writer-current/dist-server

# Restart backend with PM2
pm2 delete script-writer-api || true
cd $DEPLOY_DIR
NODE_ENV=production pm2 start dist-server/server/index.js --name script-writer-api

# Keep only the 30 most recent deployments
cd /var/www
ls -dt script-writer-20* | tail -n +31 | xargs rm -rf

echo "Deployment completed successfully"
