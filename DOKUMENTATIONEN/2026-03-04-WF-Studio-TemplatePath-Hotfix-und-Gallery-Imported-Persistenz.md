# 2026-03-04 – WF Studio TemplatePath Hotfix + Gallery Imported Persistenz

## Anlass
Live-Test meldete in WF Studio beim Queue-Start:
`Failed to queue workflow: workflow template missing: workflows/Wan_IV2V.api.json`

## Ursache
Comfy-Queue las Templates nur ueber starres Muster `workflows/<workflowId>.api.json`.
Bei katalogbasierten Workflows liegt das Template aber in `workflows/<category>/<templateFile>` und kann vom Workflow-ID-Namen abweichen.

## Fix
1. `ComfyWorkflowRunRequest` erweitert um optionales Feld:
   - `workflowTemplateRelativePath`
2. WF Studio setzt dieses Feld beim Build des Requests aus dem Katalogeintrag (`w.templateRelativePath`).
3. ComfyService `readWorkflowTemplate(...)` nutzt bevorzugt diesen relativen Template-Pfad
   (mit Sicherheitschecks gegen absolute Pfade/`..`).
4. Fehlermeldung zeigt jetzt den realen erwarteten relativen Pfad.

## Zusatz (Teil 3 Wunsch)
Gallery Imported-Status wurde persistent gemacht:
- localStorage-Key: `ai-filmstudio.comfy.gallery.importedPaths`
- `new/imported` Filter und Badge nutzen Projekt-Assets + persistierte Pfade
- Import (single/selected/all-new) schreibt persistierte Markierung

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