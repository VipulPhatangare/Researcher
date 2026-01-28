# Researcher - AI-Powered Research Platform

A comprehensive AI-powered research automation platform that transforms research workflows through intelligent analysis, gap identification, and solution generation.

## 📚 Documentation

- 🚀 **[Quick Deployment Guide](QUICKSTART.md)** - Deploy to VPS in 30 minutes
- 📖 **[Full Deployment Guide](DEPLOYMENT.md)** - Complete VPS deployment instructions
- 🔒 **[Production Configuration](PRODUCTION.md)** - Security, monitoring, and optimization
- ✅  **[Deployment Checklist](DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment verification

## 🎯 Overview

**Researcher** is a full-stack research automation platform that leverages AI to provide end-to-end research assistance. From problem refinement to comprehensive solution generation, the platform handles complex research workflows through a sophisticated 6-phase analysis system.

### Key Features

- 🎯 **6-Phase Research Analysis** - Comprehensive workflow from problem refinement to solution generation
- 🤖 **AI-Powered Insights** - Advanced AI models for deep analysis and recommendations
- 📊 **Comprehensive Reports** - Detailed literature reviews, gap analysis, and actionable solutions
- ⚡ **Parallel Processing** - Simultaneous analysis of multiple research papers and repositories
- 💬 **Interactive Chat** - Ask questions and get clarifications about your research
- 📥 **Export & Share** - Download complete research reports in multiple formats
- 🔐 **User Authentication** - Secure login and session management
- 📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile devices

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js & Express.js - Server framework
- MongoDB & Mongoose - Database and ODM
- JWT Authentication - Secure user sessions
- n8n Integration - Workflow automation
- Axios - HTTP client for external APIs

**Frontend:**
- React 19.2.0 - UI framework
- React Router - Client-side routing
- Context API - State management
- CSS3 - Styling with responsive design
- Fetch API - Backend communication

## 📁 Project Structure

```
Reseracher/
├── server.js                    # Express server entry point
├── package.json                 # Backend dependencies
├── .env                         # Environment variables
├── config/
│   └── database.js              # MongoDB connection
├── models/
│   ├── ResearchSession.model.js # Research session schema
│   ├── user.model.js            # User authentication schema
│   └── feedback.model.js        # User feedback schema
├── controllers/
│   ├── research.controller.js   # Research logic
│   ├── auth.controller.js       # Authentication logic
│   ├── feedback.controller.js   # Feedback handling
│   └── report.controller.js     # Report generation
├── routes/
│   ├── research.routes.js       # Research API routes
│   ├── auth.routes.js           # Auth API routes
│   ├── feedback.routes.js       # Feedback routes
│   └── report.routes.js         # Report routes
├── services/
│   ├── n8n.service.js           # n8n webhook integration
│   └── email.service.js         # Email notifications
├── middleware/
│   ├── auth.middleware.js       # JWT verification
│   └── errorHandler.js          # Global error handling
└── client/                      # React frontend
    ├── package.json             # Frontend dependencies
    ├── public/
    │   └── index.html           # HTML template
    └── src/
        ├── components/          # React components
        ├── context/            # Context providers
        ├── services/           # API services
        └── utils/              # Utility functions
```
    ├── .env                     # Frontend environment variables
    ├── public/
    └── src/
        ├── App.js               # Main React component
        ├── App.css              # Main styles
        ├── services/
        │   └── api.js           # API client utilities
        └── components/
            ├── ResearchForm.js  # Problem statement input form
            ├── ResearchForm.css
            ├── Dashboard.js     # Session monitoring dashboard
            ├── Dashboard.css
            ├── SessionList.js   # All sessions view
            └── SessionList.css
```

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ and npm
- MongoDB Atlas account (or local MongoDB)
- n8n instance with configured webhooks

### Installation

1. **Clone and navigate to project**
```bash
cd "path/to/Reseracher"
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd client
npm install
cd ..
```

4. **Configure environment variables**

Create `.env` in the root directory:
```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/researcher?retryWrites=true&w=majority

# n8n Webhooks
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/phase1-prompt-enhancer
N8N_PHASE2_WEBHOOK_URL=https://your-n8n-instance.com/webhook/phase2-paper-search
N8N_PHASE3_WEBHOOK_URL=https://your-n8n-instance.com/webhook/phase3-analysis
N8N_PHASE4_WEBHOOK_URL=https://your-n8n-instance.com/webhook/phase4-gap-finder
N8N_PHASE5_WEBHOOK_URL=https://your-n8n-instance.com/webhook/phase5-literature-review
N8N_PHASE6_WEBHOOK_URL=https://your-n8n-instance.com/webhook/phase6-solution

# Server
PORT=5000
NODE_ENV=development

# JWT (for authentication)
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
```

5. **Start the development servers**

Run both frontend and backend:
```bash
npm run dev:full
```

Or run separately:

Terminal 1 (Backend):
```bash
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client
npm start
```

6. **Access the application**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## 🔬 Research Phases

### Phase 1: Problem Refinement
- Enhances initial problem statement with AI
- Generates relevant subtopics
- Creates research scope and focus areas
- **Duration:** ~1 minute

### Phase 2: Research Collection
- Searches academic papers (Google Scholar, Semantic Scholar)
- Identifies relevant GitHub repositories
- Finds real-world applications
- **Duration:** ~2-3 minutes

### Phase 3: Deep Analysis
- Analyzes research papers for methodologies and findings
- Reviews GitHub code implementations
- Extracts technical details and patterns
- **Duration:** ~15-20 minutes (parallel processing)

### Phase 4: Gap Identification
- Identifies evidence-based research gaps
- Discovers gaps mentioned in papers
- Predicts potential unexplored areas
- **Duration:** ~3-4 minutes

### Phase 5: Literature Review
- Generates comprehensive literature review
- Synthesizes findings across sources
- Creates structured academic summary
- **Duration:** ~2-3 minutes

### Phase 6: Solution Generation
- Creates best solution architecture
- Provides implementation workflow
- Recommends tech stack
- Includes scoring and limitations
- **Duration:** ~4-5 minutes
- **Note:** Requires user's expected outcome input

### Phase 7: Interactive Chat
- Ask questions about the research
- Get clarifications on findings
- Explore specific aspects in detail
- Real-time AI responses

## 📱 Features

### User Features
- 🔐 **Secure Authentication** - Login/Signup with JWT
- 📝 **New Research** - Start research with 30+ word problem statement
- 📚 **Research History** - View and manage all past research sessions
- 🔄 **Phase Retry** - Retry any failed phase with options to keep/delete data
- ⏹️ **Stop Execution** - Stop processing phases at any time
- 💬 **Interactive Chat** - Phase 7 chat for research clarifications
- 📥 **Download Reports** - Export complete research as PDF/document
- 💭 **Feedback System** - Submit feedback on research quality

### Technical Features
- ⚡ **Real-time Updates** - Auto-refresh session status
- 🎯 **Progress Tracking** - Visual progress indicators for all phases
- 🔄 **Parallel Processing** - Phase 2 & 3 run multiple tasks simultaneously
- 📊 **Comprehensive Error Handling** - Automatic retry and failure recovery
- 🌐 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎨 **Modern UI** - Beautiful gradients and smooth animations
- 🔍 **Smart Search** - Intelligent paper and repository discovery
- Backend API: http://localhost:5000/api
- Health Check: http://localhost:5000/api/health

## 📡 API Endpoints

### POST `/api/research/initiate`
Initiates Phase 1 with problem statement submission.

**Request Body:**
```json
{
  "problemStatement": "Your research problem (minimum 30 words)...",
  "metadata": {
    "additionalInfo": "optional"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Research session initiated...",
  "data": {
    "chatId": "unique-uuid-v4",
    "originalInput": "...",
    "currentPhase": 1,
    "status": "processing",
    "progress": 10
  }
}
```

### GET `/api/research/status/:chatId`
Get current status of a research session.

**Response:**
```json
{
  "success": true,
  "data": {
    "chatId": "...",
    "currentPhase": 1,
    "overallStatus": "processing",
    "progress": 33,
    "phase1Status": "completed",
    "enhancedInput": "Enhanced prompt from n8n..."
  }
}
```

### GET `/api/research/session/:chatId`
Get full details of a research session.

### GET `/api/research/sessions?page=1&limit=10`
Get all sessions with pagination.

## 🔧 n8n Webhook Configuration

Your n8n workflow should:

1. **Accept POST requests** with this payload:
```json
{
  "chatId": "unique-id",
  "originalInput": "problem statement",
  "timestamp": "ISO-8601",
  "phase": 1,
  "action": "enhance_prompt"
}
```

2. **Return enhanced prompt**:
```json
{
  "enhancedPrompt": "AI-enhanced version of the problem statement",
  "confidence": 0.95,
  "suggestions": []
}
```

3. **Webhook URL Format**: 
```
https://your-n8n-instance.app.n8n.cloud/webhook/prompt-enhancer
```

## 🎨 Features

### Phase 1 Features
✅ Problem statement validation (30-word minimum)  
✅ Unique chat ID generation (UUID v4)  
✅ n8n webhook integration for prompt enhancement  
✅ MongoDB storage (original + enhanced inputs)  
✅ Real-time dashboard with auto-polling  
✅ Session history with pagination  
✅ Progress tracking (0-100%)  
✅ Error handling and retry mechanisms  
✅ Responsive design for mobile/desktop  

### Upcoming Phases
🔜 Phase 2: Research Discovery (Domain identification, paper retrieval)  
🔜 Phase 3: Analysis & Synthesis (Paper analysis, solution generation)  
🔜 Phase 4+: Advanced analytics, knowledge graphs, etc.

## 📊 Database Schema

### ResearchSession Model
```javascript
{
  chatId: String (unique, indexed),
  originalInput: String (min 30 chars),
  enhancedInput: String,
  phases: {
    phase1: {
      status: 'pending' | 'processing' | 'completed' | 'failed',
      startedAt: Date,
      completedAt: Date,
      n8nWebhookSent: Boolean,
      n8nResponse: Object
    },
    phase2: { ... },
    phase3: { ... }
  },
  currentPhase: Number,
  overallStatus: String,
  progress: Number (0-100),
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

## 🛠️ Development

### Running Tests
```powershell
npm test
```

### Code Quality
```powershell
npm run lint
```

### Building for Production

Backend:
```powershell
npm start
```

Frontend:
```powershell
cd client
npm run build
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Verify `MONGODB_URI` in `.env`
- Check network access in MongoDB Atlas
- Ensure IP whitelist includes your IP

### n8n Webhook Errors
- Verify `N8N_WEBHOOK_URL` is correct
- Test webhook endpoint manually
- Check n8n workflow is active
- Review n8n logs for errors

### CORS Issues
- Backend includes CORS middleware
- Check `REACT_APP_API_URL` in `client/.env`
- Ensure ports don't conflict

### React App Not Starting
- Clear node_modules: `rm -rf node_modules; npm install`
- Clear cache: `npm cache clean --force`
- Check port 3000 is available

## 📝 Environment Variables

### Backend (.env)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| MONGODB_URI | MongoDB connection string | Yes | - |
| N8N_WEBHOOK_URL | n8n webhook endpoint | Yes | - |
| PORT | Server port | No | 5000 |
| NODE_ENV | Environment mode | No | development |

### Frontend (client/.env)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| REACT_APP_API_URL | Backend API URL | No | http://localhost:5000/api |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🚀 Deployment

### Backend Deployment (Node.js)

**Recommended Platforms:**
- Heroku
- Railway
- Render
- DigitalOcean App Platform

**Environment Setup:**
```bash
# Production environment variables
NODE_ENV=production
MONGODB_URI=<your-production-mongodb-uri>
JWT_SECRET=<strong-secret-key>
N8N_WEBHOOK_URL=<production-n8n-url>
# ... all other webhook URLs
```

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

### Frontend Deployment (React)

**Recommended Platforms:**
- Vercel
- Netlify
- AWS Amplify
- GitHub Pages

**Build Process:**
```bash
cd client
npm install
npm run build
```

**Environment Variables:**
```bash
REACT_APP_API_URL=https://your-backend-url.com/api
```

### Production Checklist

- [ ] Update all webhook URLs to production endpoints
- [ ] Set strong JWT_SECRET for authentication
- [ ] Enable MongoDB IP whitelist for production servers
- [ ] Configure CORS for production frontend URL
- [ ] Set up error monitoring (Sentry, LogRocket)
- [ ] Enable HTTPS/SSL certificates
- [ ] Test all 6 phases end-to-end
- [ ] Set up automated backups for MongoDB
- [ ] Configure rate limiting for APIs
- [ ] Add analytics tracking (Google Analytics, Mixpanel)

## 🔒 Security

- JWT-based authentication with httpOnly cookies
- Password hashing with bcrypt
- MongoDB injection protection via Mongoose
- XSS protection with React's built-in escaping
- CORS configuration for allowed origins
- Environment variables for sensitive data
- Input validation on all endpoints
- Rate limiting on authentication endpoints

## 📊 Performance Optimizations

- **Parallel Processing** - Phases 2 & 3 run concurrent tasks
- **Lazy Loading** - Components loaded on-demand
- **Memoization** - React components optimized with useMemo/useCallback
- **Database Indexing** - MongoDB indexes on chatId and userEmail
- **Caching** - Session data cached in frontend context
- **Code Splitting** - React Router lazy loading
- **Compression** - Gzip compression for API responses
- **CDN Ready** - Static assets optimized for CDN delivery

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Android)

Minimum requirements:
- ES6 support
- CSS Grid support
- Flexbox support
- Local Storage API

## 📄 License

MIT License

Copyright (c) 2026 Researcher Platform

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🙏 Acknowledgments

- **OpenAI GPT Models** - Powering AI analysis and insights
- **n8n** - Workflow automation platform
- **MongoDB Atlas** - Cloud database hosting
- **React Team** - Amazing frontend framework
- **Express.js** - Fast Node.js web framework
- **Semantic Scholar API** - Academic paper search
- **GitHub API** - Repository discovery
- **All Contributors** - Community support and feedback

## 📞 Support & Contact

### Documentation
- API Documentation: `/api/docs` (when server is running)
- Component Documentation: See individual component files

### Issues & Bugs
- Report bugs via GitHub Issues
- Include error logs and steps to reproduce
- Specify environment (OS, Node version, browser)

### Feature Requests
- Submit via GitHub Discussions
- Describe use case and expected behavior
- Include mockups or examples if possible

---

<div align="center">

**🔬 Researcher Platform 2026**

*Transforming Research Through AI*

[Documentation](README.md) • [Report Bug](issues) • [Request Feature](issues)

**Built with ❤️ for the research community**

</div>
