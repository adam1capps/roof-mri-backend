#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Roof MRI Frontend → Deploy to GitHub
# Run this on YOUR local machine after cloning the backend repo
# ─────────────────────────────────────────────────────────────

set -e

echo "🏗️  Setting up roof-mri-frontend..."

# 1. Clone the frontend repo (or use existing)
if [ -d "../roof-mri-frontend" ]; then
  echo "→ Found existing roof-mri-frontend directory"
  cd ../roof-mri-frontend
  git checkout main
else
  echo "→ Cloning roof-mri-frontend..."
  cd ..
  git clone https://github.com/adam1capps/roof-mri-frontend.git
  cd roof-mri-frontend
fi

# 2. Remove any placeholder files
rm -f main

# 3. Copy all frontend files from the backend repo
echo "→ Copying frontend files..."
cp -r ../roof-mri-backend/frontend-build/* .
cp ../roof-mri-backend/frontend-build/.gitignore .
cp ../roof-mri-backend/frontend-build/.env.example .

# 4. Install dependencies
echo "→ Installing dependencies..."
npm install

# 5. Verify build works
echo "→ Building..."
npm run build

# 6. Commit and push
echo "→ Committing and pushing..."
git add -A
git commit -m "Build complete Roof MRI frontend (React + Vite)

- Proposal page at /p/:id with full API integration
- Signature pad for clients to sign proposals
- Pay Now button → Stripe Checkout redirect
- Payment success confirmation with polling
- Vimeo video embed
- Netlify config with SPA routing
- Brand-matched styling"

git push origin main

echo ""
echo "✅ Done! Frontend pushed to GitHub."
echo ""
echo "Next steps:"
echo "  1. Go to Netlify → connect the roof-mri-frontend repo"
echo "  2. Add environment variable: VITE_API_URL = https://roof-mri-backend.onrender.com"
echo "  3. Deploy!"
