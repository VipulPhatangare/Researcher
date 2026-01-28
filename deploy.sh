#!/bin/bash

# Quick Deployment Script for VPS
# Usage: ./deploy.sh

set -e  # Exit on error

echo "=================================================="
echo "🚀 Starting Deployment Process"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Pull latest changes (if using Git)
if [ -d .git ]; then
    echo -e "${GREEN}📥 Pulling latest changes...${NC}"
    git pull origin main || git pull origin master
fi

# Install backend dependencies
echo -e "${GREEN}📦 Installing backend dependencies...${NC}"
npm install --production

# Build client
echo -e "${GREEN}🔨 Building React client...${NC}"
cd client
npm install
npm run build
cd ..

# Create logs directory if it doesn't exist
mkdir -p logs

# Restart PM2 process
echo -e "${GREEN}🔄 Restarting application with PM2...${NC}"
if pm2 list | grep -q "researcher-backend"; then
    pm2 restart researcher-backend
else
    pm2 start ecosystem.config.js --env production
fi

# Save PM2 configuration
pm2 save

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo "=================================================="
echo ""
echo "Quick Commands:"
echo "  pm2 logs researcher-backend  - View logs"
echo "  pm2 monit                    - Monitor performance"
echo "  pm2 restart researcher-backend - Restart app"
echo ""
