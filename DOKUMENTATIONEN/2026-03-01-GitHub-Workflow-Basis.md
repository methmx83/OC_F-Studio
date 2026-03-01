# 2026-03-01 – GitHub Workflow Basis

## Ziel
Grundlegende Wartungsstruktur im GitHub-Repo herstellen, damit die laufende Pflege reproduzierbar ist.

## Umgesetzt
- `.github/pull_request_template.md` erstellt
- Issue-Templates angelegt:
  - `.github/ISSUE_TEMPLATE/bug_report.md`
  - `.github/ISSUE_TEMPLATE/feature_request.md`
  - `.github/ISSUE_TEMPLATE/config.yml` (Blank-Issues deaktiviert)
- `CODEOWNERS` angelegt (`* @methmx83`)

## Nutzen
- Einheitliche PRs mit Mindest-Checks (Build, Typecheck, Doku)
- Strukturierte Issues für Bugs/Features
- Klare Eigentümerschaft

## Nächste sinnvolle Schritte
1. Labels im Repo anlegen: `bug`, `enhancement`, `tech-debt`, `priority:high`, `priority:medium`, `priority:low`.
2. Milestone `v0.1.0` erstellen.
3. Offene Punkte aus `DOKUMENTATIONEN/ToDo.md` in Issues überführen und priorisieren.
