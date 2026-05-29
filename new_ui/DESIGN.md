# DESIGN.md — Plani Family Design Language

## Overview

Plani is a family of two study-planning web apps for university students:

- **Lerni** (`lerni.plani.dev`) — Operational planner. Lectures, exams, exercises, study sessions, study groups, blockers, calendar export.
- **Semesti** (`semesti.plani.dev`) — Strategic planner. Which courses to take next semester. Aggregates info, surfaces overlaps and conflicts.

Both share one design language. They differ in navigation structure and content, but every token, component, and pattern is shared.

---

## Principles

1. **Apple-native.** We follow Apple HIG conventions: SF Pro, grouped backgrounds, 0.5px separators, vibrancy/blur materials, iOS-sized tap targets (44px), continuous corner radii, system tint colors for dark mode.
2. **The gradient is a hero, not a theme.** The pastel rainbow (violet → blue → mint → yellow) appears once per surface — the primary CTA, a progress bar, or the brand mark. Never as a background fill behind text.
3. **Dark-primary.** The brand lives on dark surfaces. Light mode is fully supported and uses Apple's standard grouped-background pattern (#F2F2F7 / #FFFFFF).
4. **Mobile-first, desktop-refined.** Layout is responsive. Sidebar collapses to a drawer on mobile. All touch targets ≥ 44px. Content reflows to single column below 768px.
5. **Calm and minimal.** Almost no copy. German-first. No emoji. No exclamation marks. Second-person where addressing the user ("Plane dein Semester.").

---

## Color System

### Surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-primary` | #FFFFFF | #000000 | Root background |
| `--bg-secondary` | #F2F2F7 | #1C1C1E | Grouped background |
| `--bg-tertiary` | #FFFFFF | #2C2C2E | Third level |
| `--bg-grouped` | #F2F2F7 | #000000 | Page background (grouped style) |
| `--bg-grouped-secondary` | #FFFFFF | #1C1C1E | Card on grouped bg |
| `--bg-elevated` | #FFFFFF | #1C1C1E | Elevated surfaces (sheets, popovers) |
| `--bg-input` | #E5E5EA | #2C2C2E | Input field background |

### Labels

| Token | Light | Dark |
|---|---|---|
| `--label-primary` | rgba(0,0,0,0.88) | rgba(255,255,255,0.92) |
| `--label-secondary` | rgba(60,60,67,0.60) | rgba(235,235,245,0.60) |
| `--label-tertiary` | rgba(60,60,67,0.30) | rgba(235,235,245,0.30) |
| `--label-quaternary` | rgba(60,60,67,0.18) | rgba(235,235,245,0.16) |

### Fills

| Token | Light | Dark |
|---|---|---|
| `--fill-primary` | rgba(120,120,128,0.20) | rgba(120,120,128,0.36) |
| `--fill-secondary` | rgba(120,120,128,0.16) | rgba(120,120,128,0.32) |
| `--fill-tertiary` | rgba(118,118,128,0.12) | rgba(118,118,128,0.24) |
| `--fill-quaternary` | rgba(116,116,128,0.08) | rgba(116,116,128,0.18) |

### Tint Colors (Apple system, adapted for dark)

| Name | Light | Dark |
|---|---|---|
| Blue | #007AFF | #0A84FF |
| Green | #34C759 | #30D158 |
| Red | #FF3B30 | #FF453A |
| Orange | #FF9500 | #FF9F0A |
| Yellow | #FFCC00 | #FFD60A |
| Purple | #AF52DE | #BF5AF2 |

### Brand Gradient

```
linear-gradient(135deg, #B7A0E5 0%, #9CC3F0 34%, #B6E3CC 68%, #F4E59A 100%)
```

**Usage rules:**
- ✅ Primary CTA (one per screen)
- ✅ Progress bars
- ✅ Brand mark / wordmark
- ✅ Premium/hero moments
- ❌ Background fills behind body text
- ❌ Multiple gradient elements per screen

### Subject Chips

Eight pastel colors for tagging courses. Rendered as tinted dots or low-opacity pills.

| # | Name | Hex |
|---|---|---|
| 1 | Violet | #B7A0E5 |
| 2 | Blue | #9CC3F0 |
| 3 | Cyan | #7FCFE0 |
| 4 | Mint | #B6E3CC |
| 5 | Lime | #D7E8A7 |
| 6 | Yellow | #F4E59A |
| 7 | Peach | #F2C8A0 |
| 8 | Rose | #F0AEC0 |

---

## Typography

