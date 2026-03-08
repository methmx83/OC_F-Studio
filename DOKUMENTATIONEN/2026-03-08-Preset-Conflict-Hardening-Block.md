# 2026-03-08 - Preset Conflict Hardening Block

## Ziel
Preset-Conflict-Handling im Workflow-Studio robust und deterministisch haerten, damit bei extern/parallelen Preset-Aenderungen kein inkonsistenter UI- oder Speicherzustand entsteht.

## Umgesetzter Scope

### 1) Konflikt-Erkennung stabilisiert
- Persistenz-Flow fuer Workflow-Presets haertet:
  - Kein erneutes automatisches Re-Save direkt nach Reload/Hydration.
  - Kein stilles Ueberschreiben lokaler Aenderungen bei Konflikt.
- Konfliktzustand wird als strukturierter State gehalten (`workflowId`, remote Presets, remote UpdatedAt, Message) statt als lose Banner-Message.
- Konflikt-Banner wird nur fuer den aktuell relevanten Workflow angezeigt.

### 2) Konflikt-Aufloesung UX verbessert
- Explizite Konflikt-Aktionen:
  - `Lokale Aenderungen behalten`
  - `Datei neu laden`
- Verstaendliche Status-/Fehlermeldungen fuer beide Wege.
- Buttons/Inputs waehrend Konflikt-Operationen deaktiviert.

### 3) State-Konsistenz gehaertet
- Synchronisation fuer Preset-Auswahl:
  - Wenn `selectedPresetId` nach Save/Reload/Delete nicht mehr existiert, wird Auswahl + Name konsistent zurueckgesetzt.
  - Wenn Preset weiterhin existiert, wird `presetName` auf den echten Preset-Namen synchron gehalten.
- Save/Reload/Apply/Delete laufen ohne haengende Konflikt-UI-Zustaende.

## Geaenderte Datei
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

## Technische Kernpunkte
- Neue Konflikt-Entitaet: `PresetConflictState`
- Guard gegen ungewuenschte Persist-Loops: `skipNextPresetPersistRef`
- Persist-Flow blockiert bei aktivem Konflikt bis explizite Aufloesung
- Neuer Resolver fuer Konflikt-ID aus Backend-Meldung: `parseConflictedWorkflowId(...)`
- Neue Resolve-Action: `onKeepLocalPresetChanges()`

## Verifikation
- `npm run lint` -> OK
- `npm run typecheck` -> OK
- `npm run build` -> OK
- `npm run validate:workflows` -> OK

## Restrisiken
- Konflikt-Resolver nutzt weiterhin message-basiertes Erkennen (`PRESET_CONFLICT` + Workflow-ID aus Message), weil der IPC-Response derzeit kein dediziertes Konfliktfeld liefert.
- Kein zusätzliches großes UX-Redesign; Fokus blieb bewusst auf Stabilitaet und Konsistenz.
