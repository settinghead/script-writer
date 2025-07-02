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

# Build the application
echo "🔨 Building application..."
npm run build

# Setup environment variables for production
echo "⚙️  Setting up environment..."
if [ ! -f .env.production ]; then
    echo "Creating .env.production file..."
    cat > .env.production << EOF
NODE_ENV=production
PORT=3001

# PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/script_writer
POSTGRES_DB=script_writer
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# JWT Configuration (replace with secure secret in production)
JWT_SECRET=your-super-secret-jwt-key-256-bits-minimum-change-this-in-production


# Cache directory
CACHE_DIR=/var/data/$PROJECT_NAME/cache
EOF
    echo "⚠️  Please update .env.production with actual production values!"
fi

# Copy environment file
cp /var/www/.env.prod .env

# Ensure data directories exist with correct permissions
echo "📁 Setting up data directories..."
sudo mkdir -p /var/data/$PROJECT_NAME/{db,cache,logs}
sudo chown -R ubuntu:ubuntu /var/data/$PROJECT_NAME
sudo chmod -R 755 /var/data/$PROJECT_NAME

# Setup PostgreSQL database (if not exists)
echo "🗄️  Setting up database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'script_writer'" | grep -q 1 || {
    echo "Creating database and user..."
    sudo -u postgres createdb script_writer
    sudo -u postgres psql -c "CREATE USER script_writer WITH ENCRYPTED PASSWORD 'script_writer_password';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE script_writer TO script_writer;"
}

# Run database migrations
echo "🔄 Running database migrations..."
NODE_ENV=production ./run-ts src/server/scripts/migrate.ts

# Setup systemd service
echo "🔧 Setting up systemd service..."
NODE_PATH=$(which node)
sudo tee /etc/systemd/system/$PROJECT_NAME.service > /dev/null << EOF
[Unit]
Description=Script Writer Application
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$DEPLOY_DIR
ExecStart=$NODE_PATH dist-server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$DEPLOY_DIR/.env.production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$PROJECT_NAME

[Install]
WantedBy=multi-user.target
EOF

# Setup log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/$PROJECT_NAME > /dev/null << EOF
/var/data/$PROJECT_NAME/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload $PROJECT_NAME || true
    endscript
}
EOF

# Update current symlink
echo "🔗 Updating symlinks..."
ln -sfn $DEPLOY_DIR $CURRENT_LINK

# Reload systemd and restart service
echo "🔄 Restarting service..."
sudo systemctl daemon-reload
sudo systemctl enable $PROJECT_NAME
sudo systemctl stop $PROJECT_NAME || true
sudo systemctl start $PROJECT_NAME

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 5

# Check service status
if sudo systemctl is-active --quiet $PROJECT_NAME; then
    echo "✅ Service is running successfully"
else
    echo "❌ Service failed to start. Checking logs..."
    sudo systemctl status $PROJECT_NAME
    sudo journalctl -u $PROJECT_NAME --no-pager -n 20
    exit 1
fi

# Cleanup old deployments (keep only 5 most recent)
echo "🧹 Cleaning up old deployments..."
cd /var/www
ls -dt $PROJECT_NAME-20* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

# Final health check
echo "🏥 Performing health check..."
sleep 2
if curl -f -s http://localhost:3001/api/chat/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed - service may still be starting"
fi

echo "🎉 Deployment completed successfully!"
echo "📍 Deployed to: $DEPLOY_DIR"
echo "🔗 Current link: $CURRENT_LINK"
echo "📊 Service status: sudo systemctl status $PROJECT_NAME"
echo "📋 Service logs: sudo journalctl -u $PROJECT_NAME -f"