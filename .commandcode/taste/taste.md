# Taste

## Deployment & CI
- Wants deployment of all Workers to be handled by a single CI pipeline triggered by any push to the main branch, with parallel jobs per Worker and no path filters — so `git add . && git commit && git push` redeploys everything (even unchanged apps) and no manual per-app `wrangler deploy` commands are needed. Confidence: 0.8

## Data & Demo Seeding
- Prefers demo/synthetic data to be produced by actually writing varied rows into the database (seed script + applied DB run) rather than altering application code or hardcoding static values to shape what the UI shows. Confidence: 0.85
