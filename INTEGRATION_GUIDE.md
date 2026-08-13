# Full-Stack Integration Guide

You now have both frontend and backend. Here's how to connect them and run the whole stack.

## Setup order (30 minutes total)

### 1. Backend (10 min)

```bash
cd chipcost-server
npm install
cp .env.example .env

# Edit .env — add your Gemini API key
# Get one free at https://aistudio.google.com/apikey

# Start MongoDB (whatever your platform needs):
# macOS:   brew services start mongodb-community
# Linux:   sudo systemctl start mongod
# Windows: (auto-starts as service)

# Seed the AI knowledge base (~1 minute)
npm run seed

# Start API on port 5000
npm run dev
```

Backend is now running at http://localhost:5000

Verify: `curl http://localhost:5000/api/health` returns `{ "ok": true }`

### 2. Frontend (5 min)

Open a new terminal:

```bash
cd chipcost-nextjs
npm install
cp .env.local.example .env.local

# Edit .env.local — set:
#   NEXT_PUBLIC_USE_MOCK=false
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api

npm run dev
```

Frontend is now running at http://localhost:3000

### 3. Test end-to-end (5 min)

1. Open http://localhost:3000
2. You'll land on the Create Project page
3. Type a name → Create → routes to Inputs page
4. Adjust inputs → click "View Results" → routes to Output page
5. See Results tab (default) with real backend numbers
6. Click "Cost Charts" — see Recharts pulling from backend
7. Click "Cell Library Impact" — see the strategic reveal
8. Open the chat panel → ask "Why is my mask cost so high?" → real Gemini response with cited sources

## What happens under the hood

```
User types in browser
     ↓
Next.js frontend (localhost:3000)
     ↓ axios (with Bearer token)
Node.js API (localhost:5000)
     ├── Cost calculation (pure math)
     ├── MongoDB (localhost:27017) for projects/users
     └── AI Copilot:
          ├── Gemini embeddings for query
          ├── In-memory cosine search of knowledge base
          ├── Gemini LLM with retrieved context
          └── Response + source citations back to user
```

## Troubleshooting

### Frontend can't reach backend
- Check backend is running: `curl http://localhost:5000/api/health`
- Check `NEXT_PUBLIC_API_BASE_URL` in frontend `.env.local`
- Check CORS: backend should have `CLIENT_URL=http://localhost:3000` in `.env`
- Restart Next.js after changing env vars

### "Missing token" errors on project endpoints
- The frontend needs a JWT. Register or log in first.
- **Quick fix for hackathon**: The frontend uses a fallback if no token — you can add a mock token in `apiClient.js`, or use mock mode temporarily.
- **Proper fix**: Add a login page (see below).

### AI returns rule-based response instead of real Gemini reply
- Check `GEMINI_API_KEY` in backend `.env`
- Check backend logs for the error
- Rule-based fallback is intentional — it's the safety net

### MongoDB Compass shows empty database
- The database only appears after data is inserted
- Register a user via the API or run the seed script
- Check the collection names: `users`, `projects`, `conversations`, `costdatas`

## Missing frontend pieces (for a real production launch)

The current frontend assumes authentication. For a hackathon demo, you have two options:

### Option A — Add a real login page

Create `chipcost-nextjs/src/app/login/page.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(e) {
    e.preventDefault();
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`,
      { email, password }
    );
    localStorage.setItem('token', res.data.token);
    router.push('/create-project');
  }

  return (
    <form onSubmit={submit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

### Option B — Auto-create a demo user on first load

Add to `chipcost-nextjs/src/store/ReduxProvider.jsx`:

```jsx
'use client';
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import axios from 'axios';
import { store } from './index';

export default function ReduxProvider({ children }) {
  useEffect(() => {
    // Auto-login demo user for hackathon
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      const demo = { email: 'demo@chipcost.ai', password: 'demo1234' };
      // Try login, fall back to register
      axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, demo)
        .catch(() => axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register`, demo))
        .then(res => localStorage.setItem('token', res.data.token))
        .catch(err => console.error('Demo auth failed:', err));
    }
  }, []);
  return <Provider store={store}>{children}</Provider>;
}
```

This auto-creates a demo user on first page load — great for a hackathon demo.

## Deploying to public URLs

### Backend to Render
1. Push to GitHub
2. Render → New Web Service → connect repo
3. Environment: Node
4. Build: `npm install`
5. Start: `npm start`
6. Add env vars: `MONGODB_URI` (use MongoDB Atlas free tier), `JWT_SECRET`, `GEMINI_API_KEY`, `CLIENT_URL`

### Frontend to Vercel
1. Push to GitHub
2. Vercel → import repo
3. Add env vars: `NEXT_PUBLIC_API_BASE_URL=https://your-render-url.onrender.com/api`, `NEXT_PUBLIC_USE_MOCK=false`
4. Deploy

Now you have a public demo URL your judges can access from anywhere.

### MongoDB Atlas (free hosted DB)
1. https://cloud.mongodb.com — sign up
2. Create M0 free cluster
3. Whitelist `0.0.0.0/0` (hackathon simplicity)
4. Get connection string, add to backend `MONGODB_URI` env var
5. Re-run seed against Atlas: `MONGODB_URI="atlas-uri" npm run seed`

## Demo checklist (day of hackathon)

- [ ] Backend deployed and healthy
- [ ] Frontend deployed and pointing to backend
- [ ] MongoDB Atlas has seeded knowledge base
- [ ] Test the full flow: create → inputs → output → AI question
- [ ] Cell Library Impact shows a dramatic savings number
- [ ] Backup video recorded (in case live demo fails)
- [ ] Two devices ready as backups

Good luck!
