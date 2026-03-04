# 2026-03-04 – WAN Workflow Parameter-Mapping Fix

## Gemeldete Probleme
1. `width/height/fps/frames/steps` aus WF Studio wurden in WAN-Workflows nicht wirksam (im Template hart verdrahtet).
2. `WAN Animate I2V` hatte in der App nur ein Bild-Input, braucht aber zusaetzlich Pose-Video.

## Umsetzung

### 1) I2V Meta korrigiert
Datei:
- `workflows/videos/Wan_Animate_I2V.meta.json`

Aenderung:
- Input `PoseVidAssetId` (type `video`, required) hinzugefuegt.

### 2) I2V API-Template korrigiert
Datei:
- `workflows/videos/Wan_Animate_I2V.api.json`

Aenderungen:
- kaputten Placeholder korrigiert:
  - `{PoseVidAssetAbsPath}}` -> `{{PoseVidAssetAbsPath}}`
- feste Werte auf WF-Studio-Parameter umgestellt:
  - `value: 1280/720/81` -> `{{width}}/{{height}}/{{frames}}`
  - `steps: 4` -> `{{steps}}`
  - `force_rate/frame_rate/fps: 25` -> `{{fps}}`

### 3) V2V API-Template parameterisiert
Datei:
- `workflows/videos/Wan_Animate_V2V.api.json`

Aenderungen:
- feste Werte auf WF-Studio-Parameter umgestellt:
  - `value: 1280/720/81` -> `{{width}}/{{height}}/{{frames}}`
  - `length: 81` -> `{{frames}}`
  - `steps: 4` -> `{{steps}}`
  - `force_rate/frame_rate/fps: 25` -> `{{fps}}`

## Erwartetes Ergebnis
- WF-Studio-Settings fuer Aufloesung/FPS/Frames/Steps greifen jetzt in beiden WAN-Workflows.
- I2V bietet den fehlenden Pose-Video-Input in der App an.