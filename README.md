# Semester Planner

Code-first semester planning with anonymous encrypted share snapshots. The browser owns planner data, parsing, export, encryption, and decryption; the backend stores only ciphertext plus minimal metadata.

This repository is public and intended for local use, learning, and extension by others.

## Transparency Notice

This project was generated with AI assistance.

- The implementation was produced primarily from AI-generated output.
- Please review and test before relying on it for important planning decisions.
- Full notice: [DISCLAIMER.md](DISCLAIMER.md)

## What Changed

The public runtime is now encrypted-only:

- The frontend creates, edits, filters, parses, encrypts, decrypts, and exports planner data locally.
- The backend exposes only share snapshot endpoints and stores only ciphertext, nonce, version metadata, parent linkage, and a hashed locator.
- There is no server-owned plaintext planner mode, no shared settings table, and no backend CRUD for courses or categories.

## Features

- Code-first entry flow: create a new planner, open an existing code, or resume a local draft
- Local planner editing for categories, courses, appointments, and active course selection
- Local TUCaN parsing with live preview before saving a course
- Local ICS export from decrypted planner state
- Immutable share snapshots with explicit Create code and Extend code actions
- Device-local UI preferences for dark mode, full-name display, and calendar filters
- Dockerized deployment with frontend, backend, and PostgreSQL

## Privacy Model

### Shared in the encrypted snapshot

- Categories
- Courses
- Appointments
- `is_active` per course

### Kept device-local only

- `dark_mode`
- `show_full_name`
- `active_filters`
- Any future local display preferences

### Server never stores in plaintext

- Course names and abbreviations
- Appointment dates, times, rooms, or types
- Category names or colors
- Active course selection
- UI preferences

## Threat Model and Limits

- The server can see that a snapshot exists and can store or delete ciphertext, but it cannot decrypt planner contents without the full eight-word code.
- Snapshot lookup is derived from the full code, and the database stores only a hash of that locator.
- Anyone who has the full code can open the snapshot.
- If the code is lost, the snapshot is unrecoverable by design.
- There is no account system, password reset flow, or server-side recovery path.
- Extending a share creates a fresh immutable snapshot with a new code; the old code remains valid for the old snapshot.

## Tech Stack

- Frontend: React + Vite + TypeScript + react-big-calendar
- Backend: Node.js + Express + TypeScript + Prisma
- Database: PostgreSQL 16
- Orchestration: Docker Compose

## Architecture

The app runs with 3 services:

- `frontend` on port `3000`
- `backend` on port `4000`
- `db` on port `5432`

```mermaid
flowchart LR
  User[User Browser] --> FE[Frontend\nReact + Vite\n:3000]
  FE -->|POST /api/shares| BE[Backend API\nExpress + Prisma\n:4000]
  FE -->|GET /api/shares/:locator| BE
  BE -->|ciphertext only| DB[(PostgreSQL 16\nshare_snapshots)]

  FE -. local only .-> Parse[TUCaN Parser]
  FE -. local only .-> Crypto[AES-GCM + PBKDF2]
  FE -. local only .-> Export[ICS Export]
```

## UI Preview

![Semester Planner Calendar View](images/semester-planner-screenshot.jpeg)

## Prerequisites

- Docker + Docker Compose
- Node.js 20+
- npm

## Quick Start (Docker)

From project root:

```bash
cp .env.example .env
docker compose up -d --build
```

This default compose mode keeps the frontend internal to the Docker network and starts `cloudflared`.

- Set `CF_TUNNEL_TOKEN` in `.env` before starting it.
- The frontend stays reachable to other containers as `frontend:3000` on the shared `planner` network.

For a local browser-accessible dev run, use the override file:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

If you want the dev port exposure and `cloudflared` together, add the tunnel profile:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile tunnel up -d --build
```

In that dev mode:

- Frontend: http://localhost:3000
- Browser API path: http://localhost:3000/api

Backend and database stay internal to the shared Docker network. Containers reach them as `backend:4000` and `db:5432`.

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

Full reset, including snapshot storage:

```bash
docker compose down -v
```

If you change `POSTGRES_USER` or `POSTGRES_PASSWORD`, run the full reset first. PostgreSQL only applies those credentials when the `pgdata` volume is initialized, so an existing volume can keep the old password even after Compose env values change.

## Local Development

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npx prisma db push
npm run dev
```

