# Agent-Workflow-Checkliste (Kurz)

## Ziel
Immer gleicher, reproduzierbarer Ablauf pro Feature/Fix.

## 1) Bauen
- Änderung umsetzen
- Scope klein halten (ein klarer Block)

## 2) Prüfen
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run validate:workflows` (wenn relevant)
- Optional: kurzer manueller Smoke-Test

## 3) Dokumentieren
- Neue Doku-Datei in `DOKUMENTATIONEN/YYYY-MM-DD-<Thema>.md`
- `Kontext-Aktuell.md` aktualisieren (aktueller Stand)
- `Abgeschlossende_Aufgabe.md` um den Block ergänzen
- Falls sinnvoll: `CHANGELOG.md` ergänzen

## 4) Git
- `git add -A`
- `git commit -m "<präzise Message>"`
- `git pull --rebase origin main`
- `git push origin main`

## 5) Workspace-Sync für Agent
Quelle:
- `D:\OpenClaw\workspace\Projekte\AI-FilmStudio`

Ziel:
- `D:\Coding\Projekte\FS-workspace\Film-Studio_v1`

Mit Ausschlüssen:
- `.git`
- `node_modules`
- `.npm-cache`
- lokale Backup-Ordner

## 6) Abschlussstatus (Pflicht)
Kurz im Chat melden:
- Was wurde gemacht
- Ergebnis der Checks
- Commit-Hash
- Sync-Status
