# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Daisuki B2B Inventory & Order Management System is a multi-tenant platform for Daisuki central administration and partner branches (hotels, restaurants, cafes, minimarkets). It solves stock visibility, late restock cycles, and factory lead time coordination.

The codebase is organized as a Bun monorepo comprising a web frontend, backend API, shared TypeScript package, database migrations, and Python-based data science and AI workspaces.

---

## Development Commands

### Package Manager
- **Strictly use [Bun](https://bun.sh/)** for all JS/TS operations. Do **not** use `npm`, `yarn`, or `pnpm` (they corrupt [bun.lock](bun.lock) and workspace symlinks).

### Common Commands (Root)
- Install all workspace dependencies:
  ```bash
  bun install
  ```
- Run web frontend (port 3000) and API server (port 3001) concurrently:
  ```bash
  bun run dev
  ```
- Run only the frontend:
  ```bash
  bun run dev:web
  ```
- Run only the backend API:
  ```bash
  bun run dev:api
  ```
- Run TypeScript typecheck across all workspaces:
  ```bash
  bun run typecheck
  ```

### Frontend ([apps/web/](apps/web/))
- Typecheck:
  ```bash
  bun --cwd apps/web run typecheck
  ```
- Linting:
  ```bash
  bun --cwd apps/web run lint
  ```
- Formatting & ESLint auto-fix:
  ```bash
  bun --cwd apps/web run format
  bun --cwd apps/web run check
  ```
- Build production bundle (Vite + Cloudflare):
  ```bash
  bun --cwd apps/web run build
  ```
- Regenerate TanStack router tree:
  ```bash
  bun --cwd apps/web run generate-routes
  ```
- Add a new Shadcn UI component (run inside [apps/web/](apps/web/)):
  ```bash
  bunx --bun shadcn@latest add <component-name>
  ```

### Backend API ([apps/api/](apps/api/))
- Dev server with watch mode:
  ```bash
  bun --cwd apps/api run dev
  ```
- Start production server:
  ```bash
  bun --cwd apps/api run start
  ```
- Typecheck:
  ```bash
  bun --cwd apps/api run typecheck
  ```

### Python Workspaces ([data-science/](data-science/) & [ai/](ai/))
Both workspaces use Python virtual environments. PowerShell setup:
```powershell
cd data-science  # or cd ai
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## High-Level Architecture & Structure

```text
daisuki-inventory/
├── apps/
│   ├── web/           # Frontend: TanStack Start (React 19, Tailwind v4, Vite, Cloudflare)
│   └── api/           # Backend: ElysiaJS, Bun runtime, Drizzle ORM, Jose JWT
├── packages/
│   └── shared/        # Shared package (@daisuki/shared): enums, types, state machines
├── data-science/      # Python workspace: EDA, ROP/safety stock modeling, synthetic data
├── ai/                # Python workspace: batch restock jobs, LLM assistant, Telegram bot
├── neon/
│   └── init.sql       # Authoritative unified SQL schema, constraints, roles, and seed data for Neon DB
└── docs/
    └── ALUR_SISTEM_DAN_ROLE.md # Comprehensive system workflow, role guide, and business rules
```

### Core Architecture Rules

1. **Strict Mutation Boundary**:
   - The frontend **never writes directly** to database tables.
   - All mutations (stock adjustments, restock orders, status updates, approvals) **must** go through the Elysia backend API to ensure business validation and database transactions are centralized.
   - The frontend reads data via Elysia endpoints and client state cache (TanStack Query).

2. **End-to-End Type Safety**:
   - The Elysia app export `type App = typeof app` in [apps/api/src/index.ts](apps/api/src/index.ts) is imported directly by [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts) via `@elysiajs/eden` (`treaty<App>(...)`).
   - Token authentication is handled automatically in the treaty `onRequest` hook using the JWT bearer token stored in localStorage (`daisuki_token`).

3. **Multi-Tenancy & Authorization**:
   - Two main roles: `admin` and `mitra`. Role and tenant linkage are in the `users` table (`role`, `partner_id`).
   - `partner_id` **must always be determined server-side** from the authenticated user's JWT payload in Elysia. Never accept `partner_id` blindly from a client request body.
   - Partner data isolation is enforced at Elysia route guards and schema constraints.

4. **Database & ORM Guidelines**:
   - **Source of Truth**: The unified SQL file in [neon/init.sql](neon/init.sql) is the authoritative database schema and initial seed source of truth.
   - [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts) mirrors the database schema using Drizzle ORM for query building.
   - **Do not run `drizzle-kit push` or `drizzle-kit generate`**.
   - **Neon DB Connection Pooler**: Neon pooled connections work seamlessly with `{ prepare: false }` in [apps/api/src/db/client.ts](apps/api/src/db/client.ts).
   - **Concurrency Safety**: Stock updates in Elysia must wrap operations in transactions and use `SELECT ... FOR UPDATE` row locks to prevent race conditions when writing to `partner_stocks` and `stock_logs`.

5. **Shared Business Logic ([packages/shared/src/index.ts](packages/shared/src/index.ts))**:
   - **Unbounded Partner Stock**: No maximum stock per product, category, or branch. Never use 40 pcs or any other fixed ceiling for stock reports or restock requests. In Admin and Mitra UI, show stock as `{current_qty} pcs` or `Sisa Stok`, without `/40`, `/par`, or `Sisa Stok / Par`. Do not call a branch's stock ceiling `Kapasitas Rak` or `Max Stock`; use `Sisa Stok`, `Buffer Minimal`, or `Saran Pasokan` as appropriate. `par_level` and status thresholds are safety buffers and demand signals, never capacity caps. Restock requests are limited only by `products.central_stock` at transaction time.
   - **Stock Status**: Calculated relative to buffer thresholds:
     - `aman`: > 50%
     - `waspada`: > 20% to 50%
     - `kritis`: <= 20%
     - Stale: `updated_at` older than 24 hours (`isStale()`).
   - **Order State Machine**:
     - Statuses: `diproses` → `disetujui` (or `ditolak` / `dibatalkan`) → `dalam_pengiriman` → `selesai`.
     - Validated using `canTransition(from, to)`.
     - Stock quantities increase only when the partner confirms delivery (`dalam_pengiriman` → `selesai`).

6. **Data Science & AI Integration**:
   - DB Roles: Tim Data Science uses `ds_readonly` (read-only access to core tables), and AI jobs use `ai_job` (read tables, write to `restock_recommendations`). Neither role may use service role keys.
   - AI Assistant operates strictly read-only against Elysia API endpoints (no direct arbitrary SQL execution).

7. **Design System & UI Conventions**:
   - Fonts: Heading and major numerical displays use `Bricolage Grotesque` (`--font-display` / `.font-display`). Body and form elements use `Figtree` (`--font-sans` / `.font-sans`).
   - Tabular Numbers: All stock quantities, prices, and metrics must use `.num` (`tabular-nums`) to maintain vertical alignment.
   - Stock Status Colors: Defined in [apps/web/src/styles.css](apps/web/src/styles.css) as semantic tokens (`--color-ok`, `--color-warn`, `--color-crit`, `--color-stale` and their fg/bg variants).
   - Brand Accent: `Ume` (`#b83a6a`) is reserved for branding, login headers, and illustrations; never use it for buttons or status chips to avoid confusion with critical red.
   - Touch Accessibility: Partner portal is optimized for mobile with touch targets of at least 44px.
