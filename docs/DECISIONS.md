# Technical Decisions & Package Pin Log

Recorded: 2026-11-12

All package versions were verified directly against `registry.npmjs.org` (`dist-tags.latest` and `peerDependencies`) and checked with `pnpm peers check` (`No peer dependency issues found`). No canary, beta, RC, or experimental flags are used.

---

## 1. Pinned Package Versions (Phase 0 + Phase 1)

| Package                                                                 | Pinned Version                            | Why & Compatibility Notes                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                                                                  | `16.4.6`                                  | Latest stable Next.js 16; provides App Router, Route Handlers, `src/proxy.ts`, and `next/font`.                                                                                                                         |
| `react` / `react-dom`                                                   | `19.3.1`                                  | Latest stable React 19; matches peer ranges across Next, TanStack Query, Radix UI, and Better Auth.                                                                                                                     |
| `typescript`                                                            | `6.0.3`                                   | **Compatibility pin** (npm `latest` is `7.0.2`). `typescript-eslint@8.72.2` (via `eslint-config-next@16.4.6`) requires `typescript >=4.8.4 <6.1.0`, and `eslint-config-next` itself targets TypeScript 6.0.x.           |
| `@types/node`                                                           | `24.19.2`                                 | **Compatibility pin** (npm `latest` is `26.6.6`). Matches Node.js 24 LTS runtime (`v24.18.0` locally and Vercel Node 24) and satisfies `vitest@5.1.0` (`>=24.0.0`).                                                     |
| `pnpm`                                                                  | `12.18.0`                                 | Latest stable pnpm via Corepack. `pnpm-workspace.yaml` explicitly allows builds only for `esbuild` and denies `@prisma/client` / `better-sqlite3`.                                                                      |
| `tailwindcss` / `@tailwindcss/postcss`                                  | `4.3.5`                                   | Latest stable Tailwind CSS v4 with CSS-first `@theme` tokens.                                                                                                                                                           |
| `tw-animate-css`                                                        | `1.4.0`                                   | Latest stable animation utilities compatible with Tailwind v4.                                                                                                                                                          |
| `radix-ui`                                                              | `1.8.1`                                   | Latest unified Radix primitives package for accessible Dialogs, Tabs, Labels, and Popovers.                                                                                                                             |
| `vaul`                                                                  | `1.1.2`                                   | Latest stable drawer/bottom-sheet library for mobile-first sheets.                                                                                                                                                      |
| `sonner`                                                                | `2.0.8`                                   | Latest stable toast library supporting custom JSX toasts (used for undo and steam-wisp feedback).                                                                                                                       |
| `lucide-react` / `motion`                                               | `1.72.0` / `14.12.0`                      | Latest stable UI icon set and GPU-friendly (`transform`/`opacity`) animation library.                                                                                                                                   |
| `next-themes`                                                           | `0.4.6`                                   | Latest stable theme manager; injects pre-paint script to eliminate white flash on dark mode load.                                                                                                                       |
| `drizzle-orm` / `drizzle-kit`                                           | `0.45.4` / `0.31.11`                      | Latest stable Drizzle ORM & CLI; satisfies `better-auth@1.7.21` peer requirements (`drizzle-orm ^0.45.2`, `drizzle-kit >=0.31.4`).                                                                                      |
| `@neondatabase/serverless`                                              | `1.2.0`                                   | Latest stable Neon serverless driver supporting both HTTP fetch (`neon-http`) and WebSocket Pool (`neon-serverless`).                                                                                                   |
| `better-auth`                                                           | `1.7.21`                                  | Latest stable Better Auth; ships built-in CLI (`better-auth`) so deprecated `@better-auth/cli@1.4.21` is omitted. Includes `username`, `nextCookies`, `scrypt` hashing, and IP rate limiting.                           |
| `zod`                                                                   | `4.6.7`                                   | Latest stable Zod v4 shared between client forms and Route Handlers.                                                                                                                                                    |
| `@tanstack/react-query` (+ persist client/persister) / `idb-keyval`     | `5.107.1` / `6.3.0`                       | Latest stable client cache + IndexedDB persister for `<100 ms` tab switches and offline resilience.                                                                                                                     |
| `eslint` / `eslint-config-next` / `eslint-config-prettier` / `prettier` | `9.39.5` / `16.4.6` / `10.1.8` / `3.10.0` | **Compatibility pin:** `eslint@9.39.5` (official `maintenance` tag) satisfies `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react` inside `eslint-config-next@16.4.6`, which cap at ESLint `^9`. |
| `vitest` / `@playwright/test`                                           | `5.1.0` / `1.65.0`                        | Latest stable unit/component test runner and mobile viewport (`390×844`) E2E runner.                                                                                                                                    |
| `@vercel/analytics` / `@vercel/speed-insights`                          | `2.0.1` / `2.1.0`                         | Latest stable production performance and Web Vitals telemetry.                                                                                                                                                          |

---

## 2. Departures & Refinements from the Spec

1. **Neon Dual Drizzle Exports (`src/db/index.ts`):**
   - `db` uses `drizzle-orm/neon-http` for single-round-trip reads and `db.batch()` writes with zero WebSocket handshake overhead.
   - `dbPool` uses `drizzle-orm/neon-serverless` (`Pool` + `ws`) for interactive multi-step ACID transactions (such as visit logging + counter maintenance in Phase 4).
   - Both are lazily initialized via `Proxy` / factory so Next.js static build steps that do not query Postgres won't crash if `DATABASE_URL` isn't present during isolated lint/typecheck.
2. **Complete Cascade Deletes (`src/db/schema.ts`):**
   - Added `ON DELETE CASCADE` on `list_items.added_by` and `list_members.invited_by` (in addition to `user_restaurants`, `visits`, `lists`, `planned_visits`), ensuring user deletion cleanly cascades across all rows.
   - Added indexes on `list_items(user_restaurant_id)` and `list_items(list_id, position)`.
3. **Server-Side Invite Code Enforcement (`src/lib/auth.ts`):**
   - Enforced `SIGNUP_INVITE_CODE` inside Better Auth's `databaseHooks.user.create.before` hook (checking a header/body token via `context?.request`) rather than only in the `/join` UI, preventing direct API sign-up bypasses when an invite code is configured.
4. **Placeholder Email Synthesis (`<username>@users.invalid`):**
   - Better Auth's email-and-password provider requires an `email` field. The `/join` client flow and server normalization generate `<normalizedUsername>@users.invalid` automatically so users only ever enter Name, Username, and Password.
5. **App-Group Layout Isolation (`src/app/(app)/layout.tsx`):**
   - Authenticated navigation shell (bottom tab bar, desktop sidebar, and the future persistent Google Map in Phase 6) lives in `(app)/layout.tsx`, keeping public routes (`/`, `/join`, `/signin`, `/terms`, `/privacy`) ultra-light and ensuring signed-out visitors never trigger a Google Maps JS load.
6. **Dropped Deprecated `@better-auth/cli`:**
   - Removed `@better-auth/cli@1.4.21` (deprecated) and used the built-in `better-auth` binary bundled in `better-auth@1.7.21`.
