# Refactor Hardening

Letzte Aktualisierung: 2026-02-27
Status: Paket D abgeschlossen.
Quelle der Wahrheit: lokales Repo (`d:\AFS_Projects\AI-FilmStudio`)

## Ziel

Diese Datei dokumentiert die Hardening-/Cleanup-Pakete nach dem abgeschlossenen Refactor.

Vorgaben fuer diesen Lauf:
- Arbeiten in Paketen A, B, C, D
- Immer nur ein Paket zur Zeit
- Nach Paket-Abschluss stoppen und User-Freigabe abwarten

## Paket A - README & Doku aktualisieren

### Schritt 1 - Ist-Stand gelesen
Ausgefuehrte Commands:
- `Get-Content -Raw README.md`
- `Get-Content -Raw DOKUMENTATIONEN/Refactor_process.md`
- `if (Test-Path DOKUMENTATIONEN/Refactor_Hardening.md) { Get-Content -Raw DOKUMENTATIONEN/Refactor_Hardening.md }`

Ergebnis:
- README war veraltet (Scaffold-Text, out-of-scope Angaben zu Timeline/ComfyUI/FFmpeg nicht mehr korrekt).
- `Refactor_process.md` war inhaltlich weitgehend aktuell, Kopfstatus fuer den Uebergang in Hardening sollte praezisiert werden.

### Schritt 2 - README auf realen Stand gebracht
Ausgefuehrter Command:
- `Set-Content README.md` (Datei vollstaendig neu geschrieben, UTF-8)

Geaenderte Datei:
- `README.md`

Inhaltliche Anpassungen:
- Echter Feature-Stand dokumentiert (Timeline, Preview, FFmpeg, Workflow Studio, ComfyUI-Bridge).
- Quickstart fuer PowerShell auf npm-Basis ergaenzt.
- Guardrail-Commands (`typecheck`, `lint`, `build`) ergaenzt.
- Verlinkung auf `scripts/smoke.md` aufgenommen.
- Struktur-/Skriptabschnitte auf aktuellen Monorepo-Stand gebracht.

Ergebnis:
- README entspricht dem aktuellen Projektstand und dem geforderten Paket-A-Ziel.

### Schritt 3 - Refactor-Statuskopf korrigiert
Ausgefuehrter Command:
- `apply_patch` auf `DOKUMENTATIONEN/Refactor_process.md`

Geaenderte Datei:
- `DOKUMENTATIONEN/Refactor_process.md`

Inhaltliche Anpassung:
- Statuszeile auf abgeschlossene Refactor-Reihe PR0-PR12 und separaten Hardening-Track in `DOKUMENTATIONEN/Refactor_Hardening.md` umgestellt.

Ergebnis:
- Kein veralteter PR-Status im Dokumentkopf mehr.

### Schritt 4 - Paket-A-Dokumentation fortlaufend angelegt
Ausgefuehrter Command:
- `Set-Content DOKUMENTATIONEN/Refactor_Hardening.md`

Geaenderte Datei:
- `DOKUMENTATIONEN/Refactor_Hardening.md` (neu)

Ergebnis:
- Laufende Paketdokumentation vorhanden und auf Deutsch gepflegt.

### Schritt 5 - Abschlusskontrolle Paket A
Ausgefuehrte Commands:
- `Get-Content -Raw README.md`
- `Get-Content -Raw DOKUMENTATIONEN/Refactor_Hardening.md`
- `git diff --stat`
- `git status --short`

Ergebnis:
- README-Inhalt und Hardening-Dokument erfolgreich verifiziert.
- Paket-A-Diff ist wie erwartet auf Doku-/README-Aenderungen begrenzt.
- Zusaetzliche ungetrackte Datei festgestellt: `DOKUMENTATIONEN/PLAN-Projekt_haerten.md` (nicht durch diesen Lauf erstellt, bewusst nicht angefasst).

## Paket-A-Checks

