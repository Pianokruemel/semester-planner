You are working in the repository `Pianokruemel/semester-planner`.

Goal:
Perform a major architecture migration. The app no longer needs the encrypted share snapshot/privacy architecture. Lecture dates are public, so PostgreSQL should become the source of truth for planner data and for a global public lecture catalogue scraped from the public TUCaN Vorlesungsverzeichnis.

High-level target architecture:
- PostgreSQL stores:
  1. Public catalogue courses scraped from TUCaN.
  2. Public catalogue appointments scraped from TUCaN.
  3. User plans.
  4. User plan categories.
  5. User-selected/planned courses.
  6. User planned course appointments.
  7. User exams.
- The frontend should no longer own the authoritative planner state.
- The browser should only store the current anonymous `planId` in localStorage.
- Sharing/encryption/eight-word-code logic can be removed entirely for now.
- A future public sharing mechanism will be built later, but do not implement it in this change.

Important current-state facts:
- Backend already uses Node.js + Express + Prisma + PostgreSQL.
- Docker Compose already has `frontend`, `backend`, and `db`.
- The current Prisma schema only models encrypted share snapshots.
- The current frontend planner state lives locally in `frontend/src/planner/store.tsx`.
- The current course appointment parser lives in `frontend/src/planner/appointmentParser.ts`.
- Keep the existing lecture date parsing behavior exactly.

Hard requirements:
1. Remove the encrypted share snapshot architecture.
2. Remove share code generation, share opening, share extension, encrypted snapshot API calls, ciphertext envelope types, and share UI.
3. Do not preserve the old privacy model.
4. PostgreSQL should store normal plaintext app data.
5. Keep localStorage only for:
   - current anonymous `planId`
   - purely local UI preferences if convenient, such as dark mode
6. Preserve the existing TUCaN appointment parsing semantics.
7. Add a scanner container that scrapes public TUCaN lecture data and inserts it into PostgreSQL.
8. Use the scraping strategy from `drcicero/beautiful-tucan`, but implement it cleanly in TypeScript.
9. Do not use Inferno. It no longer exists.
10. Treat TUCaN `ARGUMENTS` values as opaque. Follow generated links; do not decode or brute-force them.

A. Refactor the appointment parser into shared code
Create a shared TypeScript module that can be used by frontend, backend tests, and scanner.

Recommended location:
- `packages/shared/src/appointmentParser.ts`
- or another clean shared package if the repo already has a better convention.

Move/refactor the logic from:
- `frontend/src/planner/appointmentParser.ts`

Keep these exports:
- `parseAppointments(rawText: string)`
- `summarizeAppointments(rawText: string)`
- `formatAppointmentsForTextarea(appointments)`

Keep behavior compatible with the current parser:
- German month names.
- Optional header row.
- Tab-separated or whitespace-separated TUCaN rows.
- Format:
  `Nr\tDatum\tVon\tBis\tRaum\tLehrende`
- Markdown links in room cells reduce to plain room text.
- `*` on date controls `Vorlesung`/`Uebung` mapping.
- If any row has `*`, starred rows are `Vorlesung`, unstarred rows are `Uebung`.
- If no row has `*`, all rows are `Vorlesung`.

Add parser regression tests using representative TUCaN rows.

B. Redesign Prisma schema
Refactor `backend/prisma/schema.prisma`.

Remove the old encrypted `ShareSnapshot` model unless another part of the code still needs it during migration. The final application should not use it.

Add these models:

1. Plan

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `name String @default("Mein Stundenplan")`
- `createdAt DateTime @default(now()) @map("created_at")`
- `updatedAt DateTime @updatedAt @map("updated_at")`
- relation to categories
- relation to planned courses

Map to `plans`.

2. PlanCategory

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `planId String @map("plan_id") @db.Uuid`
- `plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)`
- `name String`
- `color String @db.VarChar(7)`
- `position Int @default(0)`
- `createdAt DateTime @default(now()) @map("created_at")`
- `updatedAt DateTime @updatedAt @map("updated_at")`
- relation to planned courses

Constraints:
- unique `[planId, name]`
- index `planId`

Map to `plan_categories`.

3. PlannedCourse

This represents a course in a user's actual planner. It may come from the catalogue or be manually created.

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `planId String @map("plan_id") @db.Uuid`
- `plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)`
- `catalogCourseId String? @map("catalog_course_id") @db.Uuid`
- `catalogCourse CatalogCourse? @relation(fields: [catalogCourseId], references: [id], onDelete: SetNull)`
- `categoryId String? @map("category_id") @db.Uuid`
- `category PlanCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)`
- `name String`
- `abbreviation String @db.VarChar(32)`
- `cp Int`
- `courseNumber String? @map("course_number")`
- `isActive Boolean @default(true) @map("is_active")`
- `createdAt DateTime @default(now()) @map("created_at")`
- `updatedAt DateTime @updatedAt @map("updated_at")`
- relation to appointments
- relation to exam

