# Taste

## Deployment & CI
- Wants deployment of all Workers to be handled by a single CI pipeline triggered by any push to the main branch, with parallel jobs per Worker and no path filters — so `git add . && git commit && git push` redeploys everything (even unchanged apps) and no manual per-app `wrangler deploy` commands are needed. Confidence: 0.8
- Wants a hard code-check gate in CI before any Worker is deployed (install with frozen lockfile, typecheck, lint, build/syntax checks must pass; deploy jobs depend on the gate), and wants that gate actually executed locally as proof before the work is reported as finished. Confidence: 0.7

## Diagrams & Flow Specs
- When he supplies his own flowchart (e.g. a Mermaid TD diagram) for a system flow, wants the implementation/diagram to reproduce it faithfully and in full detail — node-for-node including side branches and failure paths — rather than a simplified or generic approximation of the flow. Confidence: 0.6
- When the local and production paths genuinely differ (e.g. local spawns Python directly and writes `daisuki.pkl`, production goes through GitHub Actions + JSON export + Cloudflare KV), wants each depicted as its own separate view of the graph — selectable per environment and matching that environment's actual code path — instead of one shared/merged flow diagram. Confidence: 0.6

## Data & Demo Seeding
- Prefers demo/synthetic data to be produced by actually writing varied rows into the database (seed script + applied DB run) rather than altering application code or hardcoding static values to shape what the UI shows. Confidence: 0.85
