# Repository Guidelines

## Project Structure & Module Organization

- `apps/web/` contains the TanStack Start frontend, routes, UI components, and styles.
- `apps/api/` contains the Elysia backend, database client, Drizzle schema mirror, and routes.
- `packages/shared/` contains shared TypeScript types, enums, and business state-machine helpers.
- `supabase/migrations/` is the authoritative versioned SQL schema and RLS policy history; `supabase/seed.sql` holds development seed data.
- `data-science/` and `ai/` are separate Python workspaces; project documentation lives in `docs/`.

## Build, Test, and Development Commands

Use Bun for all JavaScript and TypeScript work. Run commands from the repository root:

```bash
bun install                 # Install all workspace dependencies
bun run dev                 # Start web on 3000 and API on 3001
bun run dev:web             # Start only the frontend
bun run dev:api             # Start only the API
bun run typecheck           # Typecheck web and API
bun --cwd apps/web run lint # Lint the frontend
bun --cwd apps/web run build # Build the frontend bundle
```

Run `bun --cwd apps/web run format` for Prettier and ESLint fixes, and `bun --cwd apps/web run check` to verify formatting.

## Coding Style & Naming Conventions

Follow the TypeScript formatting enforced by Prettier and ESLint. Use `PascalCase` for React components and classes, `camelCase` for functions and variables, and `kebab-case` for route or feature names where the surrounding directory uses it. Keep handlers thin, place shared rules in `packages/shared/` or the API layer, and never write frontend mutations directly to Supabase tables.

## Testing Guidelines

There is no committed automated test suite yet. Before opening a PR, run `bun run typecheck`, frontend linting, and the relevant build. The API `test` script is a placeholder, not a passing test. Add tests beside the feature or in a clearly named `tests/` directory when introducing a framework.

## Architecture, Database, and Configuration

Keep secrets in local `.env` files based on checked-in `.env.example` files. Never commit credentials. Add schema or RLS changes as numbered SQL migrations under `supabase/migrations/`; do not use `drizzle-kit push` or `drizzle-kit generate`. Determine `partner_id` server-side and preserve API authorization plus Supabase RLS.

## Commits and Pull Requests

Use Conventional Commits, such as `feat: add partner stock input`, `fix: validate JWT middleware`, or `docs: update setup guide`. Branches use `feat/<name>`, `fix/<name>`, or `chore/<name>`. Do not push directly to `main`. PRs should explain the change, link an issue when relevant, include UI screenshots, report validation commands, and request a teammate review.

<!-- antislop:start -->

## antislop

For UI, copy, people, mobile layout, or code comments work, read `antislop.md` (core) and then the skill for the task:

- UI / visual: `skills/antislop-ui/SKILL.md`
- Copy & text: `skills/antislop-copywriting/SKILL.md`
- People: `skills/antislop-human/SKILL.md`
- Mobile / responsive: `skills/antislop-layoutmobile/SKILL.md`
- Code comments: `skills/antislop-code/SKILL.md`

Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->