Indexes:
- `planId`
- `catalogCourseId`
- `categoryId`
- `courseNumber`

Map to `planned_courses`.

4. PlannedAppointment

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `courseId String @map("course_id") @db.Uuid`
- `course PlannedCourse @relation(fields: [courseId], references: [id], onDelete: Cascade)`
- `date DateTime`
- `timeFrom String @map("time_from") @db.VarChar(5)`
- `timeTo String @map("time_to") @db.VarChar(5)`
- `room String`
- `type String @db.VarChar(32)`
- `position Int @default(0)`

Indexes:
- `courseId`
- `date`

Map to `planned_appointments`.

5. PlannedExam

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `courseId String @unique @map("course_id") @db.Uuid`
- `course PlannedCourse @relation(fields: [courseId], references: [id], onDelete: Cascade)`
- `date DateTime`
- `timeFrom String @map("time_from") @db.VarChar(5)`
- `timeTo String @map("time_to") @db.VarChar(5)`

Map to `planned_exams`.

6. CatalogScanRun

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `source String @default("tucan")`
- `semesterKey String @map("semester_key")`
- `status String`
- `startedAt DateTime @default(now()) @map("started_at")`
- `finishedAt DateTime? @map("finished_at")`
- `coursesSeen Int @default(0) @map("courses_seen")`
- `coursesCreated Int @default(0) @map("courses_created")`
- `coursesUpdated Int @default(0) @map("courses_updated")`
- `coursesFailed Int @default(0) @map("courses_failed")`
- `errorText String? @map("error_text") @db.Text`

Map to `catalog_scan_runs`.

7. CatalogCourse

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `semesterKey String @map("semester_key")`
- `source String @default("tucan")`
- `sourceKey String @map("source_key")`
- `sourceUrl String? @map("source_url") @db.Text`
- `title String`
- `courseNumber String? @map("course_number")`
- `abbreviation String?`
- `cp Int?`
- `eventType String? @map("event_type")`
- `language String?`
- `faculty String?`
- `path String[]`
- `instructors String[]`
- `detailsJson Json? @map("details_json")`
- `rawAppointmentText String? @map("raw_appointment_text") @db.Text`
- `firstDate DateTime? @map("first_date")`
- `lastDate DateTime? @map("last_date")`
- `appointmentCount Int @default(0) @map("appointment_count")`
- `lastScannedAt DateTime @default(now()) @map("last_scanned_at")`
- `createdAt DateTime @default(now()) @map("created_at")`
- `updatedAt DateTime @updatedAt @map("updated_at")`
- relation to catalogue appointments
- relation to planned courses

Constraints:
- unique `[semesterKey, source, sourceKey]`

Indexes:
- `semesterKey`
- `source`
- `courseNumber`
- `title`
- `faculty`

Map to `catalog_courses`.

8. CatalogAppointment

Fields:
- `id String @id @default(uuid()) @db.Uuid`
- `courseId String @map("course_id") @db.Uuid`
- `course CatalogCourse @relation(fields: [courseId], references: [id], onDelete: Cascade)`
- `date DateTime`
- `timeFrom String @map("time_from") @db.VarChar(5)`
- `timeTo String @map("time_to") @db.VarChar(5)`
- `room String`
- `type String @db.VarChar(32)`
- `position Int @default(0)`

Indexes:
- `courseId`
- `date`

Unique constraint:
- `[courseId, date, timeFrom, timeTo, room, type]`

Map to `catalog_appointments`.

Use Prisma migrations.

C. Backend API redesign
Remove or retire `/api/shares`.

Add these routers:

1. `/api/plans`

Endpoints:
- `POST /api/plans`
  - Creates a new anonymous plan.
  - Returns the full normalized plan payload.

- `GET /api/plans/:planId`
  - Returns full plan with categories, courses, appointments, and exams.

- `PATCH /api/plans/:planId`
  - Updates plan name.

2. `/api/plans/:planId/categories`

Endpoints:
- `GET /api/plans/:planId/categories`
- `POST /api/plans/:planId/categories`
- `PATCH /api/plans/:planId/categories/:categoryId`
- `DELETE /api/plans/:planId/categories/:categoryId`

Rules:
- Validate payloads with zod.
- Category name required.
- Color must be hex `#RRGGBB`.
- If deleting a category, set affected courses to `categoryId = null`.

3. `/api/plans/:planId/courses`

