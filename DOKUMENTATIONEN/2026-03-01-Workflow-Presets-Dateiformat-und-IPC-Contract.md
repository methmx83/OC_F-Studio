# 2026-03-01 – Workflow-Presets: Dateiformat + IPC-Contract

## Ziel
Die offene Aufgabe „Workflow-Presets projekt-lokal statt `localStorage`“ wird fuer den naechsten Coding-Block mit einem verbindlichen Dateiformat und IPC-Vertrag vorbereitet.

## Scope dieses Schritts
- Definiert nur Contract + Datenformat + Fehlerverhalten.
- Keine Runtime-Implementierung in Main/Renderer in diesem Schritt.

## Projekt-lokaler Speicherort
- Pro Projekt: `Projects/<Projekt>/workflows/presets/`
- Pro Workflow-Datei: `<workflowId>.presets.json`

Beispiel:
- `Projects/WSG/workflows/presets/wan_animate_v2v.presets.json`

## Dateiformat (`<workflowId>.presets.json`)

```json
{
  "version": 1,
  "workflowId": "wan_animate_v2v",
  "updatedAt": "2026-03-01T09:30:00.000Z",
  "presets": [
    {
      "id": "p_fast_preview",
      "name": "Fast Preview",
      "createdAt": "2026-03-01T09:00:00.000Z",
      "updatedAt": "2026-03-01T09:15:00.000Z",
      "draft": {
        "width": 832,
        "height": 480,
        "fps": 12,
        "frames": 48,
        "steps": 16,
        "inputs": {
          "refIMGAssetId": "asset_123",
          "faceVidAssetId": "asset_456"
        }
      }
    }
  ]
}
```

## Regeln
- `version` ist Pflicht und startet bei `1`.
- `workflowId` muss dem Dateinamen entsprechen.
- `presets[].id` ist stabil (kein Name als Primärschluessel).
- `presets[].name` ist pro Workflow eindeutig (case-insensitive Vergleich).
- `draft` folgt dem bestehenden Workflow-Studio-Draft-Modell.
- Maximal 20 Presets pro Workflow (bestehende UI-Regel bleibt).
- JSON strikt valide (keine trailing commas).

## IPC-Contract (v1)

### 1) `project:list-workflow-presets`
**Input**
```ts
{ projectRoot: string; workflowId: string }
```

**Output**
```ts
{
  ok: true;
  source: 'file' | 'empty';
  filePath: string;
  version: 1;
  workflowId: string;
  presets: WorkflowPreset[];
  updatedAt: string | null;
}
```

### 2) `project:save-workflow-preset`
**Input**
```ts
{
  projectRoot: string;
  workflowId: string;
  preset: WorkflowPreset;
  expectedUpdatedAt?: string | null;
}
```

**Output**
```ts
{
  ok: true;
  filePath: string;
  workflowId: string;
  preset: WorkflowPreset;
  updatedAt: string;
  conflict: false;
}
| {
  ok: false;
  code: 'PRESET_CONFLICT';
  message: string;
  currentUpdatedAt: string;
}
```

### 3) `project:delete-workflow-preset`
**Input**
```ts
{ projectRoot: string; workflowId: string; presetId: string; expectedUpdatedAt?: string | null }
```

**Output**
```ts
{
  ok: true;
  filePath: string;
  workflowId: string;
  deletedPresetId: string;
  updatedAt: string;
  conflict: false;
}
| {
  ok: false;
  code: 'PRESET_CONFLICT';
  message: string;
  currentUpdatedAt: string;
}
```

## Konfliktverhalten (extern geaenderte Dateien)
- Write-Operationen nutzen `expectedUpdatedAt` als Optimistic Concurrency Token.
- Bei Mismatch: kein stilles Ueberschreiben.
- Rueckgabe: `PRESET_CONFLICT` + `currentUpdatedAt`.
- Renderer-UX:
  1. Hinweis anzeigen: „Preset-Datei wurde extern geaendert.“
  2. `Reload` anbieten.
  3. Optional `Erneut speichern (forciert)` erst in spaeterem Schritt.

## Fehlercodes (Main -> Renderer)
- `PRESET_FILE_INVALID_JSON`
- `PRESET_SCHEMA_INVALID`
- `PRESET_NAME_DUPLICATE`
- `PRESET_LIMIT_REACHED`
- `PRESET_NOT_FOUND`
- `PRESET_CONFLICT`
- `PRESET_IO_ERROR`

## Nicht-Ziele in diesem Schritt
- Kein File-Watcher.
- Keine Migration alter `localStorage`-Daten.
- Kein erzwungenes Merge-UI.

## Akzeptanz fuer diesen Vorbereitungsschritt
- Dateiformat ist schriftlich fixiert.
- IPC-Namen + Input/Output sind verbindlich beschrieben.
- Konflikt-/Fehlercodes sind eindeutig.
- Naechster Coding-Lauf kann ohne weitere Grundsatzklaerung starten.
