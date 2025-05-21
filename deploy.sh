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

# Create deployment directory with timestamp
DEPLOY_DIR="/var/www/$PROJECT_NAME-$(date +%Y%m%d%H%M%S)"
mkdir -p $DEPLOY_DIR

# Ensure persistent database directory exists and has correct permissions
sudo mkdir -p /var/data/$PROJECT_NAME
sudo chown ubuntu:ubuntu /var/data/$PROJECT_NAME
sudo chmod 755 /var/data/$PROJECT_NAME


# Clone repository
git clone --depth 1 git@github.com:settinghead/$PROJECT_NAME.git $DEPLOY_DIR
cd $DEPLOY_DIR

# Install dependencies
npm ci

# Run tests
npm run test

# Build the project
cp /var/www/.env.prod $DEPLOY_DIR/app/.env
npm run build

# Create symlink for new deployment
ln -sfn $DEPLOY_DIR /var/www/$PROJECT_NAME-current

# Update symlink for Nginx
mkdir -p /var/www/$PROJECT_NAME/app
ln -sfn $DEPLOY_DIR/app/dist-client /var/www/$PROJECT_NAME-current/app/dist-client
ln -sfn $DEPLOY_DIR/app/dist-server /var/www/$PROJECT_NAME-current/app/dist-server

# Restart backend with PM2
pm2 delete $PROJECT_NAME-api || true
cd $DEPLOY_DIR/app
NODE_ENV=production pm2 start dist-server/index.js --name $PROJECT_NAME-api

# Keep only the 5 most recent deployments
cd /var/www
ls -dt $PROJECT_NAME-20* | tail -n +6 | xargs rm -rf

echo "Deployment completed successfully"