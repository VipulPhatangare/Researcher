# Production Configuration Guide

## Environment Variables Configuration

### Backend (.env)
Create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=5000

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/research-agent?retryWrites=true&w=majority

# n8n Webhooks - Update with your n8n instance URLs
N8N_WEBHOOK_PHASE1_URL=https://your-n8n-domain.com/webhook/phase-1
N8N_WEBHOOK_PHASE2_URL=https://your-n8n-domain.com/webhook/phase-2-research-paper
N8N_WEBHOOK_PHASE2_APPLICATIONS_URL=https://your-n8n-domain.com/webhook/phase-2-applications
N8N_WEBHOOK_PHASE2_GITHUB_URL=https://your-n8n-domain.com/webhook/phase-2-github-project
N8N_WEBHOOK_PHASE3_URL_RESERACH_PAPER=https://your-n8n-domain.com/webhook/phase-3-research-paper
N8N_WEBHOOK_PHASE3_GITHUB_URL=https://your-n8n-domain.com/webhook/phase-3-github-project-analysis
N8N_WEBHOOK_PHASE4_GAP_FINDER_URL=https://your-n8n-domain.com/webhook/phase-4-gap-finder
N8N_WEBHOOK_PHASE5_LITERATURE_REVIEW_URL=https://your-n8n-domain.com/webhook/phase-5-literature-review
N8N_WEBHOOK_CHATBOT_URL=https://your-n8n-domain.com/webhook/researcher-chatbot

# JWT Secret - Generate with: openssl rand -base64 32
JWT_SECRET=your-super-secret-key-minimum-32-characters-long-and-random
```

### Frontend (client/.env)
Create a `.env` file in the `client` directory:

```env
# Production API URL
REACT_APP_API_URL=https://researcher.synthomind.cloud/api

# Or for deployment where backend is on same domain
# REACT_APP_API_URL=/api
```

## MongoDB Atlas Setup

1. **Create Cluster**
   - Go to https://cloud.mongodb.com
   - Create a free cluster (M0 Sandbox)
   - Choose a cloud provider and region

2. **Configure Network Access**
   - Go to Network Access
   - Add IP Address: `0.0.0.0/0` (allow from anywhere)
   - Or add your VPS IP address specifically

3. **Create Database User**
   - Go to Database Access
   - Create a new user with read/write permissions
   - Save username and password

4. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your user password
   - Replace `<dbname>` with `research-agent`

## n8n Workflows Setup

Your n8n instance should have the following workflows configured:

1. **Phase 1**: Problem Understanding & Analysis
2. **Phase 2 - Research Papers**: Paper discovery
3. **Phase 2 - Applications**: Application search
4. **Phase 2 - GitHub**: GitHub project search
5. **Phase 3 - Research Papers**: Paper analysis
6. **Phase 3 - GitHub**: GitHub project analysis
7. **Phase 4**: Gap Finder
8. **Phase 5**: Literature Review
9. **Chatbot**: Research assistant chat

Each workflow should expose a webhook URL that you'll add to your `.env` file.

## Security Recommendations

### 1. JWT Secret
Generate a strong random secret:
```bash
openssl rand -base64 32
```

### 2. Environment Variables
- Never commit `.env` files to Git
- Use different secrets for development and production
- Rotate secrets regularly (every 3-6 months)

### 3. MongoDB Security
- Use strong passwords
- Enable IP whitelisting
- Use separate databases for dev/production
- Regularly review database access logs

### 4. CORS Configuration
In production, restrict CORS to your domain:

```javascript
// server.js
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://researcher.synthomind.cloud']
    : '*',
  credentials: true
};

