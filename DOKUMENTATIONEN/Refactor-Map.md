# Refactor-Map: Zielbild (Ordner + Verantwortlichkeiten)

## A) `apps/desktop/src/main` (Electron Main) splitten

**Heute:** `apps/desktop/src/main/index.ts` ist “God-File” (Projekt, Assets, ffmpeg, proxy, workflows, comfy bridge, IPC). 
**Ziel:** kleine Services + ein IPC-Router.

**Zielstruktur**

```
apps/desktop/src/main/
  index.ts                 # boot, window, ipcRouter wiring
  ipc/
    registerIpc.ts         # bindet alle handler
    channels.ts            # string constants
  services/
    projectService.ts      # new/load/save + migrations
    assetService.ts        # import, thumbnails, file-url/data-url
    ffmpegService.ts       # health + proxy generation
    workflowCatalogService.ts # list meta + template exists checks
    comfyService.ts        # health, queue-run, events, polling
  lib/
    paths.ts               # projectRoot, safeJoin, normalize
    json.ts                # readJson, writeJson, safeParse
    placeholders.ts        # template substitution ({{...}})
    mime.ts                # ext -> mime mapping
    hash.ts                # deterministic proxy naming
  types/
    ipc.ts                 # internal handler types (optional)
```

### Warum genau so?

* Das entspricht exakt dem, was bereits implementiert ist (Health, Queue, Proxy, Catalog), nur **entknotet**. 
* Du bekommst **testbare Units**, statt “alles hängt zusammen”.

---

## B) `apps/desktop/src/preload` als “Bridge-only” halten

**Ziel:** Preload macht **nur** typed forwarding, keine Logik.

**Zielstruktur**

```
apps/desktop/src/preload/
  index.ts           # exposeInMainWorld api
  api/
    projectApi.ts
    comfyApi.ts
    workflowApi.ts
    ffmpegApi.ts
  types.ts           # Window typings (oder im renderer/env.d.ts)
```

> Wichtig: Deine Runtime-Guards gegen “old preload” bleiben, aber sie gehören eher in einen kleinen Helper im Renderer (nicht quer im Store). 

---

## C) `apps/desktop/src/renderer/src/core` Domain-sliced

**Heute:** `studioStore.ts` wird langsam “Main-Store-God-Object” (Project + Assets + Timeline + Preview + Comfy + Workflow Studio). 
**Ziel:** Store bleibt **zentral**, aber **Slices** pro Domain.

**Zielstruktur**

```
apps/desktop/src/renderer/src/core/
  store/
    studioStore.ts          # compose slices (zustand)
    slices/
      projectSlice.ts
      assetsSlice.ts
      timelineSlice.ts
      transportSlice.ts
      previewSlice.ts
      comfySlice.ts
      workflowStudioSlice.ts
    selectors/
      timelineSelectors.ts
      previewSelectors.ts
  engine/                   # timelineEngine.ts bleibt
  commands/                 # timelineCommands.ts bleibt
  adapters/
    ipcClient.ts            # wraps window.api with runtime guards
    projectApi.ts
  comfy/
    contracts/              # (optional) keep workflowContracts here
  model/
  utils/
```

### Gute Nachricht:

Die Domain-Grenzen sind im Projekt **bereits sichtbar** (Timeline Engine/Commands, Preview, Comfy, Workflow-Studio). Du musst sie nur sauber ziehen. 

---

# IPC-Contracts: Was wir offiziell machen (und was NICHT)

Du hast aktuell mehrere IPCs, die logisch zusammengehören (Projekt, Assets, ffmpeg, workflows, comfy). 
Ziel: **ein** Ort der Wahrheit (shared package), ein “channels.ts” im Main.

## 1) Shared Contracts (packages/shared)

**Neu/ausbauen:**

```
packages/shared/src/ipc/
  channels.ts        # "project:new", "comfy:queue-run" etc.
  project.ts         # request/response types
  assets.ts
  ffmpeg.ts
  workflows.ts       # ihr habt workflows.ts schon, erweitern ok
  comfy.ts           # comfy.ts existiert schon, beibehalten
packages/shared/src/index.ts
```

### Regeln

* Renderer importiert **nur** Shared Types.
* Main & Preload hängen sich ebenfalls an Shared Types.
* Keine “random string channels” in 5 Dateien.

## 2) IPC Channel-Namespace (konkret)

* `project:*` → new/load/save/getRoot
* `assets:*` → importVideo/importImage, thumbnailDataUrl, fileUrl, mediaDataUrl
* `ffmpeg:*` → health, ensureProxy
* `workflows:*` → listCatalog, importTemplate (falls du das noch willst)
* `comfy:*` → health, queueRun, runEvent