Endpoints:
- `GET /api/plans/:planId/courses`
- `POST /api/plans/:planId/courses`
- `PATCH /api/plans/:planId/courses/:courseId`
- `DELETE /api/plans/:planId/courses/:courseId`
- `POST /api/plans/:planId/courses/import-catalog`

Manual course creation:
- Accept:
  - `name`
  - `abbreviation`
  - `cp`
  - `category_id`
  - `course_number`
  - `appointments_raw`
- Use the shared `parseAppointments` function.
- Store normalized appointments in `planned_appointments`.

Catalogue import:
- Accept:
  - `catalog_course_id`
  - optional `category_id`
  - optional `abbreviation`
  - optional `cp_override`
- Load the catalogue course and its catalogue appointments.
- Create a `PlannedCourse`.
- Copy catalogue appointments into `PlannedAppointment`.
- Do not only reference catalogue appointments; copy them so the user's plan remains stable/editable even if the catalogue is rescanned later.
- Preserve `catalogCourseId` as provenance.

Update course:
- Allow updating name, abbreviation, cp, category, course number, active state, and appointment rows.
- If `appointments_raw` is provided, reparse and replace planned appointments transactionally.

4. `/api/plans/:planId/courses/:courseId/exam`

Endpoints:
- `PUT`
- `DELETE`

Store one optional exam per planned course.

5. `/api/catalog`

Endpoints:
- `GET /api/catalog/health`
  - latest scan status
  - latest scan time
  - number of catalogue courses
  - number of catalogue appointments

- `GET /api/catalog/semesters`
  - available semester keys and counts

- `GET /api/catalog/courses`
  Query params:
  - `q`
  - `semester`
  - `faculty`
  - `limit`, default 25, max 100
  - `cursor` or page-based pagination

  Search over:
  - title
  - courseNumber
  - abbreviation
  - instructors
  - faculty

  Return lightweight course cards.

- `GET /api/catalog/courses/:id`
  - full catalogue course with appointments

6. `/api/catalog/internal/ingest`

- Protected by `SCANNER_TOKEN`.
- If backend has no `SCANNER_TOKEN`, reject all ingestion.
- Scanner sends batches of parsed catalogue courses.
- Upsert `CatalogCourse`.
- Replace catalogue appointments transactionally.
- Update scan counters.
- Validate with zod.
- This is internal to Docker network.

D. Frontend migration
Remove:
- share panel
- share code input
- QR code share UI
- encrypted snapshot creation/opening/extending
- `shareCrypto`
- share envelope API client
- share link helpers
- old encrypted share types

Introduce:
- Plan bootstrap flow:
  1. On app load, read `semester-planner:plan-id` from localStorage.
  2. If present, fetch `/api/plans/:planId`.
  3. If absent, show entry screen with `Neue Planung`.
  4. `Neue Planung` calls `POST /api/plans`, stores returned plan ID in localStorage, then loads planner.
- Keep UI preferences local if convenient:
  - dark mode
  - show full name
  - filters

Refactor frontend hooks:
- `useCourses` should fetch from backend instead of reading local planner snapshot.
- `useCategories` should fetch from backend.
- `useCreateCourse`, `useUpdateCourse`, `useDeleteCourse`, `useToggleCourse` should call backend endpoints.
- Keep the public TypeScript shape close to the existing `PlannerCourse`, `PlannerAppointment`, `PlannerCategory` types so existing CalendarPage and CourseFormPage require minimal UI changes.

Course form:
- Continue supporting manual course creation.
- Continue accepting pasted TUCaN appointment rows.
- Use shared parser for preview.
- On save, send `appointments_raw` to backend.
- Backend parses and stores normalized appointments.
- The frontend may still preview locally using shared parser.

Add catalogue UI:
- Add nav link `Katalog`.
- Add page `CatalogPage`.
- Search `/api/catalog/courses`.
- Show:
  - title
  - course number
  - semester
  - faculty/path
  - instructors
  - appointment count
  - date range
- Clicking a result opens detail.
- Detail shows appointments.
- Add button `Zum Plan hinzufügen`.
- Import behavior:
  - Call `/api/plans/:planId/courses/import-catalog`.
  - If catalogue CP is missing, ask user for CP or default to 6 with editable post-import course form.
  - After import, navigate to calendar or course edit page.
- Keep manual `Neuer Kurs` flow.

E. Scanner container
Create a new top-level `scanner/` TypeScript package.

Use:
- Node 20
- TypeScript
- `tsx`
- `cheerio`
- built-in fetch or undici
- shared appointment parser module

Scanner behavior:
1. Start from public anonymous TUCaN.
2. Discover current Vorlesungsverzeichnis.
3. Walk the catalogue tree.
4. Default to `FB20 - Informatik`, configurable by env.
5. Follow TUCaN-generated links.
6. Do not decode `ARGUMENTS`.
7. Classify links by URL `PRGNAME`:
   - `ACTION` and `REGISTRATION` are navigation/parent pages.
   - `COURSEDETAILS` are course detail pages.
   - `MODULEDETAILS` may be parsed later, but do not depend on them.
