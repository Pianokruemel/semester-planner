# Semester Planner

Code-first semester planning with anonymous PostgreSQL-backed plans and a public TUCaN lecture catalogue.

## Current Architecture

- PostgreSQL stores anonymous plans, categories, planned courses, appointments, exams, public catalogue courses, catalogue appointments, and scanner runs.
- The browser stores only `semester-planner:plan-id` plus local UI preferences such as dark mode and filters.
- The scanner scrapes public anonymous TUCaN Vorlesungsverzeichnis pages and ingests normalized catalogue data through the backend.
- The scanner also enriches the catalogue with module handbooks and central TU Prüfungsplan exam candidates.
- Plans can be shared read/write via an unguessable share token (`/plans/by-token/:token`); tokens can be rotated.

## Tech Stack

- Frontend: React + Vite + TypeScript (built to static assets, served by nginx in production)
- Backend: Node.js + Express + TypeScript + Prisma
- Shared package: TypeScript appointment parser
- Scanner: Node.js + TypeScript + Cheerio
- Database: PostgreSQL 16
- Orchestration: Docker Compose

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

`POSTGRES_PASSWORD` and `SCANNER_TOKEN` have no fallback in `docker-compose.yml` — compose
fails fast if they are unset. The copied `.env` provides development values for them; replace
those (and set `CORS_ORIGIN`) before any public deployment.

For local browser access (publishes the frontend on a host port):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Frontend: http://localhost:3000

The frontend image builds the app to static assets and serves them with nginx, which also
proxies `/api` to the backend. The backend runs `prisma migrate deploy` on boot and then the
compiled server. The scanner service fills an empty catalogue on its own startup.

## Production Deployment

```bash
cp .env.example .env   # then edit: strong POSTGRES_PASSWORD + SCANNER_TOKEN, CORS_ORIGIN, CF_TUNNEL_TOKEN
docker compose up -d --build
```

Public traffic reaches the stack through the `cloudflared` tunnel, which forwards to the
frontend (port 3000); TLS is terminated by Cloudflare.

Database schema is managed by Prisma migrations (`backend/prisma/migrations`). A fresh database
is created automatically by `prisma migrate deploy` on first backend boot. If you are upgrading a
database that was previously created with `prisma db push` (no migration history), baseline it
once so the initial migration is marked as already applied:

```bash
docker compose run --rm backend npx prisma migrate resolve --applied 0_init
```

## Local Development

```bash
npm install
npm run lint
npm run test
npm run build
```

Backend:

```bash
cd backend
npm run prisma:generate
npm run prisma:push
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Scanner:

```bash
cd scanner
npm run scan:once
npm run module-handbooks:once
```

## Environment Variables

- `POSTGRES_DB` default: `stundenplan`
- `POSTGRES_USER` default: `app`
- `POSTGRES_PASSWORD` **required** (no fallback) — set a strong value
- `SCANNER_TOKEN` **required** (no fallback) — set a strong value
- `CORS_ORIGIN` default: empty (reflects request origin); set to your public site for production
- `RATE_LIMIT_PER_MINUTE` default: `120` — API requests per minute per client IP (scanner ingest exempt)
- `VITE_API_URL` default: `/api` (baked into the frontend bundle at build time)
- `API_PROXY_TARGET` default: `http://backend:4000` (local `npm run dev` only)
- `ALLOWED_HOSTS` default: `semesti.plani.dev` (local `npm run dev` only)
- `CF_TUNNEL_TOKEN` default: empty
- `AUTO_START_SCANNER_ON_EMPTY_DB` default: `false` (the scanner service handles empty catalogues)
- `TUCAN_START_URL` default: stable public TUCaN welcome page used to discover the current semester and FB20 catalogue
- `TUCAN_RATE_LIMIT_MS` default: `750`
- `SCAN_INTERVAL_HOURS` default: `24`
- `MODULE_HANDBOOK_OVERVIEW_URL` default: FB20 study regulations and module handbook overview
- `EXAM_PLAN_OVERVIEW_URL` default: central TU Prüfungsplan page
- `TUCAN_FACULTY_PREFIX` default: `FB20 - Informatik`

## API Overview

Base URL for browser clients: `/api`

- `POST /plans`
- `GET /plans/:planId`
- `PATCH /plans/:planId`
- `GET|POST /plans/:planId/categories`
- `PATCH|DELETE /plans/:planId/categories/:categoryId`
- `GET|POST /plans/:planId/courses`
- `PATCH|DELETE /plans/:planId/courses/:courseId`
- `POST /plans/:planId/courses/import-catalog`
- `PUT|DELETE /plans/:planId/courses/:courseId/exam`
- `GET /catalog/health`
- `GET /catalog/semesters`
- `GET /catalog/courses`
- `GET /catalog/courses/:id`
- `POST /catalog/internal/ingest` with `x-scanner-token`

## TUCaN Import Format

```text
Nr\tDatum\tVon\tBis\tRaum\tLehrende
1\tMo, 13. Apr. 2026*\t08:55\t10:35\tS311/08\t...
2\tDi, 28. Apr. 2026\t09:50\t11:30\tS202/C205 - Bosch Hoersaal\t...
```

Rules:

- Header row is optional
- German month names are supported
- `*` controls lecture/tutorial type mapping
- The `Lehrende` column is ignored by the planner parser
- Markdown links in room cells are reduced to plain text

## Manual Verification Checklist

1. Create a new planner and confirm `plans` has a new row.
2. Confirm browser localStorage contains only `semester-planner:plan-id` and UI preferences.
3. Create categories and manual courses, then reload and confirm they load from PostgreSQL.
4. Paste representative TUCaN rows and verify appointment parsing matches the preview.
5. Run the scanner and confirm `/api/catalog/health` reports catalogue counts.
6. Search the catalogue in the frontend and import a course.
7. Confirm imported catalogue appointments are copied into `planned_appointments`.
8. Export ICS and confirm the file reflects the current visible planner state.

## Transparency Notice

This project was generated with AI assistance. Review and test before relying on it for important planning decisions.

## License

Licensed under MIT. See [LICENSE](LICENSE).