Hinweis:
- Paket A betrifft nur Dokumentationsdateien.
- Es wurden keine Runtime-/Codepfade geaendert.
- Daher keine zusaetzlichen Build-/Lint-Laeufe in diesem Paket erzwungen.

## Paket B - ESLint "gruen" machen

### Schritt 1 - Baseline geprueft
Ausgefuehrte Commands:
- `rg --files -g "*eslint*"`
- `npm run lint`
- `Get-Content -Raw apps/desktop/eslint.config.js`
- `Get-Content -Raw packages/shared/eslint.config.js`

Ergebnis:
- Lint lief bereits gruen durch.
- Desktop-Config ignorierte `out/**`, aber `dist/**`/`build/**` waren nicht explizit enthalten.
- Explizite Globals fuer die drei Runtime-Bereiche (`main`, `preload`, `renderer`) waren nicht getrennt dokumentiert.

### Schritt 2 - Minimale ESLint-Haertung umgesetzt
Ausgefuehrter Command:
- `apply_patch` auf `apps/desktop/eslint.config.js`

Geaenderte Datei:
- `apps/desktop/eslint.config.js`

Inhaltliche Anpassungen:
- Ignore-Liste ergaenzt:
  - `dist/**`
  - `build/**`
  - bestehende Ignores (`out/**`, `src/**/*.js`, `**/*.d.ts`) beibehalten
- Runtime-Globals als Konstanten eingefuehrt:
  - `nodeRuntimeGlobals`
  - `browserRuntimeGlobals`
- File-spezifische Global-Overlays hinzugefuegt:
  - `src/main/**/*.ts` und `src/preload/**/*.ts` -> Node-Globals
  - `src/renderer/src/**/*.{ts,tsx}` -> Browser-Globals
- Keine fachliche Regel-Neudefinition:
  - bestehende Regelhaltung (`no-undef: off` fuer TS) unveraendert gelassen

Ergebnis:
- Ziel "minimal aendern, keine Codebase neu definieren" eingehalten.

### Schritt 3 - Paket-B-Validierung
Ausgefuehrte Commands:
- `npm run lint --workspace @ai-filmstudio/desktop`
- `npm run lint`

Ergebnis:
- Desktop-Lint: **OK**
- Root-Lint (alle Workspaces): **OK**
- Paket-B-Anforderung "npm run lint muss lokal durchlaufen" erfuellt.

## Paket C - Electron Security Baseline (Dev/Prod sauber getrennt)

### Schritt 1 - Ist-Stand geprueft
Ausgefuehrte Commands:
- `rg -n "createWindow|webPreferences|contextIsolation|nodeIntegration|sandbox|webSecurity|webviewTag" apps/desktop/src/main/index.ts`
- Codeausschnitt `apps/desktop/src/main/index.ts` (Bereich `createWindow`)
- `Get-Content -Raw apps/desktop/src/preload/index.ts`

Ergebnis:
- `webSecurity` war bereits dev/prod getrennt ueber `!isDevRenderer`.
- Sicherheitsrelevante `webPreferences` waren noch nicht explizit gesetzt (`contextIsolation`, `nodeIntegration`, `sandbox`, `webviewTag`).
- Preload nutzt `contextBridge`/`ipcRenderer` und ist fuer Security-Baseline geeignet.

### Schritt 2 - Security-Baseline explizit gesetzt
Ausgefuehrter Command:
- `apply_patch` auf `apps/desktop/src/main/index.ts`

Geaenderte Datei:
- `apps/desktop/src/main/index.ts`

