# VPS Deployment Guide

Complete guide to deploy the Researcher platform on a VPS (Ubuntu/Debian).

## Table of Contents
- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Application Deployment](#application-deployment)
- [Nginx Configuration](#nginx-configuration)
- [SSL Configuration](#ssl-configuration)
- [PM2 Process Management](#pm2-process-management)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You Need
- VPS with Ubuntu 20.04+ or Debian 11+ (minimum 2GB RAM, 2 CPU cores)
- Domain name pointed to your VPS IP address
- SSH access to your server
- MongoDB Atlas account (or MongoDB installation)
- n8n workflows configured and running

### Required Software
- Node.js 18+ 
- npm or yarn
- PM2 (process manager)
- Nginx (web server)
- Git

---

## Server Setup

### 1. Connect to Your VPS
```bash
ssh root@your-server-ip
# or
ssh username@your-server-ip
```

### 2. Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Install Node.js 18+
```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 4. Install PM2 Globally
```bash
sudo npm install -g pm2
pm2 --version
```

### 5. Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 6. Install Git
```bash
sudo apt install -y git
git --version
```

### 7. Create Application Directory
```bash
sudo mkdir -p /var/www/researcher
sudo chown -R $USER:$USER /var/www/researcher
cd /var/www/researcher
```

---

## Application Deployment

### 1. Clone or Upload Your Repository

**Option A: Clone from Git**
```bash
cd /var/www/researcher
git clone https://github.com/your-username/researcher.git .
```

**Option B: Upload via SCP/SFTP**
```bash
# From your local machine
scp -r /path/to/project/* username@your-server-ip:/var/www/researcher/
```

### 2. Install Dependencies
```bash
cd /var/www/researcher

# Install backend dependencies
npm install --production

# Install frontend dependencies and build
npm run build:client
```

### 3. Configure Environment Variables
```bash
# Copy the example env file
cp .env.example .env

# Edit with your production values
nano .env
```

**Important Environment Variables:**
```env
# Set to production
NODE_ENV=production

# Your MongoDB connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/research-agent

# Your n8n webhook URLs
N8N_WEBHOOK_PHASE1_URL=https://your-n8n-domain.com/webhook/phase-1
# ... (add all other webhook URLs)

# Generate a strong JWT secret (use: openssl rand -base64 32)
JWT_SECRET=your-strong-random-secret-minimum-32-characters

# Server port
PORT=5000
```

### 4. Create Logs Directory
```bash
mkdir -p /var/www/researcher/logs
```

### 5. Test the Application
```bash
# Test run to ensure everything works
npm start

# If successful, stop with Ctrl+C
```

---

## Nginx Configuration

### 1. Create Nginx Server Block
```bash
sudo nano /etc/nginx/sites-available/researcher
```

**Paste this configuration:**
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server Block
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be configured with Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';" always;

    # Serve React build files
    root /var/www/researcher/client/build;
    index index.html;

    # Client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings for long-running requests
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;

    # Restrict access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

### 2. Enable the Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/researcher /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL Configuration

### 1. Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
- Enter your email address
- Agree to terms of service
- Choose whether to share email with EFF
- Certbot will automatically configure SSL

### 3. Test Auto-Renewal
```bash
sudo certbot renew --dry-run
```

### 4. Set Up Auto-Renewal Cron Job
```bash
# Certbot automatically creates a renewal timer
sudo systemctl status certbot.timer

# Or manually add to crontab
sudo crontab -e
# Add this line:
# 0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## PM2 Process Management

### 1. Start Application with PM2
```bash
cd /var/www/researcher

# Start with ecosystem config
pm2 start ecosystem.config.js --env production

# Or use the npm script
npm run pm2:start
```

### 2. Set PM2 to Start on Boot
```bash
# Generate startup script
pm2 startup systemd

# Copy and run the command it outputs (it will be something like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Save current PM2 process list
pm2 save
```

### 3. Verify PM2 Status
```bash
pm2 list
pm2 status
pm2 logs researcher-backend
```

---

## Monitoring & Maintenance

### PM2 Monitoring Commands
```bash
# View all processes
pm2 list

# View logs (real-time)
pm2 logs researcher-backend

# View only error logs
pm2 logs researcher-backend --err

# Monitor CPU and memory
pm2 monit

# Detailed process info
pm2 show researcher-backend

# Restart application
pm2 restart researcher-backend

# Stop application
pm2 stop researcher-backend

# Delete from PM2
pm2 delete researcher-backend
```

### System Monitoring
```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top
# or
htop

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Application Updates
```bash
# Navigate to project directory
cd /var/www/researcher

# Pull latest changes (if using Git)
git pull origin main

# Install new dependencies
npm install --production

# Rebuild client
npm run build:client

# Restart PM2 process
pm2 restart researcher-backend

# Or use the deploy script
npm run deploy
```

---

## Firewall Configuration

### 1. Install UFW (if not installed)
```bash
sudo apt install -y ufw
```

### 2. Configure Firewall Rules
```bash
# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Database Backup (MongoDB Atlas)

Since you're using MongoDB Atlas, backups are handled automatically. However, you can also:

### Manual Backup
```bash
# Install MongoDB tools
sudo apt install -y mongodb-database-tools

# Create backup directory
mkdir -p ~/mongodb-backups

# Backup database
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/research-agent" --out ~/mongodb-backups/$(date +%Y%m%d)

# Restore database
mongorestore --uri="mongodb+srv://username:password@cluster.mongodb.net/research-agent" ~/mongodb-backups/20260129/research-agent
```

---

## Troubleshooting

### Application Not Starting
```bash
# Check PM2 logs
pm2 logs researcher-backend --lines 100

# Check if port 5000 is available
sudo netstat -tulpn | grep 5000

# Restart PM2
pm2 restart researcher-backend
```

### Nginx Issues
```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Reload Nginx after renewal
sudo systemctl reload nginx
```

### High Memory Usage
```bash
# Check memory usage
free -h

# Restart application with PM2
pm2 restart researcher-backend

# Set memory limit in ecosystem.config.js
# max_memory_restart: '500M'  # Adjust as needed
```

### Port Already in Use
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill process
sudo kill -9 PID_NUMBER

# Restart application
pm2 restart researcher-backend
```

### Database Connection Failed
- Verify MongoDB Atlas IP whitelist includes your VPS IP
- Check MONGODB_URI in .env file
- Test connection: `npm start` and check logs

---

## Performance Optimization

### 1. Enable HTTP/2
Already configured in Nginx configuration above.

### 2. Enable Gzip Compression
Already configured in Nginx configuration above.

### 3. Enable Caching
```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/researcher

# Add caching for API responses (optional)
# location /api {
#     proxy_cache_valid 200 5m;
#     proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
# }
```

### 4. PM2 Cluster Mode
Already configured in ecosystem.config.js to use all CPU cores.

---

## Security Checklist

- [ ] SSH key authentication enabled (disable password auth)
- [ ] Firewall (UFW) configured and enabled
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Strong JWT_SECRET in .env
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Regular system updates: `sudo apt update && sudo apt upgrade`
- [ ] PM2 process monitoring enabled
- [ ] Nginx security headers configured
- [ ] .env file has correct permissions: `chmod 600 .env`
- [ ] Application running as non-root user

---

## Quick Reference Commands

```bash
# Start application
npm run pm2:start

# Restart application
npm run pm2:restart

# View logs
npm run pm2:logs

# Stop application
npm run pm2:stop

# Deploy updates
npm run deploy

# Check application status
pm2 status

# Monitor performance
pm2 monit

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## Support & Resources

- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **MongoDB Atlas**: https://docs.atlas.mongodb.com/

---

## Post-Deployment Verification

After deployment, verify everything is working:

1. **Health Check**: Visit `https://yourdomain.com/api/health`
2. **Frontend**: Visit `https://yourdomain.com`
3. **Login/Signup**: Test authentication
4. **Create Research**: Test all 6 phases
5. **Feedback**: Submit feedback
6. **Chat**: Test chat functionality

---

## Maintenance Schedule

**Daily**
- Check PM2 status: `pm2 status`
- Monitor disk space: `df -h`

**Weekly**
- Review application logs: `pm2 logs researcher-backend --lines 200`
- Check Nginx logs for errors
- Review memory usage: `free -h`

**Monthly**
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review SSL certificate status: `sudo certbot certificates`
- Database backup verification (MongoDB Atlas)
- Review and clear old logs

---

**Deployment Date**: January 29, 2026
**Last Updated**: January 29, 2026
**Version**: 1.0.0
