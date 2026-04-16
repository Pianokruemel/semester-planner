# Designdokument: Stundenplan-App

**Version:** 1.0  
**Datum:** 30. März 2026  
**Sprache der UI:** Deutsch  
**Deployment:** Lokal via Docker  

---

## 1. Projektübersicht

Die Stundenplan-App ist eine lokal betriebene Webanwendung zur Organisation und Planung von Lehrveranstaltungen im Studium. Das zentrale Element ist ein interaktiver Kalender, in dem Kurse mit ihren Einzelterminen visualisiert werden. Kurse können aus dem TUCaN-Terminformat importiert, kategorisiert, gefiltert und als ICS-Datei exportiert werden.

---

## 2. Systemarchitektur

Die Anwendung besteht aus drei Docker-Containern, die über Docker Compose orchestriert werden:

```
┌─────────────────────────────────────────────┐
│              Docker Compose                 │
│                                             │
│  ┌──────────────┐   ┌──────────────────┐   │
│  │  Frontend    │   │    Backend       │   │
│  │  React/Vite  │◄──►  Node.js/Express│   │
│  │  Port: 3000  │   │  Port: 4000      │   │
│  └──────────────┘   └────────┬─────────┘   │
│                               │             │
│                    ┌──────────▼─────────┐   │
│                    │    PostgreSQL      │   │
│                    │    Port: 5432      │   │
│                    └───────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2.1 Container-Übersicht

| Container     | Image              | Port  | Beschreibung                        |
|---------------|--------------------|-------|-------------------------------------|
| frontend      | node:20-alpine     | 3000  | React + Vite SPA                    |
| backend       | node:20-alpine     | 4000  | REST API (Express)                  |
| db            | postgres:16-alpine | 5432  | Persistente Datenbank               |

### 2.2 Docker Compose Konfiguration (Übersicht)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: stundenplan
      POSTGRES_USER: app
      POSTGRES_PASSWORD: <secret>
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports: ["4000:4000"]
    environment:
      DATABASE_URL: postgres://app:<secret>@db:5432/stundenplan
    depends_on: [db]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      VITE_API_URL: http://localhost:4000

volumes:
  pgdata:
```

---

## 3. Tech Stack

| Bereich      | Technologie                        | Begründung                                              |
|--------------|------------------------------------|---------------------------------------------------------|
| Frontend     | React 18 + Vite + TypeScript       | Modern, schnell, reaktiv; Vite für schnellen Dev-Build  |
| Styling      | Tailwind CSS + shadcn/ui           | Modernes, schickes Design mit abgerundeten Komponenten  |
| Kalender     | react-big-calendar oder FullCalendar| Fertige Kalender-Komponente mit Woche/Tag/Monat         |
| Backend      | Node.js 20 + Express + TypeScript  | Schlank, weit verbreitet, einfach                       |
| ORM          | Prisma                             | Typsichere DB-Anbindung, einfache Migrations            |
| Datenbank    | PostgreSQL 16                      | Robust, Docker-kompatibel                               |
| Dark Mode    | Tailwind dark-class Strategie      | Toggle via CSS-Klasse auf <html>                        |
| ICS-Export   | ical.js oder ics (npm)             | Standardkonformer iCalendar-Export                      |

---

## 4. Datenmodell

### 4.1 Entity-Relationship-Übersicht

```
Category ──< Course ──< Appointment
```

### 4.2 Tabelle: categories

| Feld       | Typ          | Constraints         | Beschreibung              |
|------------|--------------|---------------------|---------------------------|
| id         | UUID         | PK, auto            | Primärschlüssel           |
| name       | VARCHAR(100) | NOT NULL, UNIQUE    | z. B. "Seminar"           |
| color      | CHAR(7)      | NOT NULL            | Hex-Farbcode, z. B. #3B82F6|
| created_at | TIMESTAMP    | DEFAULT NOW()       | Erstellungszeitpunkt      |

**Standard-Einträge beim ersten Start:**
- „Seminar" (#6366F1)
- „Praktikum" (#10B981)

### 4.3 Tabelle: courses

