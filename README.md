# AI Orchestrator Engine — Frontend

React + Vite dashboard for the LLM Orchestration Engine (landing, playground / Routing Theater, Overview).

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL` to your running API (default `http://127.0.0.1:8000`). In local `npm run dev`, Vite can also proxy `/v1` to that URL.

## Vercel

1. Import this repo.
2. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. Environment variable:
   - `VITE_API_URL` = `https://your-backend-host` (no trailing slash)
4. Redeploy after changing env (Vite inlines it at build time).

This repository is **frontend only**. The FastAPI backend is a separate repo/deployment.