(Dein Repo ist schon grob so, wir machen’s nur offiziell + konsistent.) 

---

# Reihenfolge der Moves (PR-Plan, ohne alles zu zerlegen)

Das ist der Teil, wo Menschen normalerweise panisch werden. Wir machen das in **kleinen PRs**, die jeweils grün bleiben.

## PR 0: Guardrails (1h)

* CI: `typecheck`, `lint`, `build` (minimal)
* “golden smoke script” in README oder `scripts/smoke.md`
  Warum: Danach kannst du refactoren ohne blind zu werden. (Ja, das ist langweilig. Genau deswegen ist es wichtig.)

## PR 1: Main split (nur mechanisch, keine Logikänderung)

**Ziel:** `apps/desktop/src/main/index.ts` entleeren, Funktionalität identisch.

* Extrahiere: `ffmpegService.ts` (health + ensure proxy)
* Extrahiere: `assetService.ts` (thumbnail + file/media url)
* `registerIpc.ts` sammelt die handler
  **Akzeptanz:** App startet, Import + Preview läuft, Proxy-Mode läuft. 

## PR 2: ComfyService isolieren

* Alles Comfy (health, queue-run, polling, run-event push) nach `services/comfyService.ts`
* `registerIpc` bindet `comfy:*` routes
  **Akzeptanz:** WF Studio “Send to ComfyUI” funktioniert weiterhin. 

## PR 3: WorkflowCatalogService isolieren

* `project:list-workflow-catalog` Logik raus in `workflowCatalogService.ts`
* Parsing/Validation bleibt 1:1
  **Akzeptanz:** WF Studio listet & zeigt Metas, templateExists warnings bleiben. 

## PR 4: Renderer IPC Client Wrapper (stabiler als Store-Guards)

**Heute:** Store hat runtime-guards für fehlende Preload APIs. 
**Ziel:** `core/adapters/ipcClient.ts`

* exportiert z.B. `ipc.comfy.queueRun` etc.
* macht “exists?” checks + wirft typed errors oder liefert “unavailable”
  **Akzeptanz:** Kein Crash mit altem preload, aber Store bleibt sauber.

## PR 5: Store slicing (die große, aber kontrollierte OP)

**Reihenfolge:**

1. `timelineSlice` + `transportSlice` (am stabilsten, reine Renderer-Logik) 
2. `projectSlice` + `assetsSlice` (New/Load/Save/Import) 
3. `previewSlice` (source lock, proxy bypass, caching) 
4. `comfySlice` (health + runs + bind events) 
5. `workflowStudioSlice` (catalog, selection, params, send) 

**Akzeptanz:** UI identisch, keine Featureänderung, nur file moves + imports.

## PR 6: Tighten Types + AJV strict plan (optional, später)

* AJV strict aktuell false im Main (laut Snapshot). 
* Erst Schemas stabilisieren, dann strict hochziehen.

---

# Konkrete Schnittstellen je Service (damit es nicht schwammig bleibt)

## main/services/projectService.ts

* `newProject(rootDir, name): Project`
* `loadProject(projectJsonPath): Project`
* `saveProject(projectJsonPath, project): void`
* `migrateProjectIfNeeded(project): Project` (v1→v2)

## main/services/assetService.ts

* `importAsset({kind, sourcePath, projectRoot}): Asset`
* `getThumbnailDataUrl(relativePath): string`
* `getAssetFileUrl(relativePath): string`
* `getAssetMediaDataUrl(relativePath): string`

## main/services/ffmpegService.ts

* `health(): { ok, version?, error? }`
* `ensureVideoProxy(relativeVideoPath, projectRoot): { proxyRelativePath, didBuild }`

## main/services/workflowCatalogService.ts

* `listCatalog(projectRoot): WorkflowCatalogResponse`
* (validiert `.meta.json`, findet `.api.json`, warning list)

## main/services/comfyService.ts

* `health(comfyBaseUrl): Health`
* `queueRun({workflowId, params, assetMap}, projectRoot): {runId, promptId}`
* `startPolling(promptId, onEvent)` / `stopPolling(runId)`
  (Genau wie jetzt, nur aus `index.ts` raus.) 

---

# Zwei kritische Warnungen (weil sonst wird’s später hässlich)

1. **Dev `webSecurity: false`** ist okay, aber MUSS klar dev-only bleiben. Du willst “komplett lokal”, aber nicht “komplett offen”. 
2. Preview-Logik (data/file URL + source lock + proxy bypass) ist fragile Magie. Bitte nicht “optimieren” während des Refactors. Nur verschieben. 

---

