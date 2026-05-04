# ☁️ Cloud Cost Optimizer — Backend

A Node.js backend for a cloud cost optimization dashboard supporting **AWS**, **Azure**, and **GCP** with a built-in **AI agent** powered by **Google Gemini**.

---

## 📁 Project Structure

```
cloud-cost-optimizer/
├── server.js                    ← Express app entry point
├── package.json
├── .env                         ← Your config (copy from .env.example)
├── .env.example                 ← Template with all settings documented
│
├── config/
│   └── config.js                ← Centralized config (reads .env)
│
├── data/
│   └── mock/
│       ├── aws-mock.json        ← Mock AWS data (EC2, Lambda, S3, RDS, etc.)
│       ├── azure-mock.json      ← Mock Azure data (VMs, AKS, SQL, etc.)
│       └── gcp-mock.json        ← Mock GCP data (GKE, BigQuery, GCS, etc.)
│
├── src/
│   ├── controllers/
│   │   ├── authController.js    ← Login, register, cloud account management
│   │   ├── dashboardController.js ← Dashboard data, service & instance detail
│   │   └── aiController.js      ← All AI/Gemini endpoints + chat history
│   │
│   ├── middleware/
│   │   └── auth.js              ← JWT verification middleware
│   │
│   ├── routes/
│   │   ├── authRoutes.js        ← /api/auth/*
│   │   ├── dashboardRoutes.js   ← /api/dashboard/*
│   │   └── aiRoutes.js          ← /api/ai/*
│   │
│   ├── services/
│   │   ├── dataSourceService.js ← ⭐ THE FLAG — mock vs real data pipeline
│   │   ├── aws/awsService.js    ← Live AWS SDK v3 data fetcher
│   │   ├── azure/azureService.js← Live Azure REST API fetcher
│   │   ├── gcp/gcpService.js    ← Live GCP REST API fetcher
│   │   └── ai/geminiService.js  ← All Gemini AI features
│   │
│   └── utils/
│       ├── logger.js            ← Timestamped logger
│       └── helpers.js           ← Utility functions
│
├── public/                      ← Test UI (served at http://localhost:3000)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
│
└── tests/
    └── test-api.js              ← Full API test suite (no framework needed)
```

---

## 🚀 Setup & Run (On Another PC)

### Step 1 — Prerequisites

Make sure you have:
- **Node.js** v18 or later: https://nodejs.org
- **npm** (comes with Node.js)

Verify installation:
```bash
node --version   # Should be v18+
npm --version    # Should be v9+
```

---

### Step 2 — Copy the Project

Copy the entire `cloud-cost-optimizer/` folder to your new PC.

---

### Step 3 — Install Dependencies

```bash
cd cloud-cost-optimizer
npm install
```

This installs:
- `express` — web framework
- `jsonwebtoken` — auth tokens
- `@google/generative-ai` — Gemini AI
- `@aws-sdk/*` — AWS real-data (only used when flag is ON)
- `axios` — Azure/GCP HTTP calls
- `cors`, `helmet`, `morgan` — security/logging
- `dotenv` — environment config
- `nodemon` — auto-restart in dev
- `uuid`, `bcryptjs`, `ws`, `express-rate-limit`

---

### Step 4 — Configure Environment

The `.env` file is already pre-configured for **mock data mode** (no cloud credentials needed):

```env
USE_REAL_DATA=false   ← Keep false to use mock JSON files
GEMINI_API_KEY=       ← Optional: add to enable live AI responses
```

**To get a free Gemini API key:**
1. Go to https://aistudio.google.com
2. Click "Get API Key"
3. Copy the key and paste it in `.env` as `GEMINI_API_KEY=your_key_here`

---

### Step 5 — Start the Server

```bash
# Development mode (auto-restarts on file changes)
npm run dev

# OR production mode
npm start
```

You should see:
```
╔══════════════════════════════════════════════════════╗
║      ☁️  Cloud Cost Optimizer — Backend Started       ║
╚══════════════════════════════════════════════════════╝

  🚀 Server:      http://localhost:3000
  🖥️  Test UI:     http://localhost:3000
  ❤️  Health:      http://localhost:3000/api/health
  📊 Data Mode:   🟡 MOCK DATA (from /data/mock/*.json)
  🤖 Gemini AI:   🔴 Not configured (placeholder responses)
```

---

### Step 6 — Open Test UI

Open your browser and go to: **http://localhost:3000**

**Default test credentials:**
| Username | Password |
|----------|----------|
| `admin`  | `admin123` |
| `demo`   | `demo123` |

---

### Step 7 — Run API Tests

In a **second terminal** (while server is running):
```bash
node tests/test-api.js
```

---

## 🔁 The Mock/Real Data Flag

The **most important setting** in `.env`:

```env
USE_REAL_DATA=false   # Uses /data/mock/*.json  ← SAFE, works out of the box
USE_REAL_DATA=true    # Calls live cloud APIs    ← Needs credentials below
```

