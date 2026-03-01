# Workflow Meta Vorlagen (Projekt-lokal zu verwenden)

Diese Dateien sind Vorlagen fuer den geplanten Scene-Editor / Workflow-Studio Umbau.

## Ziel-Ablage (projekt-lokal)

Die finalen Dateien sollen spaeter in **deinem Projektordner** liegen (dort wo auch `project.json` liegt), z. B.:

- `Projects\WSG\project.json`
- `Projects\WSG\workflows\videos\wan_animate_i2v.meta.json`
- `Projects\WSG\workflows\videos\wan_animate_i2v.api.json`

## Wichtiger Hinweis

- `*.meta.json` beschreibt nur die UI / benoetigten Inputs / Defaults.
- `*.api.json` ist dein exportierter ComfyUI API-Workflow.
- Die `inputs` sind in diesen Vorlagen absichtlich leer bzw. minimal vorbereitet.
- Du kannst sie spaeter selbst eintragen oder ich passe sie dir anhand deiner echten Workflows an.

## Geplante Kategorien

- `images`
- `videos`
- `audio` (spaeter)

