# 2026-03-08 - WorkflowStudio Node-Graph, Prompt-to-Scene Sidebar, Tab-State-Fix, Ollama Vision

## Ziel
Die zuletzt umgesetzten Funktionsbloecke strukturiert und dateibezogen dokumentieren, damit der Stand sauber ins Haupt-Repository uebertragbar ist.

## Umfang (zusammengefasst)
1. WorkflowStudio: Node-basierter Graph-Editor integriert.
2. WorkflowStudio: Input-Verbindungen (connect/disconnect) als Teil der Validierung.
3. Prompt-to-Scene Generator: gebaut, erweitert (Regen + Reorder) und aus Timeline in Sidebar verschoben.
4. AppShell: Tab-Wechsel so angepasst, dass View-State beim Wechsel erhalten bleibt.
5. Ollama/QwenVL: Bildanalyse -> Prompt-Text via IPC-Ende-zu-Ende integriert.

## Aenderungen im Detail

### 1) WorkflowStudio: Node-Graph-Editor
- Neue Datei:
  - `apps/desktop/src/renderer/src/features/workflows/NodeWorkflowEditor.tsx`
- Integration in Studio-Ansicht:
  - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - neuer Modus `form | graph`
  - UI-Toggle fuer Editor-Modus
  - Graph und Form teilen denselben Draft-/Send-Flow

Wirkung:
- Workflow-Inputs und Settings koennen visuell im Graph bearbeitet werden.
- Bestehende Send-Pipeline bleibt Source-of-Truth.

### 2) WorkflowStudio: Verbindungslogik + Validierung
- Dateiaenderungen:
  - `apps/desktop/src/renderer/src/features/workflows/NodeWorkflowEditor.tsx`
  - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
- Umgesetzt:
  - Input-Knoten connect/disconnect
  - required Inputs muessen verbunden sein
  - Validierung blockiert Send bei disconnected required Inputs
  - Verbindungsmatrix je Workflow im View-State

Wirkung:
- Graph-Kanten sind nicht nur visuell, sondern validierungsrelevant.

### 3) Prompt-to-Scene Generator (MVP + Erweiterung)
- Urspruenglich in Timeline eingebaut und danach in Sidebar verschoben.
- Finaler Ort:
  - `apps/desktop/src/renderer/src/features/workflows/PromptSceneGeneratorPanel.tsx`
- AppShell-Einbettung:
  - `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
- Timeline-Aufraeumung:
  - `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Selector-Erweiterung:
  - `apps/desktop/src/renderer/src/core/store/selectors/timelineSelectors.ts`

Umgesetzt:
- Prompt/Script -> Shotlist + Scene-1 Struktur
- `Apply Scene 1` erzeugt erste Clip-Struktur auf Video/Overlay-Track
- pro Shot: `Regen`
- Shot-Reihenfolge: Drag-and-drop
- Generator in rechte Sidebar verschoben, damit Timeline vollflaechig nutzbar bleibt

Wirkung:
- Deutlich besserer Workflow fuer Timeline-Arbeit (Generator blockiert Timeline nicht mehr).

### 4) Tab-State-Fix (Gallery/Views verlieren Eingaben nicht mehr bei Tabwechsel)
- Dateiaenderung:
  - `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
- Umgesetzt:
  - View-Logik von "hartes Umschalten via bedingtes Rendern" auf "gemountet bleiben + sichtbar/unsichtbar per CSS" umgestellt.

Wirkung:
- Eingegebene Zwischenstaende bleiben beim Wechsel zwischen Tabs stabiler erhalten.

### 5) Ollama Vision Integration (QwenVL)
- Shared IPC erweitert:
  - `packages/shared/src/ipc/project.ts`
  - `packages/shared/src/ipc/channels.ts`
- Main IPC:
  - `apps/desktop/src/main/ipc/registerIpc.ts`
  - `apps/desktop/src/main/index.ts`
- Preload + Renderer-Adapter:
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
- UI-Anbindung:
  - `apps/desktop/src/renderer/src/features/workflows/PromptSceneGeneratorPanel.tsx`

Umgesetzt:
- Neuer Flow: Bildasset waehlen -> Modell/Instruction setzen -> Ollama analyze
- Main sendet Base64-Bild an lokales Ollama (`/api/chat`)
- Antwort (`message.content`/`response`) wird als Prompt ins Generator-Feld uebernommen

Wirkung:
- Direkter "Image-to-Prompt"-Startpunkt in der App ohne externen Zwischenschritt.

## Verifikation
- `npm run lint` -> OK
- `npm run typecheck` -> OK
- `npm run build` -> OK
- `npm run validate:workflows` -> OK

## Hinweise / Restrisiken
- Ollama-Feature setzt laufenden lokalen Ollama-Dienst voraus.
- Modellname muss lokal vorhanden sein (z. B. `qwen2.5vl:latest`).
- Tab-State-Fix sorgt fuer Zustandserhalt, erhoeht aber potenziell gleichzeitigen Speicherverbrauch, weil mehrere Views gemountet bleiben.
