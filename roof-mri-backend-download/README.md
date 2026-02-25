# Roof MRI Proposal Backend

This is the backend server that powers the Roof MRI proposal system. It does three things:

1. **Saves proposals** to a database so you can look back at them anytime
2. **Sends branded emails** to clients via SendGrid with a link to their proposal
3. **Tracks opens and signatures** so you know when a client looks at or signs their proposal

---

## How to Deploy to Render

### Step 1: Push this folder to GitHub

Create a new repo on GitHub (call it `roof-mri-backend` or whatever you want), then push these files to it.

### Step 2: Create a PostgreSQL database on Render

1. Log into [render.com](https://render.com)
2. Click **New +** at the top right
3. Click **PostgreSQL**
4. Name it something like `roof-mri-db`
5. Pick your plan (free tier works to start)
6. Click **Create Database**
7. Once it's created, find the **Internal Database URL** on the database page and copy it. You'll need it in Step 4.

### Step 3: Create a Web Service on Render

1. Click **New +** again, then **Web Service**
2. Connect your GitHub account if you haven't already
3. Find and select your `roof-mri-backend` repo
4. Render will detect it's Node.js automatically
5. Set **Build Command** to: `npm install`
6. Set **Start Command** to: `npm start`
7. Pick your plan

### Step 4: Add your settings (Environment Variables)

On the Web Service page, go to the **Environment** tab. Click **Add Environment Variable** and add these three:

| Key | What to put |
|-----|-------------|
| `SENDGRID_API_KEY` | Your SendGrid API key (starts with `SG.`) |
| `DATABASE_URL` | The Internal Database URL you copied in Step 2 |
| `PROPOSAL_BASE_URL` | Your Netlify site URL (like `https://roof-mri.netlify.app`) |

That's it. These are just settings your app needs to run. Render keeps them private and secure.

### Step 5: Deploy

Click **Manual Deploy** > **Deploy latest commit**. Render will install everything and start your server. You'll get a URL like `https://roof-mri-backend.onrender.com`.

Test it by visiting `https://your-render-url.onrender.com/health` in your browser. You should see `{"status":"ok"}`.

---

## What's in here

- `server.js` - The actual server code (handles emails, database, API)
- `package.json` - Lists the packages the server needs
- `.env.example` - Shows what settings you need (for reference only)
- `.gitignore` - Tells Git to ignore private files

---

## API Endpoints

| Endpoint | What it does |
|----------|-------------|
| `POST /api/send-proposal` | Saves a proposal and emails it to the client |
| `GET /api/proposals/:id` | Gets a single proposal (used by the client's proposal page) |
| `POST /api/proposals/:id/sign` | Records a client's signature |
| `GET /api/proposals` | Lists all proposals (for your internal dashboard) |
| `GET /health` | Quick check that the server is running |