Inhaltliche Anpassungen:
- `webPreferences` explizit gesetzt:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webviewTag: false`
- `webSecurity` explizit prod-sicher:
  - `const isProduction = !isDevRenderer`
  - `webSecurity: isProduction`
- Dev-Verhalten bleibt funktional gleich (nur in Dev gelockert), Production bleibt strikt.

Ergebnis:
- Paket-C-Ziel umgesetzt ohne neue Features.

### Schritt 3 - Paket-C-Validierung
Ausgefuehrte Commands:
- `npm run typecheck --workspace @ai-filmstudio/desktop`
- `npm run lint --workspace @ai-filmstudio/desktop`
- `npm run build --workspace @ai-filmstudio/desktop`

Ergebnis:
- Typecheck: **OK**
- Lint: **OK**
- Build: **OK**
- Bekannter Build-Hinweis unveraendert vorhanden (`@import`-Reihenfolge in `styles.css`), kein Abbruch.

## Paket D - "Local-only" technisch erzwingen

### Schritt 1 - Comfy-Netzwerkpfade analysiert
Ausgefuehrte Commands:
- `rg -n "resolveComfyBaseUrl|COMFYUI_BASE_URL|queueComfyRun|getComfyHealth|importComfyOutput|/view|/prompt|/history" apps/desktop/src/main`
- `Get-Content -Raw apps/desktop/src/main/services/comfyService.ts`
- Codeausschnitt `apps/desktop/src/main/index.ts` (`importComfyOutput`)

Ergebnis:
- `resolveComfyBaseUrl()` nutzte bisher nur `COMFYUI_BASE_URL` oder Fallback, ohne Host-Policy.
- Comfy-Netzwerkzugriffe liefen ueber:
  - `getComfyHealth` (`/system_stats`)
  - `queueComfyRun` (`/prompt`, `/history/...`)
  - `importComfyOutput` (`/view`)
- Damit war Local-only noch nicht technisch erzwungen.

### Schritt 2 - Local-only Policy + explizites Opt-in umgesetzt
Ausgefuehrte Commands:
- `apply_patch` auf `apps/desktop/src/main/services/comfyService.ts`
- `apply_patch` auf `apps/desktop/src/main/index.ts`

Geaenderte Dateien:
- `apps/desktop/src/main/services/comfyService.ts`
- `apps/desktop/src/main/index.ts`

Inhaltliche Anpassungen:
- Neue zentrale Policy-Resolution in `comfyService`:
  - `resolveComfyBaseUrlPolicy()`
  - Allowlist fuer lokale Hosts: `localhost`, `127.0.0.1`, `::1`
  - Standard-URL bleibt lokal: `http://127.0.0.1:8188`
- Remote-Ziele werden standardmaessig blockiert:
  - klare Fehlermeldung mit Hinweis auf Opt-in
- Explizites Remote-Opt-in eingefuehrt:
  - Env: `COMFYUI_ALLOW_REMOTE=1` (auch `true`/`yes`)
  - bei aktivem Opt-in wird Warnhinweis in Messages angehaengt
- Netzwerkanfragen werden bei blockierter Policy frueh abgewiesen:
  - `getComfyHealth` liefert `online: false` + klare Policy-Message
  - `queueComfyRun` liefert `success: false` + failed-Run-Event mit Policy-Message
  - `importComfyOutput` bricht vor `/view`-Request mit klarer Fehlermeldung ab

Ergebnis:
- Standardpfad ist technisch local-only.
- Externe Ziele brauchen explizites Opt-in und erzeugen sichtbaren Warnhinweis.
- Keine stillen externen Requests mehr ohne Opt-in.

### Schritt 3 - Paket-D-Validierung
Ausgefuehrte Commands:
- `npm run typecheck --workspace @ai-filmstudio/desktop`
- `npm run lint --workspace @ai-filmstudio/desktop`
- `npm run build --workspace @ai-filmstudio/desktop`
- `rg -n "COMFYUI_ALLOW_REMOTE|LOCAL_COMFY_HOST_ALLOWLIST|blocked by local-only policy|resolveComfyBaseUrlPolicy|Comfy output import blocked" apps/desktop/src/main/services/comfyService.ts apps/desktop/src/main/index.ts`

Ergebnis:
- Typecheck: **OK**
- Lint: **OK**
- Build: **OK**
- Policy/Opt-in-Strings und Blockpfade im Code verifiziert.
- Bekannter Build-Hinweis (`styles.css` `@import`-Reihenfolge) unveraendert, ohne Build-Abbruch.
