# Semester Planner

Code-first semester planning with anonymous PostgreSQL-backed plans and a public TUCaN lecture catalogue.

## Current Architecture

- PostgreSQL stores anonymous plans, categories, planned courses, appointments, exams, public catalogue courses, catalogue appointments, and scanner runs.
- The browser stores only `semester-planner:plan-id` plus local UI preferences such as dark mode and filters.
- The scanner scrapes public anonymous TUCaN Vorlesungsverzeichnis pages and ingests normalized catalogue data through the backend.
- Public sharing is intentionally not implemented in this version.
- Inferno is not used.

## Tech Stack

- Frontend: React + Vite + TypeScript + react-big-calendar
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

For local browser access:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Frontend: http://localhost:3000

Run the optional scanner:

```bash
docker compose --profile scanner up -d --build
```

On normal backend boot, an empty catalogue automatically starts a one-shot scanner run.

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
```

## Environment Variables

- `POSTGRES_DB` default: `stundenplan`
- `POSTGRES_USER` default: `app`
- `POSTGRES_PASSWORD` default: `appsecret`
- `VITE_API_URL` default: `/api`
- `API_PROXY_TARGET` default: `http://backend:4000`
- `ALLOWED_HOSTS` default: `semesti.plani.dev`
- `CF_TUNNEL_TOKEN` default: empty
- `SCANNER_TOKEN` default: `changeme-dev-scanner-token`
- `AUTO_START_SCANNER_ON_EMPTY_DB` default: `true`
- `TUCAN_START_URL` default: current public FB20 catalogue entry URL
- `TUCAN_RATE_LIMIT_MS` default: `750`
- `SCAN_INTERVAL_HOURS` default: `24`
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
