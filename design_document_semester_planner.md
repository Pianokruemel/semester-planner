# Designdokument: Stundenplan-App

**Version:** 2.1  
**Datum:** 24. April 2026  
**Sprache der UI:** Deutsch  
**Deployment:** Lokal via Docker oder als oeffentlicher, anonymer Share-Dienst  

---

## 1. Projektuebersicht

Die Stundenplan-App ist eine Webanwendung fuer Studienplanung mit einem klaren Privacy-Schnitt:

- Der Browser besitzt den fachlichen Zustand.
- Termin-Parsing, Verschluesselung, Entschluesselung und ICS-Export laufen ausschliesslich im Browser.
- Das Backend speichert nur verschluesselte Snapshots und minimale Metadaten.

Das oeffentliche Laufzeitmodell ist kein serverseitiges CRUD-System mehr, sondern ein anonymer Snapshot-Speicher mit menschenlesbaren Codes.

---

## 2. Ziele und Nicht-Ziele

### 2.1 Ziele

- Oeffentliches Hosting ohne Benutzerkonten
- Acht-Wort-Codes fuer Teilen und Wiederoeffnen
- Browserseitige Ende-zu-Ende-Verschluesselung fuer geteilte Daten
- Lokaler Planner Store fuer alle Bearbeitungen
- Immutable Snapshot-Semantik mit Extend-Funktion und Parent-Linkage

### 2.2 Nicht-Ziele

- Serverseitige Dechiffrierung
- Passwort-Reset oder Code-Wiederherstellung
- Geteilte UI-Praeferenzen
- Deterministische serverseitige Deduplikation identischer Plannerdaten

---

## 3. Systemarchitektur

Die Anwendung besteht weiterhin aus drei Containern, aber die Verantwortlichkeiten haben sich verschoben:

```
┌──────────────────────────────────────────────┐
│               Docker Compose                 │
│                                              │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │  Frontend    │    │     Backend       │   │
│  │ React/Vite   │───►│ Express Share API │   │
│  │ Port: 3000   │    │ Port: 4000        │   │
│  │              │◄───│                   │   │
│  └──────────────┘    └────────┬──────────┘   │
│                                │              │
│                     ┌──────────▼──────────┐   │
│                     │     PostgreSQL      │   │
│                     │   share_snapshots   │   │
│                     └─────────────────────┘   │
└──────────────────────────────────────────────┘
```

### 3.1 Browser-Verantwortung

- Planner Store und lokale Entwurfswiederaufnahme
- Kategorien, Kurse, Kursnummern, Prüfungen, Termine, `is_active`
- TUCaN-Parsing mit Live-Preview
- Excel-Import fuer Prüfungen mit Preview und Matching
- Konfliktbewertung zwischen aktiven Prüfungen
- AES-GCM-Verschluesselung und Entschluesselung
- Acht-Wort-Code-Generierung
- Ableitung von Locator und Schluessel aus dem vollen Code
- ICS-Export aus entschluesseltem Zustand
- Persistenz lokaler UI-Praeferenzen

### 3.2 Backend-Verantwortung

- Validierung der Envelope-Form
- Speicherung und Auslieferung verschluesselter Snapshots
- Ratenbegrenzung auf Create und Fetch
- Keine Verarbeitung oder Persistenz von Planner-Klartext

---

## 4. Datenmodell

### 4.1 Geteilter Klartext-Snapshot im Browser

Der Browser verwendet einen Snapshot im Export-Stil als Klartext-Payload, bevor er verschluesselt wird:

```json
{
  "export_version": "2.1",
  "settings": {},
  "categories": [
    { "id": "uuid", "name": "Seminar", "color": "#6366F1" }
  ],
  "courses": [
    {
      "id": "uuid",
      "name": "IT-Sicherheit",
      "abbreviation": "ITS",
      "cp": 6,
      "category_id": "uuid-or-null",
      "course_number": "20-00-1234",
      "is_active": true,
      "exam": {
        "date": "2026-07-10",
        "time_from": "10:00",
        "time_to": "12:00"
      },
      "appointments": [
        {
          "date": "2026-04-13",
          "time_from": "08:55",
          "time_to": "10:35",
          "room": "S311/08",
          "type": "Vorlesung"
        }
      ]
    }
  ]
}
```

`settings` bleibt absichtlich leer, damit keine geraetelokalen UI-Einstellungen geteilt werden. Rohe Excel-Importdaten werden nicht gespeichert; nur die normalisierte gespeicherte Prüfung pro Kurs landet im Snapshot.

### 4.2 Device-lokale Praeferenzen

```json
{
  "dark_mode": false,
  "show_full_name": false,
  "active_filters": {
    "cp": [],
    "hideTypes": [],
    "showRoom": true,
    "showType": true,
    "showTime": true,
    "showTotalCp": true
  }
}
```

Diese Werte werden nur im Browser gespeichert und nie verschluesselt geteilt.

### 4.3 Serverseitige Envelope-Tabelle

Die Datenbank kennt nur noch eine Tabelle:

| Feld               | Typ          | Beschreibung |
|--------------------|--------------|--------------|
| id                 | UUID         | Primarschluessel |
| locator_hash       | CHAR(64)     | SHA-256 des oeffentlichen Locators |
| ciphertext         | TEXT         | AES-GCM-Ciphertext, base64url |
| nonce              | VARCHAR(64)  | AES-GCM-Nonce, base64url |
| payload_version    | VARCHAR(20)  | Snapshot-Payload-Version |
| crypto_version     | VARCHAR(64)  | Kryptographie-Version |
| parent_snapshot_id | UUID NULL    | Optionaler Parent fuer Extend |
| created_at         | TIMESTAMP    | Erstellungszeit |
| expires_at         | TIMESTAMP NULL | Optionales Retention-Feld |

Es existieren keine Tabellen mehr fuer Kategorien, Kurse, Termine oder Settings im Backend.

---

## 5. Kryptographie-Format

### 5.1 Code

- Acht zufaellige Woerter
- Der volle Code ist das Geheimnis
- Der Code wird nicht in zwei Haelften getrennt

### 5.2 Ableitungen

- `locator = SHA-256("locator:" + normalized_code)`
- `encryption_key = PBKDF2-SHA-256(normalized_code, fixed_salt, 210000 Iterationen)`

### 5.3 Verschluesselung

- Algorithmus: AES-GCM 256 Bit
- Nonce: 12 zufaellige Bytes pro Snapshot
- Klartext: JSON-serialisierter Snapshot
- Ciphertext und Nonce werden base64url-kodiert gespeichert

### 5.4 Versionierung

- `payload_version = 2.1`
- `crypto_version = aes-256-gcm+pbkdf2-sha256-v1`

Legacy-Hinweis:

- Clients akzeptieren weiterhin `payload_version = 2.0` und normalisieren alte Snapshots ohne `course_number` oder `exam` auf das aktuelle Modell.

---

## 6. API-Vertrag

**Base URL:** `/api`

### 6.1 POST `/shares`

Request:

```json
{
  "locator": "base64url...",
  "ciphertext": "base64url...",
  "nonce": "base64url...",
  "payload_version": "2.0",
  "crypto_version": "aes-256-gcm+pbkdf2-sha256-v1",
  "parent_snapshot_id": null
}
```

Antwort:

```json
{
  "id": "uuid",
  "ciphertext": "base64url...",
  "nonce": "base64url...",
  "payload_version": "2.0",
  "crypto_version": "aes-256-gcm+pbkdf2-sha256-v1",
  "parent_snapshot_id": null,
  "created_at": "2026-04-23T10:00:00.000Z",
  "expires_at": null
}
```

### 6.2 GET `/shares/:locator`