app.use(cors(corsOptions));
```

### 5. Rate Limiting
Consider adding rate limiting middleware:

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

## Performance Optimization

### 1. PM2 Cluster Mode
`ecosystem.config.js` is configured to use all CPU cores:
```javascript
instances: 'max',
exec_mode: 'cluster'
```

### 2. Nginx Caching
Static files are cached for 1 year.
Consider adding API response caching for frequently accessed endpoints.

### 3. Database Indexing
Ensure MongoDB indexes are created:
```javascript
// In your models
userSchema.index({ email: 1 });
researchSessionSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ userEmail: 1 });
```

### 4. React Build Optimization
Build script already disables source maps for production:
```json
"build": "set \"GENERATE_SOURCEMAP=false\" && react-scripts build"
```

## Monitoring & Logging

### Application Logs
PM2 logs are stored in:
- Standard output: `./logs/out.log`
- Error logs: `./logs/error.log`

View logs:
```bash
pm2 logs researcher-backend
pm2 logs researcher-backend --err  # Errors only
tail -f logs/out.log               # Real-time
```

### Log Rotation
PM2 handles log rotation automatically, but you can configure it:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### System Monitoring
```bash
# CPU and Memory usage
pm2 monit

# System resources
htop
df -h    # Disk space
free -h  # Memory usage
```

## Backup Strategy

### Database Backups
MongoDB Atlas provides automatic backups (for paid tiers).

For manual backups:
```bash
# Backup
mongodump --uri="YOUR_MONGODB_URI" --out ./backup-$(date +%Y%m%d)

# Restore
mongorestore --uri="YOUR_MONGODB_URI" ./backup-20260129
```

### Code Backups
- Use Git for version control
- Push to remote repository (GitHub, GitLab, etc.)
- Tag releases: `git tag -a v1.0.0 -m "Version 1.0.0"`

### Configuration Backups
- Keep `.env.example` updated
- Document all custom configurations
- Store credentials securely (password manager)

## Scaling Considerations

### Horizontal Scaling
If traffic grows, consider:
1. Load balancer (Nginx, HAProxy)
2. Multiple VPS instances
3. Session store (Redis)
4. CDN for static assets

### Database Scaling
MongoDB Atlas offers:
1. Vertical scaling (upgrade cluster tier)
2. Sharding (for very large datasets)
3. Read replicas (for read-heavy workloads)

### Caching Layer
Add Redis for:
- Session storage
- API response caching
- Rate limiting
- Real-time features

## Troubleshooting Production Issues

### High Memory Usage
```bash
# Check memory
free -h

# PM2 restart
pm2 restart researcher-backend

# Set memory limit in ecosystem.config.js
max_memory_restart: '800M'
```

### High CPU Usage
```bash
# Check CPU
top
htop

# Check PM2 metrics
pm2 monit

# Review n8n webhook response times
```

### Database Connection Issues
1. Check MongoDB Atlas status
2. Verify IP whitelist
3. Check connection string
4. Monitor connection count

### Application Crashes
```bash
# Check error logs
pm2 logs researcher-backend --err --lines 100

# Check system logs
sudo journalctl -u researcher-backend -n 50

# Restart with PM2
pm2 restart researcher-backend
```

## Health Checks

### Automated Health Monitoring
Set up external monitoring:
- UptimeRobot (free tier available)
- Pingdom
- StatusCake

Monitor:
- `https://researcher.synthomind.cloud/api/health`
- Response time < 2 seconds
- 24/7 availability

### Manual Health Check
```bash
curl https://researcher.synthomind.cloud/api/health
```

Expected response:
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2026-01-29T12:00:00.000Z"
}
```

## Update Procedure

### Minor Updates (bug fixes)
```bash
cd /var/www/researcher
git pull origin main
npm install --production
npm run build:client
pm2 restart researcher-backend
```

### Major Updates (breaking changes)
1. Create database backup
2. Test in staging environment
3. Schedule maintenance window
4. Deploy during low traffic
5. Monitor for issues
6. Have rollback plan ready

## Rollback Procedure

```bash
# Go to project directory
cd /var/www/researcher

# Revert to previous version
git checkout tags/v1.0.0  # Replace with previous version tag

# Reinstall dependencies
npm install --production
npm run build:client

# Restart application
pm2 restart researcher-backend

# Monitor logs
pm2 logs researcher-backend
```

---

**Last Updated**: January 29, 2026
**Version**: 1.0.0