| Feld          | Typ          | Constraints              | Beschreibung                          |
|---------------|--------------|--------------------------|---------------------------------------|
| id            | UUID         | PK, auto                 | Primärschlüssel                       |
| name          | VARCHAR(255) | NOT NULL                 | Vollständiger Kursname                |
| abbreviation  | VARCHAR(50)  | NOT NULL                 | Abkürzung für Kalenderansicht         |
| cp            | INTEGER      | NOT NULL, CHECK > 0      | Credit Points                         |
| category_id   | UUID         | FK → categories.id, NULL | Kategorie; NULL = "Ohne Kategorie"    |
| is_active     | BOOLEAN      | DEFAULT true             | Sichtbarkeit im Kalender              |
| created_at    | TIMESTAMP    | DEFAULT NOW()            | Erstellungszeitpunkt                  |

### 4.4 Tabelle: appointments

| Feld       | Typ          | Constraints              | Beschreibung                              |
|------------|--------------|--------------------------|-------------------------------------------|
| id         | UUID         | PK, auto                 | Primärschlüssel                           |
| course_id  | UUID         | FK → courses.id, CASCADE | Zugehöriger Kurs                          |
| date       | DATE         | NOT NULL                 | Datum des Termins                         |
| time_from  | TIME         | NOT NULL                 | Startzeit                                 |
| time_to    | TIME         | NOT NULL                 | Endzeit                                   |
| room       | VARCHAR(255) | NOT NULL                 | Raumbezeichnung (Link-Markup entfernt)    |
| type       | ENUM         | 'Vorlesung','Uebung'     | Abgeleitet aus Sternchen-Logik            |
| created_at | TIMESTAMP    | DEFAULT NOW()            | Erstellungszeitpunkt                      |

### 4.5 Tabelle: settings

| Feld  | Typ          | Constraints      | Beschreibung                    |
|-------|--------------|------------------|---------------------------------|
| key   | VARCHAR(100) | PK               | Einstellungsschlüssel           |
| value | TEXT         | NOT NULL         | Einstellungswert (JSON-kodiert) |

**Gespeicherte Einstellungen:**
- `dark_mode`: boolean
- `show_full_name`: boolean (false = Abkürzung anzeigen)
- `active_filters`: JSON-Objekt mit CP-, Typ- und Anzeigefiltern

---

## 5. Termin-Parsing-Logik

### 5.1 Eingabeformat (TUCaN-Format)

Der Nutzer fügt den Termintext aus TUCaN in ein Freitextfeld ein. Das Format ist tabellarisch mit einer Zeile pro Termin:

```
Nr\tDatum\tVon\tBis\tRaum\tLehrende
1\tMo, 13. Apr. 2026*\t08:55\t10:35\tS311/08\t...
2\tDi, 14. Apr. 2026\t09:50\t11:30\tS202/C205\t...
...
```

Hinweise:
- Die Kopfzeile (`Datum`, `Von`, `Bis`, `Raum`, `Lehrende`) ist optional.
- Felder sind primär tab-separiert; bei verloren gegangenen Tabs werden auch mehrere Leerzeichen als Trennung akzeptiert.
- Die Spalte `Lehrende` wird ignoriert.

### 5.2 Parsing-Algorithmus

```
1. Text zeilenweise splitten, leere Zeilen entfernen
2. Erste Zeile prüfen:
  - Wenn Kopfzeile (Datum/Von/Bis/Raum/Lehrende) erkannt → überspringen
3. Pro Terminzeile:
  a. Spalten extrahieren (Tab oder Mehrfach-Leerzeichen)
  b. Laufende Nummer (falls vorhanden) ignorieren
  c. Datum parsen
    - Sternchen am Ende → hasAsterisk = true
    - Deutschen Monatsnamen → Date-Objekt konvertieren
  d. time_from und time_to (HH:MM) parsen
  e. Raum extrahieren
    - Markdown-Link [Text](URL) → nur Text behalten
  f. Lehrende ignorieren
4. Nach Verarbeitung aller Blöcke:
   - Wenn mindestens EIN Termin hasAsterisk = true:
       → hasAsterisk = true  ⟹ type = 'Vorlesung'
       → hasAsterisk = false ⟹ type = 'Uebung'
   - Wenn KEIN Termin hasAsterisk:
       → Alle type = 'Vorlesung'
5. Appointments in DB speichern (bulk insert)
```

### 5.3 Monatsmapping (Deutsch)

```
Jan. → 1, Feb. → 2, Mär. → 3, Apr. → 4, Mai → 5, Jun. → 6,
Jul. → 7, Aug. → 8, Sep. → 9, Okt. → 10, Nov. → 11, Dez. → 12
```

---

## 6. REST API

**Base URL:** `http://localhost:4000/api`

