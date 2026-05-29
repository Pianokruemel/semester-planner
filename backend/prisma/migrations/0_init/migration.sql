-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mein Stundenplan',
    "share_token" VARCHAR(32),
    "preferred_study_program_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_categories" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(32) NOT NULL DEFAULT 'manual',
    "curriculum_category_key" TEXT,
    "required_cp_min" INTEGER,
    "required_cp_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_courses" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "catalog_course_id" UUID,
    "catalog_synced_at" TIMESTAMP(3),
    "catalog_last_scanned_at_at_sync" TIMESTAMP(3),
    "catalog_appointments_fingerprint" VARCHAR(64),
    "catalog_subgroup_key" TEXT,
    "catalog_subgroup_title" TEXT,
    "catalog_program_key" TEXT,
    "catalog_program_label" TEXT,
    "catalog_program_po_label" TEXT,
    "catalog_program_class_path" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "catalog_program_module_number" TEXT,
    "catalog_program_module_title" TEXT,
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "abbreviation" VARCHAR(32) NOT NULL,
    "cp" INTEGER NOT NULL,
    "course_number" TEXT,
    "instructor" TEXT,
    "color_tag" VARCHAR(16),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_appointments" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_from" VARCHAR(5) NOT NULL,
    "time_to" VARCHAR(5) NOT NULL,
    "room" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "planned_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_exams" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_from" VARCHAR(5) NOT NULL,
    "time_to" VARCHAR(5) NOT NULL,

    CONSTRAINT "planned_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_scan_runs" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tucan',
    "semester_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "courses_seen" INTEGER NOT NULL DEFAULT 0,
    "courses_created" INTEGER NOT NULL DEFAULT 0,
    "courses_updated" INTEGER NOT NULL DEFAULT 0,
    "courses_failed" INTEGER NOT NULL DEFAULT 0,
    "error_text" TEXT,

    CONSTRAINT "catalog_scan_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_courses" (
    "id" UUID NOT NULL,
    "semester_key" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tucan',
    "source_key" TEXT NOT NULL,
    "source_url" TEXT,
    "title" TEXT NOT NULL,
    "course_number" TEXT,
    "abbreviation" TEXT,
    "cp" INTEGER,
    "event_type" TEXT,
    "language" TEXT,
    "faculty" TEXT,
    "path" TEXT[],
    "instructors" TEXT[],
    "details_json" JSONB,
    "raw_appointment_text" TEXT,
    "first_date" TIMESTAMP(3),
    "last_date" TIMESTAMP(3),
    "appointment_count" INTEGER NOT NULL DEFAULT 0,
    "last_scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_exam_plan_documents" (
    "id" UUID NOT NULL,
    "semester_key" TEXT NOT NULL,
    "semester_index" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_label" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "etag" TEXT,
    "last_modified" TEXT,
    "fetch_status" TEXT NOT NULL,
    "parse_status" TEXT NOT NULL,
    "error_text" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "valid_row_count" INTEGER NOT NULL DEFAULT 0,
    "matched_row_count" INTEGER NOT NULL DEFAULT 0,
    "unmatched_row_count" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_exam_plan_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_exam_candidates" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "weekday" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time_from" VARCHAR(5) NOT NULL,
    "time_to" VARCHAR(5) NOT NULL,
    "appointment_type" TEXT,
    "lecturer" TEXT,
    "course_name" TEXT NOT NULL,
    "normalized_course_title" TEXT NOT NULL,
    "extracted_course_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "row_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_exam_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_exam_course_matches" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "catalog_course_id" UUID NOT NULL,
    "match_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_exam_course_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_study_programs" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "page_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_study_programs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "module_handbook_documents" (
    "id" UUID NOT NULL,
    "program_key" TEXT NOT NULL,
    "po_label" TEXT NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "pdf_label" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "etag" TEXT,
    "last_modified" TEXT,
    "fetch_status" TEXT NOT NULL,
    "parse_status" TEXT NOT NULL,
    "error_text" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_handbook_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_handbook_courses" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "program_key" TEXT NOT NULL,
    "po_label" TEXT NOT NULL,
    "module_number" TEXT NOT NULL,
    "course_number" TEXT,
    "normalized_course_number" TEXT,
    "module_title" TEXT NOT NULL,
    "cp" INTEGER,
    "class_path" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "page_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_handbook_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_appointments" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_from" VARCHAR(5) NOT NULL,
    "time_to" VARCHAR(5) NOT NULL,
    "room" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "catalog_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_share_token_key" ON "plans"("share_token");

-- CreateIndex
CREATE INDEX "plan_categories_plan_id_idx" ON "plan_categories"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_categories_plan_id_name_key" ON "plan_categories"("plan_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "plan_categories_plan_id_curriculum_category_key_key" ON "plan_categories"("plan_id", "curriculum_category_key");

-- CreateIndex
CREATE INDEX "planned_courses_plan_id_idx" ON "planned_courses"("plan_id");

-- CreateIndex
CREATE INDEX "planned_courses_catalog_course_id_idx" ON "planned_courses"("catalog_course_id");

-- CreateIndex
CREATE INDEX "planned_courses_catalog_program_key_idx" ON "planned_courses"("catalog_program_key");

-- CreateIndex
CREATE INDEX "planned_courses_category_id_idx" ON "planned_courses"("category_id");

-- CreateIndex
CREATE INDEX "planned_courses_course_number_idx" ON "planned_courses"("course_number");

-- CreateIndex
CREATE INDEX "planned_appointments_course_id_idx" ON "planned_appointments"("course_id");

-- CreateIndex
CREATE INDEX "planned_appointments_date_idx" ON "planned_appointments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "planned_exams_course_id_key" ON "planned_exams"("course_id");

-- CreateIndex
CREATE INDEX "catalog_courses_semester_key_idx" ON "catalog_courses"("semester_key");

-- CreateIndex
CREATE INDEX "catalog_courses_source_idx" ON "catalog_courses"("source");

-- CreateIndex
CREATE INDEX "catalog_courses_course_number_idx" ON "catalog_courses"("course_number");

-- CreateIndex
CREATE INDEX "catalog_courses_title_idx" ON "catalog_courses"("title");

-- CreateIndex
CREATE INDEX "catalog_courses_faculty_idx" ON "catalog_courses"("faculty");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_courses_semester_key_source_source_key_key" ON "catalog_courses"("semester_key", "source", "source_key");

-- CreateIndex
CREATE INDEX "catalog_exam_plan_documents_semester_index_idx" ON "catalog_exam_plan_documents"("semester_index");

-- CreateIndex
CREATE INDEX "catalog_exam_plan_documents_content_hash_idx" ON "catalog_exam_plan_documents"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_exam_plan_documents_semester_key_file_url_key" ON "catalog_exam_plan_documents"("semester_key", "file_url");

-- CreateIndex
CREATE INDEX "catalog_exam_candidates_date_idx" ON "catalog_exam_candidates"("date");

-- CreateIndex
CREATE INDEX "catalog_exam_candidates_normalized_course_title_idx" ON "catalog_exam_candidates"("normalized_course_title");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_exam_candidates_document_id_row_hash_key" ON "catalog_exam_candidates"("document_id", "row_hash");

-- CreateIndex
CREATE INDEX "catalog_exam_course_matches_catalog_course_id_idx" ON "catalog_exam_course_matches"("catalog_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_exam_course_matches_candidate_id_catalog_course_id_key" ON "catalog_exam_course_matches"("candidate_id", "catalog_course_id");

-- CreateIndex
CREATE INDEX "catalog_study_programs_label_idx" ON "catalog_study_programs"("label");

-- CreateIndex
CREATE INDEX "module_handbook_documents_program_key_idx" ON "module_handbook_documents"("program_key");

-- CreateIndex
CREATE INDEX "module_handbook_documents_content_hash_idx" ON "module_handbook_documents"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "module_handbook_documents_program_key_po_label_pdf_url_key" ON "module_handbook_documents"("program_key", "po_label", "pdf_url");

-- CreateIndex
CREATE INDEX "module_handbook_courses_program_key_idx" ON "module_handbook_courses"("program_key");

-- CreateIndex
CREATE INDEX "module_handbook_courses_po_label_idx" ON "module_handbook_courses"("po_label");

-- CreateIndex
CREATE INDEX "module_handbook_courses_module_number_idx" ON "module_handbook_courses"("module_number");

-- CreateIndex
CREATE INDEX "module_handbook_courses_normalized_course_number_idx" ON "module_handbook_courses"("normalized_course_number");

-- CreateIndex
CREATE INDEX "catalog_appointments_course_id_idx" ON "catalog_appointments"("course_id");

-- CreateIndex
CREATE INDEX "catalog_appointments_date_idx" ON "catalog_appointments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_appointments_course_id_date_time_from_time_to_room__key" ON "catalog_appointments"("course_id", "date", "time_from", "time_to", "room", "type");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_preferred_study_program_key_fkey" FOREIGN KEY ("preferred_study_program_key") REFERENCES "catalog_study_programs"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_categories" ADD CONSTRAINT "plan_categories_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_courses" ADD CONSTRAINT "planned_courses_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_courses" ADD CONSTRAINT "planned_courses_catalog_course_id_fkey" FOREIGN KEY ("catalog_course_id") REFERENCES "catalog_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_courses" ADD CONSTRAINT "planned_courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "plan_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_appointments" ADD CONSTRAINT "planned_appointments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "planned_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exams" ADD CONSTRAINT "planned_exams_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "planned_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_exam_candidates" ADD CONSTRAINT "catalog_exam_candidates_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "catalog_exam_plan_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_exam_course_matches" ADD CONSTRAINT "catalog_exam_course_matches_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "catalog_exam_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_exam_course_matches" ADD CONSTRAINT "catalog_exam_course_matches_catalog_course_id_fkey" FOREIGN KEY ("catalog_course_id") REFERENCES "catalog_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_handbook_documents" ADD CONSTRAINT "module_handbook_documents_program_key_fkey" FOREIGN KEY ("program_key") REFERENCES "catalog_study_programs"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_handbook_courses" ADD CONSTRAINT "module_handbook_courses_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "module_handbook_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_handbook_courses" ADD CONSTRAINT "module_handbook_courses_program_key_fkey" FOREIGN KEY ("program_key") REFERENCES "catalog_study_programs"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_appointments" ADD CONSTRAINT "catalog_appointments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "catalog_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

