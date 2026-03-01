Ziel: Nach dem Refactor das Projekt härten und aufräumen. KEINE neuen Features. Verhalten identisch halten, außer dort, wo es explizit gefordert ist (Security/Local-only).

Regeln:
- Arbeite in PR-großen Paketen (A, B, C, D). Immer nur EIN Paket zur Zeit.
- Maximal 6 Commits pro Paket.
- Nachdem du ein Paket fertiggestellt hast: STOPPEN und auf Bestätigung vom User warten, bevor du das nächste Paket beginnst.
- Starte Paket B/C/D NICHT, bevor der User Paket A/B/C getestet und freigegeben hat.
- Dokumentiere jeden Schritt fortlaufend in: DOKUMENTATIONEN/Refactor_Hardening.md
  (ausgeführte Commands, geänderte Dateien, Ergebnisse). ALLES auf DEUTSCH.

Am Ende jedes Pakets musst du liefern:
1) Eine kurze „Übergabe-Zusammenfassung“:
   - Was wurde geändert und warum (Bulletpoints)
   - Liste der geänderten Dateien
   - Exakte Commands, die du ausgeführt hast + Ergebnisse
2) Eine „User-Test-Checkliste“ (manueller UI Smoke-Test):
   - New Project
   - Import Video
   - Preview Playback
   - Proxy Toggle
   - Workflow Studio: Katalog sichtbar
   - Optional: Comfy Health (falls ComfyUI lokal läuft)
3) Git-Commands für den User zum Review & Push:
   - git status
   - git diff --stat
   - git log --oneline -n 20

Deliverables: 4 Pakete in genau dieser Reihenfolge.

Paket A: README & Doku aktualisieren
- README.md so aktualisieren, dass es den echten Feature-Stand widerspiegelt (Timeline/Preview/FFmpeg/Workflow Studio/ComfyUI Bridge).
- Quickstart-Commands ergänzen und scripts/smoke.md verlinken.
- DOKUMENTATIONEN/Refactor_process.md Kopf/Status korrigieren, damit er dem aktuellen Stand entspricht (keine veraltete PR-Nummer).

Paket B: ESLint „grün“ machen
- npm run lint muss lokal durchlaufen.
- dist/out/build Artefakte korrekt ignorieren.
- Korrekte env/globals für main/preload/renderer setzen.
- Möglichst minimal ändern. Keine Regeländerungen, die die Codebase „neu definieren“.

Paket C: Electron Security Baseline (explizit + Dev/Prod sauber trennen)
- In BrowserWindow webPreferences explizit setzen:
  - contextIsolation: true
  - nodeIntegration: false
  - sandbox: true (falls kompatibel)
- Aktuelles Dev-Verhalten nur wenn nötig: webSecurity darf im Dev gelockert sein, in Production muss es true sein.
- webviewTag NICHT aktivieren, außer es ist absolut notwendig.
- Security nicht schwächen, nur damit „es läuft“.

Paket D: „Local-only“ technisch erzwingen
- COMFYUI_BASE_URL Host-Allowlist erzwingen: localhost, 127.0.0.1, ::1.
- Wenn Remote nötig ist: explizites Opt-in Setting + Warnhinweis implementieren; ansonsten mit klarer Fehlermeldung ablehnen.
- Standardmäßig keine stillen Netzwerkanfragen zu externen Zielen.

Harte Anforderung: Verhalten außerhalb Paket C/D identisch lassen. Innerhalb der Pakete keine unnötigen Refactors, nur was für das Ziel erforderlich ist.
Nach Abschluss von Paket A: STOPPEN und auf User-Test + Freigabe warten.