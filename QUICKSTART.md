# Quick Deployment Guide

Get your Researcher platform deployed on a VPS in under 30 minutes.

## Prerequisites
✅ VPS with Ubuntu 20.04+ (2GB RAM minimum)  
✅ Domain name pointed to VPS IP  
✅ MongoDB Atlas account (free tier works)  
✅ n8n workflows configured and running  

---

## Step 1: Server Setup (5 minutes)

```bash
# Connect to your server
ssh root@194.238.17.210

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Install PM2
sudo npm install -g pm2

# Create app directory
sudo mkdir -p /var/www/researcher
sudo chown -R $USER:$USER /var/www/researcher
```

---

## Step 2: Deploy Application (10 minutes)

```bash
# Clone or upload your code
cd /var/www/researcher
git clone <your-repo-url> .

# Or upload via SCP from your local machine:
# scp -r /path/to/project/* username@server-ip:/var/www/researcher/

# Install dependencies
npm install --production

# Build React frontend
cd client && npm install && npm run build && cd ..

# Configure environment
cp .env.example .env
nano .env  # Edit with your production values

# Create logs directory
mkdir -p logs
```

**Important: Update .env with:**
- Your MongoDB Atlas connection string
- All n8n webhook URLs
- Strong JWT_SECRET (generate with: `openssl rand -base64 32`)
- Set `NODE_ENV=production`

---

## Step 3: Configure Nginx (5 minutes)

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/researcher
```

**Copy this configuration (replace `yourdomain.com`):**

```nginx
server {
    listen 80;
    server_name researcher.synthomind.cloud www.researcher.synthomind.cloud;
    
    root /var/www/researcher/client/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/researcher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 4: Setup SSL (5 minutes)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d researcher.synthomind.cloud -d www.researcher.synthomind.cloud

# Follow prompts (enter email, agree to terms)
```

Certbot automatically configures SSL and sets up auto-renewal!

---

## Step 5: Start Application (3 minutes)

```bash
cd /var/www/researcher

# Start with PM2
pm2 start ecosystem.config.js --env production

# Enable auto-start on reboot
pm2 startup systemd
# Copy and run the command it outputs

pm2 save

# Verify it's running
pm2 status
pm2 logs researcher-backend
```

---

## Step 6: Configure Firewall (2 minutes)

```bash
# Configure UFW
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
sudo ufw status
```

---

## ✅ Verify Deployment

Visit these URLs to confirm everything works:

1. **Health Check**: `https://researcher.synthomind.cloud/api/health`
2. **Frontend**: `https://researcher.synthomind.cloud`
3. **Sign up** and **log in**
4. **Create research** and test all phases
5. **Submit feedback**

---

## Common Issues & Quick Fixes

### Issue: Port 5000 already in use
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
pm2 restart researcher-backend
```

### Issue: MongoDB connection failed
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` or your VPS IP)
- Verify MONGODB_URI in `.env`

### Issue: n8n webhooks not working
- Test webhook URLs in browser
- Check n8n workflows are active
- Verify webhook URLs in `.env`

### Issue: Nginx 502 Bad Gateway
```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs researcher-backend

# Restart backend
pm2 restart researcher-backend
```

### Issue: SSL certificate renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
sudo systemctl reload nginx
```

---

## Useful Commands

```bash
# View application logs
pm2 logs researcher-backend

# Monitor performance
pm2 monit

# Restart application
pm2 restart researcher-backend

# Stop application
pm2 stop researcher-backend

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Check disk space
df -h

# Check memory
free -h

# System status
htop  # or top
```

---

## Maintenance

### Daily
- Check application status: `pm2 status`

### Weekly
- Review logs: `pm2 logs researcher-backend --lines 200`
- Check disk space: `df -h`

### Monthly
- Update system: `sudo apt update && sudo apt upgrade`
- Check SSL certificate: `sudo certbot certificates`
- Clear old logs

---

## Deploying Updates

```bash
# Navigate to project
cd /var/www/researcher

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Rebuild client
cd client && npm install && npm run build && cd ..

# Restart application
pm2 restart researcher-backend

# Check logs
pm2 logs researcher-backend
```

Or use the deploy script:
```bash
./deploy.sh
```

---

## MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com
2. Create free cluster (M0 Sandbox)
3. **Database Access**: Create user with password
4. **Network Access**: Add IP `0.0.0.0/0` (or your VPS IP)
5. **Connect**: Get connection string
6. Replace `<password>` and set database name to `research-agent`

---

## Next Steps

📖 **Full Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md)  
🔒 **Security Guide**: See [PRODUCTION.md](./PRODUCTION.md)  
✅ **Checklist**: See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)  

---

## Support

If you encounter issues:

1. **Check logs**: `pm2 logs researcher-backend`
2. **Check Nginx logs**: `sudo tail -f /var/log/nginx/error.log`
3. **Review documentation**: [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **Verify environment variables**: Check `.env` file

---

## Success! 🎉

Your Researcher platform is now live and running in production.

**Test your deployment:**
- ✅ Visit `https://researcher.synthomind.cloud`
- ✅ Create an account
- ✅ Start a new research project
- ✅ Monitor with `pm2 monit`

**Keep monitoring:**
```bash
pm2 monit  # Real-time monitoring
pm2 logs researcher-backend  # Application logs
```

---

**Deployment Time**: ~30 minutes  
**Last Updated**: January 29, 2026
