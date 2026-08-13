# ChipCost Backend — Node.js + Express + MongoDB + AI

The API server that powers the ChipCost frontend. Full-stack MERN with an AI RAG pipeline.

## What's inside

- **Express** — REST API
- **MongoDB** (via Mongoose) — stores users, projects, conversations, RAG knowledge base
- **JWT auth** — bcrypt + jsonwebtoken
- **Google Gemini** — LLM (`gemini-2.0-flash`) + embeddings (`text-embedding-004`) — **free tier, no credit card**
- **In-memory RAG** — cosine similarity search over cost knowledge base
- **Rate limiting** — 20 AI requests/min per IP
- **Rule-based fallback** — deterministic advisor if LLM is unavailable

## Prerequisites

1. **Node.js 18+** — https://nodejs.org
2. **MongoDB Community Server** — https://mongodb.com/try/download/community
3. **MongoDB Compass** (bundled with Community, GUI for inspecting data)
4. **Gemini API key** (free) — https://aistudio.google.com/apikey

## Quick start (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — paste your GEMINI_API_KEY

# 3. Start MongoDB (if not auto-started)
# On macOS with Homebrew:
brew services start mongodb-community
# On Linux:
sudo systemctl start mongod
# On Windows: MongoDB service starts automatically

# 4. Verify MongoDB in Compass
# Open Compass, connect to mongodb://localhost:27017
# You should see empty databases list — good

# 5. Seed the RAG knowledge base (~1 minute, uses Gemini free tier)
npm run seed

# 6. Start the API
npm run dev
# → API running on http://localhost:5000
```

Verify:
```bash
curl http://localhost:5000/api/health
# → { "ok": true, "ts": 1234567890 }
```

## Project structure

```
src/
├── app.js                       # Express entry
├── config/
│   └── db.js                    # MongoDB connection
├── models/                      # Mongoose schemas
│   ├── User.js
│   ├── Project.js               # inputs + meta + results
│   ├── Conversation.js          # AI chat history
│   └── CostData.js              # RAG knowledge base (with embeddings)
├── routes/
│   ├── auth.js                  # /api/auth/*
│   ├── projects.js              # /api/projects/*
│   ├── calc.js                  # /api/calc/*
│   └── copilot.js               # /api/copilot/*
├── calc/
│   ├── costEngine.js            # All formulas (self-testable)
│   └── cellLibraryImpact.js     # Strategic comparison
├── ai/
│   ├── llm.js                   # Gemini chat
│   ├── embeddings.js            # Gemini embeddings
│   ├── rag.js                   # In-memory vector search
│   ├── prompts.js               # System prompts
│   └── rules.js                 # Rule-based fallback
├── middleware/
│   └── auth.js                  # JWT verification
└── seed/
    ├── costTables.js            # Static cost data
    └── seedCostData.js          # Populates DB + embeddings
```

## API endpoints

### Auth (no token required)

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user }` |

### Projects (auth required — `Authorization: Bearer <token>`)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Fetch one project |
| POST | `/api/projects` | Create (body: `{ meta: { name, tags, description } }`) |
| PUT | `/api/projects/:id/inputs` | Update inputs |
| PUT | `/api/projects/:id/meta` | Update name/tags/description |
| DELETE | `/api/projects/:id` | Delete |

### Calculations (no auth required — pure computation)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/calc` | Full cost calculation from inputs |
| POST | `/api/calc/cell-library-impact` | Cell Library comparison |
| GET | `/api/calc/nodes` | List available tech nodes |
| GET | `/api/calc/data-tables` | All cost tables + sources |

### AI Copilot (rate-limited to 20/min)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/copilot/query` | Ask the AI (RAG + LLM) |
| POST | `/api/copilot/insights` | Rule-based proactive insights (fast) |
| GET | `/api/copilot/history/:projectId` | Conversation history |

## Testing the API

```bash
# 1. Register a user
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}' \
  | jq -r .token)
echo $TOKEN

# 2. Create a project
PROJ=$(curl -s -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meta":{"name":"Test AI Chip","tags":"ai,5nm"}}')
PROJ_ID=$(echo $PROJ | jq -r .id)
echo "Project: $PROJ_ID"

# 3. Calculate costs
curl -s -X POST http://localhost:5000/api/calc \
  -H "Content-Type: application/json" \
  -d '{"node":"5nm","areaMm2":400,"category":"ai","volume":100000,"teamSize":40,"region":"us_sv","designMonths":24,"packageType":"cowos","sellingPrice":500}' \
  | jq .outputs.totalCost
# Expect a number around 130-150M

# 4. Ask the AI
curl -s -X POST http://localhost:5000/api/copilot/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Is 5nm the right choice for 100K volume?"}' \
  | jq
```

## Connecting to the frontend

In your frontend `.env.local`:
```
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

Restart the Next.js dev server. Everything now flows through this backend.

## Inspecting data in Compass

1. Open MongoDB Compass, connect to `mongodb://localhost:27017`
2. Open the `chipcost` database
3. Collections you'll see:
   - `users` — registered users (with bcrypt hashes)
   - `projects` — user projects
   - `conversations` — AI chat history
   - `costdatas` — RAG knowledge base (with 768-dim embeddings)

## Gemini free tier limits

- **15 requests/minute** for `gemini-2.0-flash`
- **1M tokens/day**
- **1500 requests/day**

More than enough for a hackathon. If you hit the limit, the rule-based advisor kicks in automatically.

## Troubleshooting

**"MongoDB connection failed"**
→ Make sure MongoDB is running: `brew services list` or `systemctl status mongod`

**"GEMINI_API_KEY not set"**
→ Get one free at https://aistudio.google.com/apikey and put it in `.env`

**"Seed script failed at embedding generation"**
→ Usually rate-limit or bad API key. Wait 60 seconds, re-run `npm run seed`.

**"Copilot returns rule-based responses instead of AI"**
→ The LLM call is failing (bad key, rate limit, network). Check server logs. Rule-based is the fallback — it still works.

**"Empty results in cell library impact"**
→ Wafer/D0 data missing for that node. Check `seed/costTables.js`.

## Deployment

**Development (local)**: `npm run dev`

**Production**:
- Any Node host: Render, Railway, Fly.io, DigitalOcean App Platform
- Set env vars: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `CLIENT_URL`
- Use MongoDB Atlas free tier for hosted DB

Example on Render:
1. Push repo to GitHub
2. New Web Service → Connect repo
3. Build: `npm install`
4. Start: `npm start`
5. Add env vars from Render dashboard
6. Deploy — get a public URL like `https://chipcost-api.onrender.com`

## Cost calculation reference

Every formula in `/calc/costEngine.js` maps to the playbook (Section 9):

- **Dies per wafer**: Bosch/de Vries — `(π × (D/2)²) / S − (π × D) / √(2 × S)`
- **Yield**: Poisson — `e^(-A × D0)` (A in cm²)
- **Cost per good die**: `waferCost / (DPW × yield × packagingYield)`
- **NRE**: Sum of mask + design labor + verification (1.5×) + IP + EDA + foundry fees + 15% contingency
- **Total project cost**: `NRE + volume × cpgdFull`
- **Break-even volume**: `NRE / (sellingPrice − cpgdFull)`

Self-test the engine: `npm run test:calc`