Backend runs on `http://localhost:4000`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Environment Variables

### Docker Compose (`.env` in project root)

- `POSTGRES_DB` default: `stundenplan`
- `POSTGRES_USER` default: `app`
- `POSTGRES_PASSWORD` default: `appsecret`
- Backend Docker startup assembles `DATABASE_URL` from those values at runtime, so passwords with URL-reserved characters like `@` or `:` stay valid for Prisma.
- `VITE_API_URL` default: `/api`
- `API_PROXY_TARGET` default: `http://backend:4000`
- `ALLOWED_HOSTS` default: `semesti.plani.dev` (comma-separated Vite dev-server host allowlist for tunnel or reverse-proxy domains)
- `CF_TUNNEL_TOKEN` default: empty, required for the default tunnel-enabled compose mode

### Backend (`backend/.env`)

- `POSTGRES_DB` default: `stundenplan`
- `POSTGRES_USER` default: `app`
- `POSTGRES_PASSWORD` default: `appsecret`
- `DATABASE_URL` example: `postgres://app:appsecret@localhost:5432/stundenplan`
- `PORT` default: `4000`

### Frontend (`frontend/.env`)

- `VITE_API_URL` default: `/api`
- `API_PROXY_TARGET` default: `http://localhost:4000`
- `ALLOWED_HOSTS` default: `semesti.plani.dev` (comma-separated additional hostnames Vite should accept)

## API Overview

Base URL for browser clients: `/api`

- Docker Compose dev override publishes it at `http://localhost:3000/api` via the frontend proxy.
- Standalone backend development still serves it directly at `http://localhost:4000/api`.

- `POST /shares` creates an encrypted snapshot envelope
- `GET /shares/:locator` fetches an encrypted snapshot envelope
- `GET /health` returns backend health status

`POST /shares` accepts only:

- `locator`
- `ciphertext`
- `nonce`
- `payload_version`
- `crypto_version`
- optional `parent_snapshot_id`

`GET /shares/:locator` returns only the encrypted envelope and metadata. It never returns plaintext planner data.

## TUCaN Import Format

The local parser expects row-based tabular input, one appointment per row.

```text
Nr\tDatum\tVon\tBis\tRaum\tLehrende
1\tMo, 13. Apr. 2026*\t08:55\t10:35\tS311/08\t...
2\tDi, 28. Apr. 2026\t09:50\t11:30\tS202/C205 - Bosch Hoersaal\t...
```

Rules:

- Header row is optional
- German month names are supported
- `*` controls lecture/tutorial type mapping
- The `Lehrende` column is ignored
- Markdown links in room cells are reduced to plain text

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

## Manual Verification Checklist

1. Create a new planner, add categories and courses, and confirm they stay local until a code is created.
2. Create a code, reload the app, open the code again, and confirm the decrypted planner matches the pre-save state.
3. Inspect the network and database to confirm only locator metadata, nonce, versions, and ciphertext are stored server-side.
4. Open an existing code, make a change, use Extend code, and verify the old code still opens the old snapshot while the new code opens the updated state.
5. Paste representative TUCaN input and verify the local preview and saved appointments match expectations.
6. Export ICS and confirm the file reflects the current decrypted planner state.

## Troubleshooting

### Frontend cannot reach backend

- Check `VITE_API_URL`
- In Docker Compose, ensure `API_PROXY_TARGET` points to `http://backend:4000`
- In local frontend development, ensure the backend is running on `http://localhost:4000`
- Inspect the browser network tab plus frontend and backend logs

### A code cannot be opened

- Confirm all eight words are present
- Confirm the code words were copied exactly
- Remember that lost codes cannot be recovered

### Database errors after schema changes

```bash
docker compose down -v
docker compose up --build
```

or locally:

```bash
cd backend
npx prisma db push --force-reset
```

### Timezone and daylight saving time

- Imported appointment times are treated as local wall-clock times.
- Calendar rendering reconstructs local times from the stored date plus `HH:MM` values.
- ICS export is generated locally without forcing UTC conversion so calendar clients keep the intended wall-clock hour.

Quick validation:

- Export an ICS file from the frontend and inspect the generated file contents.

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
