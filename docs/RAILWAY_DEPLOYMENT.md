# Railway Deployment Guide

This guide walks you through deploying the Research Paper Analyzer backend and ArXiv service to Railway using GitHub integration.

## Prerequisites

- GitHub account with repository access
- Railway account (https://railway.app)
- Subconscious API key (https://subconscious.dev)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        RAILWAY PROJECT                       │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │  Backend Service    │───▶│  ArXiv Service      │         │
│  │  (FastAPI)          │    │  (FastAPI)          │         │
│  │                     │    │                     │         │
│  │  Env Vars:          │    │  No secrets needed  │         │
│  │  - SUBCONSCIOUS_KEY │    │                     │         │
│  │  - ARXIV_SERVICE_URL│    │                     │         │
│  │  - CORS_ORIGINS     │    │                     │         │
│  └─────────────────────┘    └─────────────────────┘         │
│           │                          │                       │
│           └──────────────────────────┘                       │
│                    Internal Network                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Push Code to GitHub

```bash
cd /path/to/research-paper-analyzer-v2

# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Railway deployment"

# Add remote (create repo on GitHub first)
git remote add origin https://github.com/YOUR_USERNAME/research-paper-analyzer-v2.git

# Push
git branch -M main
git push -u origin main
```

---

## Step 2: Create Railway Project

1. Go to https://railway.app and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub
5. Select your `research-paper-analyzer-v2` repository

---

## Step 3: Deploy ArXiv Service (First)

Deploy ArXiv first because the Backend needs its URL.

### 3.1 Create ArXiv Service

1. In your Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select the same repository
3. Railway will detect multiple services - click **"Add Service"**
4. Configure the service:
   - **Name**: `arxiv-service`
   - **Root Directory**: `arxiv-service`
   - **Builder**: Dockerfile (auto-detected)

### 3.2 Configure ArXiv Service

Click on the service → **Settings** tab:

| Setting | Value |
|---------|-------|
| Root Directory | `arxiv-service` |
| Watch Paths | `arxiv-service/**` |

Click on **Variables** tab:
- No environment variables needed for ArXiv service

### 3.3 Generate Domain for ArXiv

1. Click on the arxiv-service
2. Go to **Settings** → **Networking**
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://arxiv-service-production-xxxx.up.railway.app`)

---

## Step 4: Deploy Backend Service

### 4.1 Create Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the same repository
3. Configure:
   - **Name**: `backend`
   - **Root Directory**: `backend`

### 4.2 Configure Backend Settings

Click on **Settings** tab:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Watch Paths | `backend/**` |

### 4.3 Add Environment Variables

Click on **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `SUBCONSCIOUS_API_KEY` | `your-api-key` | From subconscious.dev |
| `SUBCONSCIOUS_ENGINE` | `tim-large` | or `tim-gpt`, `tim-small-preview` |
| `ARXIV_SERVICE_URL` | `https://arxiv-service-xxx.up.railway.app` | URL from Step 3.3 |
| `CORS_ORIGINS` | `https://your-app.vercel.app,http://localhost:3000` | Comma-separated |
| `PORT` | `8000` | Railway sets this automatically, but explicit is safer |

### 4.4 Generate Domain for Backend

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://backend-production-xxxx.up.railway.app`)

---

## Step 5: Verify Deployment

### Test ArXiv Service

```bash
# Health check
curl https://arxiv-service-xxx.up.railway.app/health

# Test search
curl -X POST https://arxiv-service-xxx.up.railway.app/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "max_results": 3}'
```

### Test Backend Service

```bash
# Health check
curl https://backend-xxx.up.railway.app/health

# Readiness check
curl https://backend-xxx.up.railway.app/health/ready

# List engines
curl https://backend-xxx.up.railway.app/api/research/engines
```

---

## Step 6: Configure Frontend

Update your frontend to use the Railway backend URL.

### For Vercel Deployment

Create `.env.production` in your frontend directory:

```env
NEXT_PUBLIC_API_URL=https://backend-xxx.up.railway.app
```

Or set it in Vercel Dashboard → Project Settings → Environment Variables.

### For Local Development

Keep `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Railway Dashboard Overview

After deployment, your Railway project should look like:

```
research-paper-analyzer-v2 (Project)
├── backend (Service)
│   ├── Domain: backend-xxx.up.railway.app
│   ├── Status: Deployed ✓
│   └── Variables: 4 configured
│
└── arxiv-service (Service)
    ├── Domain: arxiv-xxx.up.railway.app
    └── Status: Deployed ✓
```

---

## Troubleshooting

### Service won't start

1. Check **Deployments** tab for build logs
2. Verify Dockerfile syntax
3. Check that all required environment variables are set

### Health check failing

1. Ensure `/health` endpoint returns 200
2. Check logs for startup errors
3. Verify PORT environment variable matches Dockerfile EXPOSE

### CORS errors in browser

1. Add your frontend domain to `CORS_ORIGINS`
2. Format: comma-separated, no spaces around commas
3. Example: `https://app.vercel.app,http://localhost:3000`

### ArXiv not working

1. Verify `ARXIV_SERVICE_URL` is set correctly in backend
2. Check ArXiv service logs for errors
3. Test ArXiv service directly with curl

### Backend can't reach ArXiv

Railway services in the same project can communicate via:
- **Public URL**: `https://arxiv-service-xxx.up.railway.app`
- **Internal URL**: `http://arxiv-service.railway.internal` (faster, no egress)

To use internal URL, set:
```
ARXIV_SERVICE_URL=http://arxiv-service.railway.internal:8001
```

---

## Cost Management

Railway Starter plan includes:
- $5 free credits/month
- ~500 hours of compute

Tips to reduce costs:
1. Use sleep/wake patterns for dev environments
2. Set resource limits in railway.toml
3. Monitor usage in Railway dashboard

---

## Automatic Deployments

With GitHub integration, Railway automatically:
- Deploys on push to `main` branch
- Respects `Watch Paths` (only rebuilds on relevant changes)
- Rolls back on failed health checks

To disable auto-deploy:
1. Service → Settings → Deploys
2. Toggle off "Auto Deploy"

---

## Next Steps

1. Set up Vercel for frontend: See `docs/VERCEL_DEPLOYMENT.md`
2. Configure custom domain: Railway Settings → Domains
3. Set up monitoring: Railway integrates with Datadog, Grafana

