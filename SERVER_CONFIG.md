# Server Configuration Details

## 🌐 Domain & Server Information

**Production Domain**: researcher.synthomind.cloud  
**Server IP Address**: 194.238.17.210  
**Server OS**: Ubuntu 20.04+ / Debian 11+ (recommended)

---

## 🔌 SSH Connection

```bash
# Connect as root
ssh root@194.238.17.210

# Or connect as user
ssh username@194.238.17.210
```

---

## 📋 DNS Configuration

Ensure your DNS records are set:

```
Type: A Record
Name: researcher (or @)
Value: 194.238.17.210
TTL: 3600 (or Auto)

Type: A Record (optional for www)
Name: www
Value: 194.238.17.210
TTL: 3600
```

**Verify DNS:**
```bash
# Check DNS propagation
nslookup researcher.synthomind.cloud
ping researcher.synthomind.cloud
```

---

## 🔐 SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d researcher.synthomind.cloud

# Verify certificate
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run
```

---

## 🌍 Nginx Configuration

**Config file**: `/etc/nginx/sites-available/researcher`

```nginx
server {
    listen 80;
    server_name researcher.synthomind.cloud;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name researcher.synthomind.cloud;

    ssl_certificate /etc/letsencrypt/live/researcher.synthomind.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/researcher.synthomind.cloud/privkey.pem;
    
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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

---

## ⚙️ Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/research-agent
JWT_SECRET=<generate-with-openssl-rand-base64-32>
N8N_WEBHOOK_PHASE1_URL=https://n8n.srv1162962.hstgr.cloud/webhook/phase-1
# ... (all other n8n webhooks)
```

### Frontend (client/.env)
```env
REACT_APP_API_URL=https://researcher.synthomind.cloud/api
```

---

## 🔥 UFW Firewall

```bash
# Allow SSH (IMPORTANT!)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 🚀 Quick Deployment Commands

```bash
# 1. Connect to server
ssh root@194.238.17.210

# 2. Navigate to project
cd /var/www/researcher

# 3. Pull latest changes (if using Git)
git pull origin main

# 4. Install dependencies
npm install --production
cd client && npm install && npm run build && cd ..

# 5. Restart application
pm2 restart researcher-backend

# 6. Check status
pm2 status
pm2 logs researcher-backend
```

---

## 🔍 Verification URLs

After deployment, test these:

- **Health Check**: https://researcher.synthomind.cloud/api/health
- **Frontend**: https://researcher.synthomind.cloud
- **API Test**: https://researcher.synthomind.cloud/api/auth/status

---

## 📊 Monitoring Commands

```bash
# PM2 Status
pm2 status
pm2 monit
pm2 logs researcher-backend

# System Resources
htop
df -h        # Disk space
free -h      # Memory

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# SSL Certificate
sudo certbot certificates
```

---

## 🔧 Troubleshooting

### Application not starting
```bash
pm2 logs researcher-backend --lines 50
pm2 restart researcher-backend
```

### Port 5000 in use
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
pm2 restart researcher-backend
```

### Nginx issues
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### SSL certificate issues
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 📞 Important Information

**Application Path**: `/var/www/researcher`  
**Backend Port**: 5000  
**Process Manager**: PM2  
**Web Server**: Nginx  
**Database**: MongoDB Atlas  
**n8n Instance**: n8n.srv1162962.hstgr.cloud  

---

## 📝 Quick Reference

| Item | Value |
|------|-------|
| Domain | researcher.synthomind.cloud |
| Server IP | 194.238.17.210 |
| SSH Port | 22 |
| HTTP Port | 80 |
| HTTPS Port | 443 |
| Backend Port | 5000 |
| PM2 Process | researcher-backend |

---

**Last Updated**: January 29, 2026  
**Status**: Ready for Deployment ✅
