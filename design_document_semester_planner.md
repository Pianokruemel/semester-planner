# Designdokument: Stundenplan-App

**Version:** 3.0  
**Datum:** 1. Mai 2026  
**Status:** Aktuelle PostgreSQL-/Katalog-Architektur

## Ueberblick

Die Anwendung ist ein anonymer Semesterplaner. PostgreSQL ist die Quelle der Wahrheit fuer Plandaten und den oeffentlichen TUCaN-Katalog. Der Browser speichert nur die aktuelle Plan-ID und lokale UI-Einstellungen.

## Komponenten

- `frontend`: React/Vite UI fuer Kalender, Kurse, Kategorien, Pruefungen und Katalogsuche.
- `backend`: Express/Prisma API fuer Plan-CRUD, Katalogsuche und internen Scanner-Ingest.
- `packages/shared`: Gemeinsamer TypeScript-Terminparser.
- `scanner`: Oeffentlicher TUCaN-Scanner fuer das Vorlesungsverzeichnis.
- `db`: PostgreSQL 16.

## Datenmodell

PostgreSQL speichert:

- Plaene
- Plan-Kategorien
- geplante Kurse
- geplante Kurstermine
- geplante Pruefungen
- Katalog-Scanlaeufe
- Katalog-Kurse
- Katalog-Termine

## Browser-Speicher

Der Browser speichert:

- `semester-planner:plan-id`
- lokale UI-Einstellungen wie Dark Mode, Filter und Anzeigeoptionen

## Nicht Bestandteil dieser Version

- Accounts oder Authentifizierung
- oeffentliches Teilen
- private TUCaN-/SSO-Daten
- Inferno
