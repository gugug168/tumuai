# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript SPA (routes/pages in `src/pages/`, shared UI in `src/components/`, data/access in `src/lib/`, helpers in `src/utils/`).
- `api/`: Vercel Serverless Functions for `/api/*`.
- `tests/e2e/`: Playwright end-to-end tests.
- `scripts/`: build/prerender and maintenance scripts (e.g. prerender, screenshot refresh).
- `supabase/` + `database/`: SQL, indexes, and operational scripts.
- `public/`: static assets; `dist/` is build output.

## Build, Test, and Development Commands
- `npm ci`: install dependencies (preferred for CI/clean envs).
- `npm run dev`: start local dev server.
- `npm run build`: production build + prerender (`scripts/prerender-static.cjs`).
- `npm run preview`: serve `dist/` locally.
- `npm run lint`: run ESLint.
- `npm run test:e2e`: run Playwright E2E tests.
- `npm run db:indexes`: apply/verify DB indexes.

## Coding Style & Naming Conventions
- TypeScript-first; keep API boundaries typed and avoid `any` unless unavoidable.
- Components: `PascalCase` file/component names (e.g. `src/components/ToolCard.tsx`).
- Hooks: `useXxx` under `src/hooks/`.
- Tailwind: prefer small reusable components over repeating long class strings.

## Testing Guidelines
- E2E: Playwright tests live in `tests/e2e/` (`*.spec.ts`).
- Write tests for critical user flows (tools list, tool detail, submit/admin) and prefer resilient selectors (role/text over brittle DOM paths).

## Commit & Pull Request Guidelines
- Follow the repo’s existing Conventional-Commit style: `feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `chore:` (optional scope like `fix(tools): ...`).
- PRs should include: a short problem/solution summary, screenshots for UI changes, and verification commands run (e.g. `npm run build`).

## Security & Configuration Tips
- Client env vars must be `VITE_*`. Never ship `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Do not commit secrets (keep `.env.local` / tokens private). Update `.env.example` when adding required configuration.
