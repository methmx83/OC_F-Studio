# 📦 AI FilmStudio – Letzter Stand (21.02.2026)

## 0) Kurzfazit

- **UI-Shell (AppShell) läuft stabil** (Electron + Vite + React + Tailwind v3).
- Wir haben **Domain v2 eingeführt**: Timeline ist jetzt **Track-basiert** (professionelle NLE-Basis).
- Es gibt eine **v1 → v2 Migration** im Main-Prozess beim Laden von Projekten.
- TypeScript Monorepo ist jetzt **project-references-fähig** (keine TS6307/TS6305 mehr).
- **Typecheck ist grün** (`tsc -b`).
---

## 1) Projekt-Setup (aktuell)

- Monorepo mit **npm workspaces**
- Desktop App: `apps/desktop/`
- Renderer Root: `apps/desktop/src/renderer/src/`
- Stack:
  - Electron + electron-vite
  - React + TypeScript (strict)
  - Tailwind CSS v3.4.17
  - Node v22 (Windows 10/11)
- Aktiver Renderer-Entry:

```ts
// apps/desktop/src/renderer/src/main.tsx
import AppShell from "./ui/layout/AppShell";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
```

➡️ Bedeutet: **AppShell ist die aktive UI**
---

## 2) Neue abgeschlossende und/ oder aktive Phasen:

### Phase 1: ✅ `feature/timeline-engine-a1`
- Renderer-Core Scaffold (UI-unabhängig) vorbereitet:
  - `core/model/timeline.ts` (helpers + validation)
  - `core/model/errors.ts` (ValidationError)
  - `core/adapters/projectApi.ts` (Port-Interface Wrapper)
  - Platzhalter-Barrels in `core/engine` / `core/commands`
- Shared Types wurden dort **nicht** geändert (damals noch Timeline v1 mit `clips[]`).

### Phase 2: ✅ `feature/domain-v2-tracks`  **(aktuell aktiv / Hauptarbeit heute)**
Enthält die komplette **Domain v2 Einführung** inklusive Migration & TS-Config-Fixes.
Wichtige Commits:
- `feat(domain-v2): migration + ts project references + renderer fixes`
- `chore(renderer): remove legacy App.tsx`

Working tree: **clean**.
---

## 3) Domain v2: Track-basierte Timeline (Shared Contract)

### 3.1 Shared Types geändert
Datei: `packages/shared/src/types.ts`

**Neu:**
- `Clip` hat jetzt zusätzlich `offset: number`
- `Track` wurde eingeführt
- `Timeline` enthält jetzt **nur noch** `tracks: Track[]` (kein `clips[]` mehr)

Aktueller Kern:

```ts
export interface Clip {
  id: string;
  assetId: string;
  start: number;
  duration: number;
  offset: number;
}

export interface Track {
  id: string;
  kind: 'video' | 'overlay' | 'audio' | 'text';
  name: string;
  clips: Clip[];
}

export interface Timeline {
  tracks: Track[];
}
```

➡️ Damit ist die Basis für eine echte NLE-Timeline gelegt (Tracks als First-Class-Konzept).

### 3.2 JSON Schema v2 geändert
Datei: `packages/shared/project.schema.json`

- `schemaVersion.const = 2`, `default = 2`, `examples = [2]`
- `timeline.required = ["tracks"]`
- `tracks[]` enthält `id, kind, name, clips`
- `clips[]` enthält `id, assetId, start, duration, offset`
- `additionalProperties: false` gesetzt (strenger Contract)
---

## 4) Migration v1 → v2 im Main-Prozess (Phase B1)

Datei: `apps/desktop/src/main/index.ts`

### 4.1 Migration-Funktion
`migrateProjectToV2(project: unknown): unknown`

Logik:
- Wenn `schemaVersion === 2` → return as-is
- Wenn `schemaVersion === 1` → migrieren:
  - alte `timeline.clips[]` in **Default Track** packen
  - jedem Clip `offset: 0` geben
  - `schemaVersion = 2`
  - neue Struktur: `timeline: { tracks: [...] }`

Default Track:
- `id: "track_video_1"`
- `kind: "video"`
- `name: "Video Track"`

### 4.2 Einbindung im Load-Flow
- JSON wird gelesen + geparsed
- **Migration wird vor AJV Validation** ausgeführt
- Danach validiert AJV gegen Schema v2

### 4.3 New Project Creation angepasst
- Neue Projekte werden direkt als v2 erzeugt:
  - `schemaVersion: 2`
  - `timeline: { tracks: [] }`

### 4.4 Optionaler Sanity Check
- Runtime sanity helper vorhanden, gated über ENV:
  - `AI_VIDEO_EDITOR_RUN_MIGRATION_SANITY === '1'`
---

## 5) TypeScript Monorepo Fix: TS6307/TS6305 gelöst

Problem:
- `@shared/types` wird aus `apps/desktop` importiert.
- TS hat sich beschwert, weil `packages/shared/src/types.ts` nicht korrekt im Projekt inkludiert / referenced war.

Lösung:
1) `packages/shared/tsconfig.json` wurde auf **project references** vorbereitet:
   - `composite: true`
   - include: `src/**/*.ts`
2) `apps/desktop/tsconfig.node.json` bekam:
   - `"references": [{ "path": "../../packages/shared" }]`

3) Build-Mode Typecheck:
- Desktop typecheck nutzt jetzt:

```bash
tsc -b tsconfig.node.json tsconfig.web.json --pretty false
```

4) Wichtig: Shared einmal bauen, wenn nötig:
- `npx tsc -p packages/shared/tsconfig.json`
---

## 6) Renderer Fixes (für Typecheck)

### ComfyPanel Fix
- Fehler: `Cannot find name 'prev'`
- Wurde gefixt, damit Typecheck wieder grün ist.


## 8) Nächste Schritte (Roadmap ab jetzt)

### Phase B2 (kurz)
  - App startet
  - New Project erstellt v2 korrekt
  - Load eines v1 Projekts migriert korrekt
  - Typecheck bleibt grün

### Phase C (eigentliches Ziel)
**Timeline Engine v2 im Renderer** (Track-basiert):
- `core/engine/timelineEngine.ts` (immutable ops)
- add/move/remove clip **pro Track**
- overlap detection track-local
- trimming vorbereitet über `offset`
- typed errors (NotFound, Overlap, Validation)
- später Commands/Undo-Redo (Command Pattern)
---

## 9) Command Cheatsheet (für schnellen Start im neuen Chat)

```bash
# Typecheck
npm run typecheck --workspace @ai-filmstudio/desktop

# Shared build (falls TS6305 wieder auftaucht)
npx tsc -p packages/shared/tsconfig.json

# Branches
git branch
git status
```
---

## 10) Aktuelle Kernaussage:

> **UI-Shell steht stabil, Domain ist jetzt professionell (Tracks), Migration & TS-Setup sind sauber, als nächstes bauen wir die echte Timeline Engine v2.**