**UI face:** SF Pro via system font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif`

**Display face (brand only):** `"New York", "Charter", "Iowan Old Style", Georgia, serif` — italic, semibold/bold. Only for the wordmark and at most one display moment per surface.

### Scale (Apple HIG)

| Name | Size | Weight | Use |
|---|---|---|---|
| Large Title | 34px | Bold (700) | Screen headers |
| Title 1 | 28px | Bold (700) | Section headers |
| Title 2 | 22px | Semibold (600) | Sub-sections |
| Title 3 | 20px | Semibold (600) | Card titles |
| Headline | 17px | Semibold (600) | List row titles |
| Body | 17px | Regular (400) | Default text |
| Callout | 16px | Regular (400) | Secondary body |
| Subhead | 15px | Regular (400) | Subtitles, dates |
| Footnote | 13px | Regular (400) | Supporting text |
| Caption 1 | 12px | Regular (400) | Timestamps, CP |
| Caption 2 | 11px | Regular (400) | Eyebrows, badges |

### Weights

Only four weights: Regular (400), Medium (500), Semibold (600), Bold (700).

---

## Spacing

4px base grid. Default gutter: 16px.

| Token | Value |
|---|---|
| sp-1 | 2px |
| sp-2 | 4px |
| sp-3 | 8px |
| sp-4 | 12px |
| sp-5 | 16px |
| sp-6 | 20px |
| sp-7 | 24px |
| sp-8 | 32px |
| sp-9 | 40px |
| sp-10 | 48px |
| sp-11 | 64px |
| sp-12 | 80px |

## Radii

| Token | Value | Use |
|---|---|---|
| sm | 8px | Small buttons, inputs |
| md | 12px | Cards, modals |
| lg | 16px | Large cards |
| xl | 20px | Hero cards |
| pill | 999px | Badges, toggles |

---

## Elevation

| Level | Light | Dark | Use |
|---|---|---|---|
| Card | `0 0.5px 0 rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)` | `0 0.5px 0 rgba(255,255,255,0.04) inset, 0 1px 3px rgba(0,0,0,0.3)` | Default cards |
| sm | soft 1px shadow | subtle drop | Segmented controls |
| md | 4px blur | " | Dropdowns |
| lg | 12px blur | " | Modals, sheets |

On dark surfaces, 0.5px separators do most of the work. Shadows are subtler.

---

## Components

### Buttons
- **Primary:** Blue tint background, white text
- **Secondary:** `fill-tertiary` background, primary text
- **Gradient:** The Plani gradient, dark text — one per screen max
- **Plain:** No background, blue text, zero padding (inline links)
- **Destructive:** `fill-tertiary` background, red text

Sizes: sm (30px), md (36px), lg (44px). Border radius follows size (8/10/12px).

### Segmented Control
Apple-style pill with active segment elevated via shadow. `fill-quaternary` track.

### Toggle
51×31px, green when on. 27px white knob.

### Cards
`bg-grouped-secondary` background, `radius-md` corners, `shadow-card`. Optional header with 0.5px separator.

### List Rows
Icon (32×32, radius-8, tinted bg) + title + subtitle + trailing. Separated by 0.5px lines.

### Event Chips
3px left border in subject color. Tinted background. Used in calendar grids and lists.

### Progress Bar
6px tall, `fill-quaternary` track, Plani gradient fill.

### Badges
Pill-shaped. Tinted background at ~12% opacity. 5px dot + label.

### Avatars
Gradient background, dark initials. 32px default, 56px for profile.

### Search Bar
`fill-quaternary` background, radius-10, with ⌘K shortcut badge.

---

## Layout

### Desktop (≥ 768px)
- **Sidebar:** 260px fixed, with brand, navigation, subject list, user footer
- **Topbar:** 50px, sticky, blurred material background
- **Content:** flexible, 24px padding

### Mobile (< 768px)
- Sidebar becomes a slide-out drawer with backdrop overlay
- Hamburger menu in topbar
- Content padding reduces to 16px
- Grid layouts collapse to single column

### Sidebar Structure
1. Brand mark + wordmark
2. Primary navigation (icon + label)
3. Subject list with color dots (Lerni) / Selected courses (Semesti)
4. User footer with avatar + name

---

## Navigation

### Lerni
| Screen | Icon | Description |
|---|---|---|
| Heute | clock | Today's timeline + focus card + progress |
| Diese Woche | calendar | 5-day calendar grid |
| Semester | grid | Semester-wide view |
| Fächer | book | Subject cards with progress |
| Einstellungen | settings | Profile, dark mode, blockers |

### Semesti
| Screen | Icon | Description |
|---|---|---|
| Semesterübersicht | layer | Course catalog with select/deselect |
| Stundenplan | grid | Generated timetable from selection |
| Konflikte | warning | Time and exam overlap detection |

---

## Motion

- **Ease:** `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (Apple default)
- **Spring:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (for playful micro-interactions)
- **Durations:** fast (150ms), base (250ms), slow (400ms)
- Sidebar slide: `var(--dur-base)`
- Toggle snap: `var(--dur-fast)`
- Progress fill: `var(--dur-slow)`

---

## Voice & Tone

- **Language:** German (Deutsch)
- **Tone:** Calm, minimal, almost no copy
- **Person:** Second-person where addressing ("Plane dein Semester")
- **No:** emoji, exclamation marks, marketing speak
- **Date format:** "Mo · 12. Mai · KW 20"
- **Time format:** 24h ("16:00")
- **Abbreviations:** Std. (Stunden), Min. (Minuten), T. (Tage), Bib (Bibliothek)

---

## File Reference

| File | Purpose |
|---|---|
| `plani-tokens.css` | All CSS custom properties (light + dark), reset, base styles |
| `shared-components.jsx` | React component library (Icon, AppleBtn, AppleCard, ListRow, Toggle, etc.) |
| `Lerni.html` | Interactive Lerni prototype (5 screens + login) |
| `lerni-screens.jsx` | Lerni screen components |
| `Semesti.html` | Interactive Semesti prototype (3 screens + login) |
| `semesti-screens.jsx` | Semesti screen components |
| `assets/` | Brand icons |

---

## Two Apps, One System

Lerni and Semesti share:
- All tokens (colors, type, spacing, radii, shadows, motion)
- All base components (buttons, cards, lists, badges, progress, avatars, toggles)
- Sidebar + topbar shell structure
- Login screen pattern
- The Plani gradient as hero accent

They differ in:
- Navigation items (daily planning vs semester planning)
- Content screens (timeline vs course catalog)
- Sidebar secondary section (subject list vs selected courses)
- Wordmark ("Lerni." vs "Semesti.")
