# Changelog

## 2026-03-08

### Added
- WorkflowStudio Node-Graph Editor (`form|graph`) mit visuellen Nodes und Edge-Darstellung.
- Prompt-to-Scene Generator als Sidebar-Panel mit:
  - Shotlist-Generierung
  - Scene-1-Anlage auf Timeline
  - Shot-Regeneration (`Regen`)
  - Shot-Reihenfolge per Drag-and-drop
- Ollama Vision Integration (Image -> Prompt) ueber lokalen IPC-Ende-zu-Ende-Flow.

### Changed
- WorkflowStudio-Validierung erweitert: required Inputs muessen verbunden sein (connect/disconnect im Graph).
- AppShell-Tab-Routing angepasst: Views bleiben gemountet und werden per CSS sichtbar/unsichtbar geschaltet.
- Prompt-to-Scene UI aus Timeline nach rechts in die Sidebar verlagert, damit Timeline-Flaeche frei bleibt.

### Fixed
- Zustandverlust bei Tabwechsel deutlich reduziert (insb. Gallery/Workflow-Eingaben), da aktive Views nicht mehr bei jedem Wechsel neu gemountet werden.

### Verification
- `npm run lint` OK
- `npm run typecheck` OK
- `npm run build` OK
- `npm run validate:workflows` OK