### 6.1 Kurse

| Method | Endpunkt             | Beschreibung                              |
|--------|----------------------|-------------------------------------------|
| GET    | /courses             | Alle Kurse abrufen (inkl. Appointments)   |
| POST   | /courses             | Neuen Kurs erstellen                      |
| PUT    | /courses/:id         | Kurs bearbeiten                           |
| DELETE | /courses/:id         | Kurs löschen (cascade auf Appointments)   |
| PATCH  | /courses/:id/toggle  | is_active umschalten                      |

**POST /courses – Request Body:**
```json
{
  "name": "IT-Sicherheit",
  "abbreviation": "ITS",
  "cp": 6,
  "category_id": "uuid-...",
  "appointments_raw": "<TUCaN-Termintext>"
}
```

### 6.2 Kategorien

| Method | Endpunkt          | Beschreibung                                    |
|--------|-------------------|-------------------------------------------------|
| GET    | /categories       | Alle Kategorien abrufen                         |
| POST   | /categories       | Neue Kategorie erstellen                        |
| PUT    | /categories/:id   | Kategorie bearbeiten                            |
| DELETE | /categories/:id   | Kategorie löschen (Kurse → category_id = NULL)  |

**DELETE /categories/:id – Response bei betroffenen Kursen:**
```json
{
  "warning": true,
  "affected_courses": ["IT-Sicherheit", "Kryptographie"],
  "message": "Diese Kurse werden auf 'Ohne Kategorie' gesetzt."
}
```
→ Frontend zeigt Bestätigungsdialog; DELETE wird erst nach Bestätigung mit `?confirm=true` erneut gesendet.

### 6.3 Einstellungen

| Method | Endpunkt    | Beschreibung             |
|--------|-------------|--------------------------|
| GET    | /settings   | Alle Einstellungen laden |
| PUT    | /settings   | Einstellungen speichern  |

### 6.4 Export & Import

| Method | Endpunkt       | Beschreibung                                      |
|--------|----------------|---------------------------------------------------|
| GET    | /export/json   | Gesamtdaten als JSON exportieren                  |
| POST   | /import/json   | JSON-Datei importieren (ersetzt alle Daten)       |
| GET    | /export/ics    | Gefilterte Termine als ICS-Datei exportieren      |

**GET /export/ics – Query-Parameter:**
```
?cp=3,6          → CP-Filter (kommagetrennt; leer = alle)
?types=Vorlesung → Typ-Filter
?courses=id1,id2 → Nur diese aktiven Kurse
```

**ICS-Felder pro VEVENT:**
- `SUMMARY`: Kursname oder Abkürzung (je nach `show_full_name`-Setting)
- `DTSTART` / `DTEND`: Datum + Uhrzeit (Europe/Berlin)
- `LOCATION`: Raum
- `DESCRIPTION`: "Kategorie: X | CP: Y"
- `UID`: Appointment-ID + @stundenplan

---

## 7. Frontend – Seitenstruktur

```
/                    → Kalender-Hauptseite
/courses/new         → Kurs erstellen
/courses/:id/edit    → Kurs bearbeiten
/categories          → Kategorien verwalten
```

### 7.1 Kalender-Hauptseite (`/`)

**Layout:** Zweispaltig – linke Sidebar (Filter) + rechter Kalenderbereich

#### Sidebar – Filterbereich

**Abschnitt: Kursauswahl**
- Liste aller Kurse mit Toggle-Switch (is_active)
- Farb-Dot der zugehörigen Kategorie
- Button „+ Kurs hinzufügen" → navigiert zu `/courses/new`

**Abschnitt: CP-Filter** (Checkboxen)
- [ ] 3 CP
- [ ] 6 CP
- [ ] Andere

**Abschnitt: Typ-Filter** (Checkboxen)
- [ ] Vorlesungen ausblenden
- [ ] Übungen ausblenden

**Abschnitt: Anzeigeoptionen** (Checkboxen)
- [ ] Raum anzeigen
- [ ] Typ anzeigen
- [ ] Uhrzeit anzeigen (Von–Bis zusammen)

**Globale Toggles (oben in der Navbar):**
- Name/Abkürzung Toggle (Vollständiger Name ↔ Abkürzung)
- Dark Mode Toggle (Mond/Sonne Icon)

**Export-Button:** „📥 ICS exportieren" – exportiert gefilterte Ansicht

#### Kalenderbereich

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
