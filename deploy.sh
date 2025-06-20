#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Exit if any command in a pipeline fails
set -o pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
nvm use 22

# Project configuration
PROJECT_NAME="script-writer"
GITHUB_REPO="settinghead/script-writer"

# Create deployment directory with timestamp
DEPLOY_DIR="/var/www/$PROJECT_NAME-$(date +%Y%m%d%H%M%S)"
mkdir -p $DEPLOY_DIR

# Ensure persistent database directory exists and has correct permissions
sudo mkdir -p /var/data/$PROJECT_NAME
sudo chown ubuntu:ubuntu /var/data/$PROJECT_NAME
sudo chmod 755 /var/data/$PROJECT_NAME


# Clone repository
git clone --depth 1 git@github.com:$GITHUB_REPO.git $DEPLOY_DIR
cd $DEPLOY_DIR

# Install dependencies
npm ci

# Run tests
npm run test

# Build the application
npm run build

# Run database migrations using Kysely approach
NODE_ENV=production ./run-ts src/server/scripts/run-migration.ts

# Run database seeds (only if needed - typically not in production)
# Uncomment the next line if you want to run seeds in production
# NODE_ENV=production npx knex seed:run --knexfile dist-server/knexfile.js

# Create symlink for new deployment
ln -sfn $DEPLOY_DIR /var/www/$PROJECT_NAME-current

# Update symlink for Nginx
mkdir -p /var/www/$PROJECT_NAME
ln -sfn $DEPLOY_DIR/dist-client /var/www/$PROJECT_NAME-current/dist-client
ln -sfn $DEPLOY_DIR/dist-server /var/www/$PROJECT_NAME-current/dist-server

# Start the production server
NODE_ENV=production npm start

# Keep only the 5 most recent deployments
cd /var/www
ls -dt $PROJECT_NAME-20* | tail -n +6 | xargs rm -rf

echo "Deployment completed successfully"