8. Parse TUCaN pages using polished equivalents of the beautiful-tucan approach:
   - extract navigation/course links from `#pageContent ul li` and `#pageContent table tr`
   - extract details from the first details table under `#pageContent`
   - extract appointment table with caption containing `Termine`
   - handle group/tutorial blocks containing `Kleingruppe(n)` if present
9. Convert scraped appointment rows into exact parser-compatible raw text:
   `Nr\tDatum\tVon\tBis\tRaum\tLehrende`
10. Use shared `parseAppointments(rawText)` to normalize appointments.
11. Build stable `sourceKey`:
   - Prefer stable course identifiers visible in `COURSEDETAILS` arguments.
   - Otherwise SHA-256 over normalized semesterKey, title, courseNumber, and de-sessionized source URL.
12. POST batches to backend `/api/catalog/internal/ingest`.

Scanner env:
- `BACKEND_API_URL`, default `http://backend:4000/api`
- `SCANNER_TOKEN`
- `TUCAN_BASE_URL`, default `https://www.tucan.tu-darmstadt.de`
- `TUCAN_RATE_LIMIT_MS`, default `750`
- `SCAN_INTERVAL_HOURS`, default `24`
- `TUCAN_FACULTY_PREFIX`, default `FB20 - Informatik`

Scanner commands:
- `npm run scan:once`
- `npm run scan:watch`

Logging:
- current semester discovered
- navigation pages visited
- course pages discovered
- courses parsed
- courses failed
- ingestion result

No credentials. No SSO. No private user data.

F. Docker Compose
Update `docker-compose.yml`.

Keep:
- `db`
- `backend`
- `frontend`
- `cloudflared`

Add:
- `scanner` service behind Compose profile `scanner`.

Example behavior:
- Normal dev:
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`
- Scanner:
  `docker compose --profile scanner up -d --build`

Backend env:
- Add `SCANNER_TOKEN`.

Scanner env:
- `BACKEND_API_URL=http://backend:4000/api`
- `SCANNER_TOKEN=${SCANNER_TOKEN:-changeme-dev-scanner-token}`
- `TUCAN_RATE_LIMIT_MS=${TUCAN_RATE_LIMIT_MS:-750}`
- `SCAN_INTERVAL_HOURS=${SCAN_INTERVAL_HOURS:-24}`
- `TUCAN_FACULTY_PREFIX=${TUCAN_FACULTY_PREFIX:-FB20 - Informatik}`

Do not expose scanner ports.

G. Remove or update obsolete code/docs
Remove or refactor references to:
- encrypted snapshots
- ciphertext-only backend
- eight-word codes
- share locators
- AES-GCM/PBKDF2 share flow
- old privacy model saying the server never stores plaintext courses
- `ShareSnapshot`
- `/api/shares`

Update README:
- App now stores planner data in PostgreSQL.
- Users are anonymous and identified by a local plan UUID for now.
- Public lecture catalogue is scraped from public TUCaN.
- Scanner is optional and rate-limited.
- Inferno is not used.
- Public sharing is intentionally not implemented yet.

H. Tests
Add/update tests for:
1. Shared appointment parser regression.
2. Plan CRUD backend routes.
3. Category CRUD backend routes.
4. Course CRUD backend routes.
5. Catalogue search backend routes.
6. Catalogue import route copies catalogue appointments into planned appointments.
7. Scanner parser using static HTML fixtures:
   - catalogue navigation fixture
   - course detail fixture
   - appointment table fixture

I. Acceptance criteria
1. Fresh Docker startup works.
2. Creating a new plan stores a DB row in `plans`.
3. Browser stores only the plan UUID in localStorage.
4. Categories are stored in PostgreSQL.
5. Manually created courses are stored in PostgreSQL.
6. Pasted TUCaN appointments still parse exactly as before.
7. Calendar renders courses loaded from backend.
8. Catalogue scanner can ingest public TUCaN courses.
9. `/api/catalog/health` reports catalogue counts after scanning.
10. Catalogue search works in the frontend.
11. Importing a catalogue course creates a planned course and copies appointments.
12. Old encrypted share UI/API/code is gone.
13. No Inferno dependency exists.
14. `npm run lint`, `npm run build`, and available tests pass for frontend, backend, shared package, and scanner.

Implementation style:
- Keep modules small.
- Use zod for API validation.
- Use Prisma transactions for course creation/update/import.
- Keep frontend data shapes close to existing planner types where possible.
- Do not make accounts/auth in this change.
- Do not implement public sharing in this change.
