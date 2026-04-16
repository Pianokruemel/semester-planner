# Semester Planner

Local full-stack web app for planning university courses and appointments.

This repository is public and intended for local use, learning, and extension by others.

## Transparency Notice

This project was generated with AI assistance.

- The implementation was produced primarily from AI-generated output.
- Please review and test before relying on it for important planning decisions.
- Full notice: [DISCLAIMER.md](DISCLAIMER.md)

## Features

- Calendar views: week, day, month
- Course CRUD with category assignment and CP values
- Appointment import from tabular TUCaN text format
- Live parse preview before saving courses
- Category CRUD with safe delete confirmation flow
- Filtering by active courses, CP, appointment type, and display options
- Settings persistence (dark mode, full name toggle, active filters)
- Data export/import:
  - ICS export for filtered appointments
  - JSON full export/import (including persisted settings)
- Calendar and edit form use consistent 24h wall-clock times (DST-safe display)
- Dockerized local deployment (frontend, backend, PostgreSQL)

## Tech Stack

- Frontend: React + Vite + TypeScript + react-big-calendar
- Backend: Node.js + Express + TypeScript + Prisma
- Database: PostgreSQL 16
- Orchestration: Docker Compose

## Architecture

The app runs with 3 services:

- `frontend` on port `3000`
- `backend` on port `4000`
- `db` (PostgreSQL) on port `5432`

The backend startup path inside Docker is deterministic:

1. `prisma db push`
2. `npm run seed`
3. `npm run dev`

This ensures the schema and default rows exist before requests are served.

## Architecture Visual

```mermaid
flowchart LR
  User[User Browser] --> FE[Frontend\nReact + Vite\n:3000]
  FE -->|HTTP /api| BE[Backend API\nExpress + Prisma\n:4000]
  BE -->|SQL| DB[(PostgreSQL 16\n:5432)]

  FE -. build .-> Vite[Vite Build]
  BE -. startup .-> Init[prisma db push\nseed\nstart dev server]
```

## UI Preview

![Semester Planner Calendar View](images/semester-planner-screenshot.jpeg)

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for non-Docker local development)
- npm

## Quick Start (Docker)

From project root:

Optional: copy the root `.env.example` to `.env` and adjust local defaults:

```bash
cp .env.example .env
```

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api

Check service logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

Stop services:

```bash
docker compose down
```

Full reset (including database volume):

```bash
docker compose down -v
```

## Local Development (without Docker)

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npx prisma db push
npm run seed
npm run dev
```

If you have migration files later, you can replace `npx prisma db push` with `npm run prisma:deploy`.

Backend runs on `http://localhost:4000`.

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Environment Variables

### Backend (`backend/.env`)

- `POSTGRES_DB` (default: `stundenplan`)
- `POSTGRES_USER` (default: `app`)
- `POSTGRES_PASSWORD` (default: `appsecret`)
- `DATABASE_URL` (example: `postgres://app:appsecret@localhost:5432/stundenplan`)
- `PORT` (default: `4000`)

### Frontend (`frontend/.env`)

- `VITE_API_URL` (default: `http://localhost:4000/api`)

## Useful Commands

### Backend

```bash
cd backend
npm run dev
npm run lint
npm run test
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run seed
```

### Frontend

```bash
cd frontend
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

## TUCaN Import Format

The parser expects row-based, tabular input (one appointment per row), for example:

```text
Nr\tDatum\tVon\tBis\tRaum\tLehrende
1\tMo, 13. Apr. 2026*\t08:55\t10:35\tS311/08\t...
2\tDi, 28. Apr. 2026\t09:50\t11:30\tS202/C205 - Bosch Hoersaal\t...
```

Rules:

- Header row is optional
- Date supports German month names (`Jan.`, `Feb.`, `Mär.`, ...)
- Asterisk (`*`) drives lecture/tutorial type mapping
- `Lehrende` column is ignored
- Room markdown links are normalized to plain text

## API Overview

Base URL: `http://localhost:4000/api`

- `GET /courses`
- `POST /courses`
- `POST /courses/preview`
- `PUT /courses/:id`
- `DELETE /courses/:id`
- `PATCH /courses/:id/toggle`
- `GET /categories`
- `POST /categories`
- `PUT /categories/:id`
- `DELETE /categories/:id`
- `GET /settings`
- `PUT /settings`
- `GET /export/json`
- `POST /import/json`
- `GET /export/ics`

## Troubleshooting

### Backend errors: table does not exist (`P2021`)

Cause: database not initialized yet.

Fix:

```bash
docker compose down -v
docker compose up --build
```

Then verify:

```bash
curl http://localhost:4000/api/settings
curl http://localhost:4000/api/categories
```

### Frontend cannot reach backend

- Check `VITE_API_URL`
- Ensure backend is running on port `4000`
- Inspect browser network tab and backend logs

### Import parse fails

- Confirm tabular format and valid `HH:MM` times
- Confirm German month tokens are valid
- Check preview error message in course form

### Timezone and daylight saving time (DST)

- Imported appointment times are treated as local wall-clock times (for example, `09:00` stays `09:00` in the app UI).
- Calendar rendering uses a DST-safe reconstruction so the hour shown in calendar matches the hour shown in the edit form.
- ICS export is generated with local wall-clock timestamps (without forced `Z` UTC suffix) to avoid unintended hour shifts in calendar clients.

Quick validation:

```bash
curl -s http://localhost:4000/api/export/ics | head -n 25
```

Expected:

- `DTSTART`/`DTEND` lines should not end with `Z`.
- A time entered as `09:00` in course data should appear as `09:00` in the app calendar and in the exported ICS event time.

## Current Project Status

Implemented:

- Core CRUD and calendar workflows
- Row-based TUCaN parser with preview
- Dockerized startup with schema sync and seed
- Export/import and settings persistence

Still good next steps:

- Add parser regression tests with real samples
- Add end-to-end smoke script
- Continue UX polish and component extraction

## Community and Contribution

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Repository Files

- `docker-compose.yml`
- `.env.example`
- `backend/`
- `frontend/`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `DISCLAIMER.md`
- `design_document_semester_planner.md`

## License

Licensed under MIT. See [LICENSE](LICENSE).

MIT allows use, modification, distribution, and commercial use.