- Der Client sendet den abgeleiteten Locator.
- Der Server hasht ihn erneut fuer den Lookup.
- Die Antwort enthaelt nur die Envelope.

---

## 7. Frontend-Zustandsmodell

### 7.1 Planner Provider

Der Provider haelt:

- aktuellen Planner-Snapshot
- lokale UI-Praeferenzen
- lokale Draft-Persistenz in `localStorage`
- Referenz auf den zuletzt gespeicherten Share-Snapshot fuer `hasUnsavedChanges`

### 7.2 Hauptaktionen

- `startNewPlanner()`
- `resumePersistedDraft()`
- `createCategory()` / `updateCategory()` / `deleteCategory()`
- `createCourse()` / `updateCourse()` / `deleteCourse()` / `toggleCourse()`
- `setCourseNumber()`
- `setCourseExam()` / `clearCourseExam()` / `applyImportedExams()`
- `createShare()`
- `extendShare()`
- `openShare(code)`

### 7.3 UI-Fluss

1. Entry-Screen zeigt drei Pfade: neuer Planner, Code oeffnen, lokalen Entwurf fortsetzen.
2. Nach dem Laden arbeitet die UI ausschliesslich auf lokalem Zustand.
3. `Create code` speichert einen Snapshot ohne Parent.
4. `Extend code` speichert einen Snapshot mit `parent_snapshot_id = currentShareId`.
5. Nach dem Speichern zeigt die UI den neuen Acht-Wort-Code explizit an.
6. Die Prüfungsseite trennt Excel-Import, gespeicherte Prüfungen und manuelle Pflege von der Kalenderansicht.

---

## 8. Parsing und Export

### 8.1 TUCaN-Parsing

- Zeilenbasiert
- Header optional
- Deutsche Monatsnamen werden unterstuetzt
- `*` steuert `Vorlesung` vs. `Uebung`
- Markdown-Links in Raumfeldern werden auf den sichtbaren Text reduziert

### 8.2 ICS-Export

- Erfolgt ausschliesslich im Browser
- Nutzt lokale Wall-Clock-Zeiten (`YYYYMMDDTHHMMSS` ohne Zwang zu UTC)
- Exportiert nur den aktuell gefilterten, lokal entschluesselten Zustand

---

## 9. Threat Model

### 9.1 Was der Server sehen kann

- Dass ein Snapshot existiert
- Erstellungszeit und Parent-Verkettung
- Locator-Ableitung in gehashter Form
- Ciphertext und Nonce

### 9.2 Was der Server nicht sehen soll

- Namen von Kursen oder Kategorien
- Termine, Raeume, Zeiten
- Welche Kurse aktiv sind
- Dark Mode oder Filterzustand

### 9.3 Bekannte Einschraenkungen

- Kein Recovery bei verlorenem Code
- Keine Authentifizierung oder Schreibschutz pro Benutzer
- Keine serverseitige Konfliktaufloesung fuer parallele Bearbeitung

---

## 10. Verifikation

Primäre Gates:

1. `backend`: `npm run prisma:generate`, `npm run lint`, `npm run build`
2. `frontend`: `npm run lint`, `npm run build`
3. Manuelle Share-Roundtrip-Pruefung
4. Manuelle Privacy-Pruefung in Netzwerk und Datenbank
5. Manuelle Extend-Pruefung mit altem und neuem Code
6. Manuelle Parser- und ICS-Paritaet

Es sind weiterhin keine echten automatisierten Produktivtests vorhanden; Lint, Build und manuelle Ablaufpruefungen bleiben die wichtigsten Freigabekriterien.

- Ansichts-Tabs: **Woche | Tag | Monat**
- Zeitbereich: 07:00 – 20:00 Uhr (Woche/Tag-Ansicht)
- Kurs-Blöcke: Hintergrundfarbe der Kategorie, abgerundete Ecken
- Angezeigter Text im Block (je nach Filtereinstellungen):
  - Immer: Kursname/Abkürzung
  - Optional: Uhrzeit, Raum, Typ