### ▶ Mock Mode (default)
- No cloud credentials needed
- Data comes from `data/mock/aws-mock.json`, `azure-mock.json`, `gcp-mock.json`
- You can edit those JSON files to customize the demo data
- The dashboard variable is **the same** in both modes — your frontend code doesn't change

### ▶ Real Mode
Set `USE_REAL_DATA=true` and fill in credentials in `.env`:

**AWS:**
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```
> Requires: `CloudWatch:GetMetricStatistics`, `EC2:DescribeInstances`, `Cost Explorer` permissions

**Azure:**
```env
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret
```
> Requires: Create an App Registration in Azure AD with Cost Management Reader role

**GCP:**
```env
GCP_PROJECT_ID=my-project-id
GCP_API_KEY=AIza...
# OR
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```
> Requires: `Compute Engine API`, `Cloud Storage API`, `Cloud Billing API` enabled

---

## 📡 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login, get JWT token |
| POST | `/api/auth/register` | — | Register new user |
| GET | `/api/auth/profile` | ✅ | Get user profile + connected clouds |
| POST | `/api/auth/cloud-account` | ✅ | Add a new cloud provider |
| DELETE | `/api/auth/cloud-account/:cloud` | ✅ | Remove a cloud provider |

### Dashboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | — | Server health + data mode |
| GET | `/api/dashboard/status` | ✅ | Data source mode (mock/real) |
| GET | `/api/dashboard/:cloud` | ✅ | Full dashboard for aws/azure/gcp |
| GET | `/api/dashboard/:cloud/services` | ✅ | All services for a cloud |
| GET | `/api/dashboard/:cloud/alerts` | ✅ | Cost alerts |
| GET | `/api/dashboard/:cloud/service/:svc` | ✅ | Specific service detail |
| GET | `/api/dashboard/:cloud/service/:svc/instance/:id` | ✅ | Individual resource |
| POST | `/api/dashboard/:cloud/refresh` | ✅ | Clear data cache |
| GET | `/api/dashboard/multi-cloud?clouds=aws,gcp` | ✅ | Multi-cloud comparison |

### AI Agent
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/ai/overview/:cloud` | ✅ | AI dashboard overview |
| GET | `/api/ai/instance/:cloud/:svc/:id` | ✅ | AI analysis for a resource |
| GET | `/api/ai/migration/:cloud?targetCloud=gcp` | ✅ | Migration advice |
| GET | `/api/ai/best-cloud?clouds=aws,gcp` | ✅ | Best cloud recommendation |
| POST | `/api/ai/chat` | ✅ | Interactive AI chat |
| POST | `/api/ai/chat/clear` | ✅ | Clear chat history |

### Login Request Body
```json
{
  "username": "admin",
  "password": "admin123",
  "selectedClouds": ["aws", "gcp"]
}
```

### Chat Request Body
```json
{
  "message": "Which service is costing the most?",
  "cloud": "aws",
  "context": "dashboard"
}
```

---

## ☁️ Supported Services

| AWS | Azure | GCP |
|-----|-------|-----|
| Amazon EC2 | Azure Virtual Machines | Compute Engine |
| AWS Lambda | Azure Functions | Cloud Functions |
| Amazon S3 | Azure Blob Storage | Cloud Storage |
| Amazon RDS | Azure SQL Database | Firestore |
| Amazon DynamoDB | Azure Cosmos DB | BigQuery |
| Amazon CloudFront | Azure App Service | App Engine |
| AWS Elastic Beanstalk | Azure Kubernetes Service | GKE |
| Amazon ECS/EKS | Azure File Storage | Filestore |

---

## 🤖 AI Features

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Dashboard Overview | `GET /api/ai/overview/:cloud` | High-level cost analysis |
| Instance Analysis | `GET /api/ai/instance/:cloud/:svc/:id` | Per-resource deep dive |
| Migration Advisor | `GET /api/ai/migration/:cloud` | Should you migrate? |
| Best Cloud | `GET /api/ai/best-cloud` | Multi-cloud comparison |
| Interactive Chat | `POST /api/ai/chat` | Conversational Q&A |

Without a Gemini API key, all AI endpoints return **detailed placeholder responses** so the rest of the system still works.

---

## 🔐 Security Notes

- JWT tokens expire after 8 hours (configurable via `SESSION_TIMEOUT_HOURS`)
- Rate limiting: 100 req/15min globally, 20 req/min for AI chat
- Credentials are stored in-memory only (replace with a database in production)
- In production: use HTTPS, restrict CORS origin, encrypt stored credentials

---

## 🛠 Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module 'express'` | Run `npm install` |
| `JWT_SECRET too short` | Check `.env` has 32+ char secret |
| AI returns placeholder text | Add `GEMINI_API_KEY` to `.env` |
| Real data fetch fails | Check cloud credentials in `.env` |
| Port 3000 in use | Change `PORT=3001` in `.env` |
| `USE_REAL_DATA=true` but no data | Missing cloud credentials — it falls back to mock |
