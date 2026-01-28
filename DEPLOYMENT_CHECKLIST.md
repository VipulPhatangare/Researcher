# VPS Deployment Checklist

## Pre-Deployment
- [ ] Test application locally with `npm run dev:full`
- [ ] Ensure all environment variables are configured in `.env`
- [ ] Verify MongoDB Atlas connection string
- [ ] Verify all n8n webhook URLs are working
- [ ] Generate strong JWT_SECRET: `openssl rand -base64 32`
- [ ] Update MONGODB_URI to use production database
- [ ] Set NODE_ENV=production in `.env`
- [ ] Commit and push all changes to Git repository

## Server Setup
- [ ] VPS with minimum 2GB RAM, 2 CPU cores
- [ ] Ubuntu 20.04+ or Debian 11+ installed
- [ ] Domain name pointed to VPS IP address
- [ ] SSH access configured
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] Nginx installed and running
- [ ] Git installed
- [ ] UFW firewall configured (ports 22, 80, 443)

## Application Setup
- [ ] Create directory: `/var/www/researcher`
- [ ] Clone repository or upload files
- [ ] Copy `.env.example` to `.env` and configure
- [ ] Run `npm install --production` in root
- [ ] Run `npm run build:client` to build React app
- [ ] Create logs directory: `mkdir -p logs`
- [ ] Test with `npm start` (then stop with Ctrl+C)

## Nginx Configuration
- [ ] Create Nginx config: `/etc/nginx/sites-available/researcher`
- [ ] Update domain name in Nginx config
- [ ] Enable site: `ln -s /etc/nginx/sites-available/researcher /etc/nginx/sites-enabled/`
- [ ] Test config: `sudo nginx -t`
- [ ] Reload Nginx: `sudo systemctl reload nginx`

## SSL Certificate
- [ ] Install Certbot: `sudo apt install certbot python3-certbot-nginx`
- [ ] Obtain certificate: `sudo certbot --nginx -d researcher.synthomind.cloud`
- [ ] Test auto-renewal: `sudo certbot renew --dry-run`
- [ ] Verify renewal timer: `sudo systemctl status certbot.timer`

## PM2 Setup
- [ ] Start app: `pm2 start ecosystem.config.js --env production`
- [ ] Configure startup: `pm2 startup systemd`
- [ ] Save PM2 list: `pm2 save`
- [ ] Verify status: `pm2 status`
- [ ] Check logs: `pm2 logs researcher-backend`

## Security
- [ ] Change default SSH port (optional but recommended)
- [ ] Disable root login: Edit `/etc/ssh/sshd_config`
- [ ] Enable SSH key authentication only
- [ ] Configure UFW firewall
- [ ] Set proper file permissions: `chmod 600 .env`
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Strong JWT_SECRET in production
- [ ] Review Nginx security headers

## Post-Deployment Testing
- [ ] Health check: `https://researcher.synthomind.cloud/api/health`
- [ ] Frontend loads: `https://researcher.synthomind.cloud`
- [ ] Sign up new user
- [ ] Login existing user
- [ ] Create new research session
- [ ] Test all 6 phases
- [ ] Submit feedback
- [ ] Test chat functionality
- [ ] Test logout
- [ ] Check responsive design on mobile
- [ ] Test in different browsers

## Monitoring Setup
- [ ] PM2 monitoring: `pm2 monit`
- [ ] Check CPU usage: `top` or `htop`
- [ ] Check memory: `free -h`
- [ ] Check disk space: `df -h`
- [ ] Review Nginx logs: `/var/log/nginx/error.log`
- [ ] Review application logs: `pm2 logs researcher-backend`

## Backup & Recovery
- [ ] MongoDB Atlas automatic backups verified
- [ ] Document database restore procedure
- [ ] Keep `.env.example` updated
- [ ] Document any custom configurations
- [ ] Have rollback plan ready

## Performance Optimization
- [ ] Gzip compression enabled in Nginx ✓
- [ ] HTTP/2 enabled ✓
- [ ] Static file caching enabled ✓
- [ ] PM2 cluster mode enabled ✓
- [ ] React app built without source maps ✓
- [ ] Monitor performance with `pm2 monit`

## Maintenance
- [ ] Schedule: Weekly system updates
- [ ] Schedule: Monthly log cleanup
- [ ] Schedule: Monthly security audit
- [ ] Schedule: Database backup verification
- [ ] Document any issues encountered
- [ ] Keep deployment documentation updated

## Emergency Contacts
- VPS Provider Support: ________________
- Domain Registrar Support: ________________
- MongoDB Atlas Support: support@mongodb.com
- Team Lead: ________________

## Important URLs
- Production URL: https://________________
- MongoDB Atlas: https://cloud.mongodb.com
- n8n Instance: https://________________
- Server IP: ________________

## Credentials Backup
⚠️ **Keep these secure and private!**
- [ ] SSH access saved in password manager
- [ ] MongoDB credentials backed up
- [ ] JWT_SECRET backed up securely
- [ ] SSL certificates location documented
- [ ] n8n access credentials saved

---

**Deployment Date**: _________________
**Deployed By**: _________________
**Notes**: _________________