- **Überschneidungen:** Blöcke werden nebeneinander (side-by-side) dargestellt, gleich wie Google Calendar (prozentuale Breitenaufteilung)
- Monatsansicht: Kompakte Chips pro Termin, Hover zeigt Tooltip mit Details

### 7.2 Kurs erstellen/bearbeiten (`/courses/new`, `/courses/:id/edit`)

**Formularfelder:**
1. **Kursname** – Pflichtfeld, Freitexteingabe
2. **Abkürzung** – Pflichtfeld, Freitexteingabe (max. 15 Zeichen)
3. **CP** – Pflichtfeld, Zahlenfeld (positive ganze Zahl)
4. **Kategorie** – Dropdown (alle Kategorien + „Ohne Kategorie"); Link „Neue Kategorie erstellen" → `/categories`
5. **Termine** – Großes Freitextfeld mit Placeholder-Hinweis zum TUCaN-Format

**Aktionen:**
- „Speichern" – validiert, parsed Termine, speichert in DB
- „Abbrechen" – zurück zur Hauptseite ohne Speichern
- (Nur Bearbeitungsmodus): „Kurs löschen" – roter Button mit Bestätigungsdialog

**Bestätigungsdialog Löschen:**
> „Möchtest du den Kurs ‹Kursname› wirklich löschen? Alle zugehörigen Termine werden ebenfalls entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
> [Abbrechen] [Löschen]

**Parsing-Feedback:**
- Nach dem Einfügen des Terminformats: Live-Vorschau der erkannten Termine (Anzahl, Datumsbereich, erkannte Typen)
- Bei Parsing-Fehler: Inline-Fehlermeldung mit Zeilenangabe

### 7.3 Kategorien verwalten (`/categories`)

- Liste aller Kategorien mit Farb-Vorschau, Name und Anzahl zugehöriger Kurse
- „+ Neue Kategorie" Button öffnet Inline-Formular oder Modal:
  - Name (Freitext)
  - Farbe (Hex-Farbpicker: visueller Picker + Hex-Eingabefeld)
- Bearbeiten-Icon pro Eintrag
- Löschen-Icon mit Warndialog (zeigt betroffene Kurse)

---

## 8. UI/UX Design

### 8.1 Allgemeine Design-Prinzipien

- **Stil:** Modern, clean, minimalistisch
- **Ecken:** Stark abgerundet (`border-radius: 12–16px` für Karten, `8px` für Buttons)
- **Schatten:** Subtile Schatten (`shadow-md`) für Karten und Modals
- **Typografie:** System-Fontstack oder Inter (Google Fonts)
- **Spacing:** Großzügiges Padding, klare visuelle Hierarchie

### 8.2 Farbschema

**Light Mode:**
- Background: `#F8FAFC`
- Surface (Karten): `#FFFFFF`
- Primary: `#6366F1` (Indigo)
- Text: `#0F172A`
- Subtle Text: `#64748B`
- Border: `#E2E8F0`

**Dark Mode:**
- Background: `#0F172A`
- Surface: `#1E293B`
- Primary: `#818CF8`
- Text: `#F1F5F9`
- Subtle Text: `#94A3B8`
- Border: `#334155`

### 8.3 Kalender-Blöcke

- Hintergrund: Kategorie-Farbe mit 80–90% Opazität
- Text: Weiß oder dunkel je nach Farbhelligkeit (Kontrast-Check)
- Hover: leichte Aufhellung + Cursor pointer
- Überschneidung: Blöcke teilen die Breite gleichmäßig auf (50% bei 2, 33% bei 3, etc.)

### 8.4 Responsive Design

- **Desktop (≥1024px):** Sidebar links + Kalender rechts (Standard-Layout)
- **Tablet (768–1023px):** Sidebar als ausklappbares Panel (Hamburger-Icon)
- **Mobile (<768px):** Sidebar als Bottom-Sheet; Nur Tages- und Wochenansicht empfohlen; Monatsansicht als kompakte Chip-Ansicht

---

## 9. JSON Export/Import Format

```json
{
  "export_version": "1.0",
  "exported_at": "2026-03-30T12:00:00Z",
  "settings": {
    "dark_mode": false,
    "show_full_name": false
  },
  "categories": [
    {
      "id": "uuid",
      "name": "Seminar",
      "color": "#6366F1"
    }
  ],
  "courses": [
    {
      "id": "uuid",
      "name": "IT-Sicherheit",
      "abbreviation": "ITS",
      "cp": 6,
      "category_id": "uuid",
      "is_active": true,
      "appointments": [
        {
          "date": "2026-04-13",
          "time_from": "08:55",
          "time_to": "10:35",
          "room": "S311/08",
          "type": "Vorlesung"
        }
      ]
    }
  ]
}
```

**Import-Verhalten:**
- Alle bestehenden Daten werden vor dem Import gelöscht (mit Bestätigungsdialog)
- UUIDs aus der Datei werden übernommen, um Referenzen zu erhalten
- Validierung des Formats vor dem Import; bei Fehler: Abbruch mit Fehlermeldung

---

## 10. Projektstruktur

```
stundenplan/
├── docker-compose.yml
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── CalendarPage.tsx
│       │   ├── CourseFormPage.tsx
│       │   └── CategoriesPage.tsx
│       ├── components/
│       │   ├── Calendar/
│       │   │   ├── CalendarView.tsx
│       │   │   ├── EventBlock.tsx
│       │   │   └── OverlapResolver.ts
│       │   ├── Sidebar/
│       │   │   ├── FilterPanel.tsx
│       │   │   └── CourseToggleList.tsx
│       │   ├── Forms/
│       │   │   ├── CourseForm.tsx
│       │   │   └── CategoryForm.tsx
│       │   └── UI/
│       │       ├── ColorPicker.tsx
│       │       ├── Modal.tsx
│       │       └── Toggle.tsx
│       ├── hooks/
│       │   ├── useCourses.ts
│       │   ├── useCategories.ts
│       │   └── useSettings.ts
│       ├── utils/
│       │   ├── appointmentParser.ts
│       │   └── icsGenerator.ts
│       └── api/
│           └── client.ts
└── backend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.ts
        ├── routes/
        │   ├── courses.ts
        │   ├── categories.ts
        │   ├── settings.ts
        │   └── exportImport.ts
        ├── services/
        │   ├── appointmentParser.ts
        │   └── icsExporter.ts
        ├── prisma/
        │   └── schema.prisma
        └── middleware/
            └── errorHandler.ts
```

---

## 11. Nicht-Funktionale Anforderungen

| Anforderung     | Beschreibung                                                              |
|-----------------|---------------------------------------------------------------------------|
| Performance     | Kalender-Rendering < 100ms; API-Antwortzeiten < 200ms bei lokaler DB      |
| Datenmenge      | Ausgelegt für ~12 Kurse à 10–30 Termine (ca. 360 Appointments max.)       |
| Datensicherheit | Nur lokaler Zugriff; keine Authentifizierung erforderlich                 |
| Offline-Fähigkeit| Da lokal, vollständig offline nutzbar                                    |
| Wartbarkeit     | TypeScript in Frontend und Backend für Typsicherheit                      |

---

## 12. Offene Punkte / Zukünftige Erweiterungen

- Mehrere Semester verwalten
- Automatische Erkennung von Feiertagen (Hessen)
- Drag & Drop für manuelle Terminverschiebungen
- Benachrichtigungen/Erinnerungen (z. B. via Browser-Notification API)
- PDF-Export des Stundenplans
