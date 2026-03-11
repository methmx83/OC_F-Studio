# ToDo – Beta-Plan für Codex

Stand: 2026-03-09
Projekt: `AI-FilmStudio`
Ziel: Eine stabile, vorführbare Beta mit reproduzierbarem Build + Smoke-Flow.

---

## 0) Definition „Beta-fertig“ (Gate)

Beta ist fertig, wenn alle Punkte erfüllt sind:
1. `npm run lint` grün
2. `npm run typecheck` grün
3. `npm run build` grün
4. `npm run validate:workflows` grün
5. `scripts/smoke.md` Schritte 1–16 ohne Blocker durchlaufbar
6. Keine blocker-kritischen UI-Fehler in den Kernpfaden:
   - Projekt anlegen/laden/speichern
   - Asset-Import (Video/Bild/Audio)
   - Timeline-Playback + Audio
   - Workflow Studio Send + Output-Import

---

## 1) P0 – Muss für Beta (in dieser Reihenfolge)

### P0.1 Hardening: Persistenz + Recovery finalisieren
- [ ] Restore-/Autosave-Flow Endtest und Bugfixes in `SettingsView` + Store
- [ ] Klare Fehlertexte für Restore-Fehlerfälle (Datei fehlt/defekt/IO)
- [ ] Sicherstellen, dass nach Restore Timeline/Assets/Workflow-Zustand konsistent sind
- [ ] Doku aktualisieren: `DOKUMENTATIONEN/Kontext-Aktuell.md`

**Akzeptanz:** Wiederherstellung klappt zuverlässig, keine stillen Fehler, keine inkonsistenten Store-Zustände.

---

### P0.2 Workflow Studio: Produktionssicher machen
- [ ] „Send to ComfyUI“ robust gegen fehlende Inputs/Typfehler/Template-Probleme
- [ ] Fehlerzustände vereinheitlichen (einheitliche Codes + klare UI-Meldungen)
- [ ] `Recent Runs` stabil halten (Filter/Sortierung/Persistenz ohne Race Conditions)
- [ ] Output-Import robust machen (Duplikate, unsupported Files, Netzwerkfehler)

**Akzeptanz:** Kein stilles Scheitern; User sieht immer verwertbares Feedback + nächsten Schritt.

---

### P0.3 Preset-Dateimodus final absichern
- [ ] Konfliktfälle (`PRESET_CONFLICT`) End-to-End inkl. externen Dateiänderungen
- [ ] Invalid-JSON-Fälle robust (Warnung statt Crash)
- [ ] Keine Fallback-Nutzung von Browser-Storage für Presets
- [ ] Guard-Skript in CI-Lauf integrieren/prüfen

**Akzeptanz:** Dateibasierte Presets sind der einzige Pfad und bleiben auch unter Konflikt/Defekt stabil.

---

### P0.4 Timeline/Audio Beta-Polish
- [ ] Audio-Waveform Performance prüfen (lange Audios, viele Clips)
- [ ] Mute/Solo/Clear-M-S in Grenzfällen testen (mehrere Tracks + gleichzeitige Clips)
- [ ] Clip-Gain + Automation-Datenintegrität bei Undo/Redo/Cut/Ripple/Slip verifizieren
- [ ] Snapshot/Regression-Checkliste in `scripts/smoke.md` ggf. erweitern

**Akzeptanz:** Timeline bleibt responsive, Audio-Verhalten ist reproduzierbar und nicht destruktiv.

---

### P0.5 Release-Basics (Beta-Paket)
- [ ] Beta-Changelog-Eintrag erstellen (`CHANGELOG.md`)
- [ ] Bekannte Einschränkungen dokumentieren (`DOKUMENTATIONEN/Kontext-Aktuell.md`)
- [ ] Kurze „Beta Quickstart + Smoke“ Anleitung finalisieren (`README.md` + `scripts/smoke.md`)

**Akzeptanz:** Externe Tester können Setup + Kernprüfung ohne Rückfragen durchführen.

---

## 2) P1 – Sehr sinnvoll direkt nach P0

### P1.1 Inspector-Basis (MVP)
- [ ] Rechtes Inspector-Panel für selektierten Clip: Position/Scale/Opacity (MVP)
- [ ] Werte im Projektmodell persistieren
- [ ] Preview berücksichtigt die Werte live

### P1.2 Workflow Auto-Builder (MVP)
- [ ] Erster Parser für häufige Input-Typen aus Workflow-JSON (Number/Text/Enum)
- [ ] UI-Felder automatisch generieren, statt nur statischer Meta-Defaults
- [ ] Fallback-Strategie für unbekannte Knoten

### P1.3 Batch-Run (MVP)
- [ ] Mehrere Asset-Kombinationen seriell queuebar
- [ ] Ergebnisliste pro Batch-Item (success/failed + Retry)

---

## 3) P2 – Nicht Beta-blockend

- [ ] Keyframe-UI (Dope-Sheet-Stufe)
- [ ] Export-Modul (MP4/ProRes) mit robustem Job-Status
- [ ] Stock-Integration (z. B. Pexels)
- [ ] Multi-Timeline-Formate

---

## 4) Direkte Arbeitsaufträge für Codex (copy/paste)

### Auftrag A – Beta-Hardening Sprint
„Arbeite P0.1 bis P0.5 in Reihenfolge ab. Nach jedem Teil:
1) Code + Tests,
2) `lint/typecheck/build/validate:workflows` laufen lassen,
3) relevante Doku aktualisieren,
4) kurzen Status in `DOKUMENTATIONEN/Abgeschlossende_Aufgabe.md` eintragen.“

### Auftrag B – Workflow Studio Robustheit
„Fokussiere ausschließlich Workflow Studio (P0.2 + P0.3). Ziel: keine stillen Fehler, saubere Fehlermeldungen, stabile Preset-Dateiverwaltung unter Konflikten. Liefere zusätzlich eine kurze Testmatrix für Grenzfälle.“

### Auftrag C – Timeline/Audio Stabilität
„Bearbeite P0.4 vollständig. Prüfe Performance- und Datenintegrität bei Undo/Redo/Cut/Ripple/Slip. Ergänze `scripts/smoke.md` um die gefundenen Regression-Checks.“

---

## 5) Abschlussformat (verbindlich pro Task)

Jeder abgeschlossene Codex-Task muss enthalten:
1. **Geänderte Dateien**
2. **Warum geändert**
3. **Verifikation** (exakte Command-Ausgaben)
4. **Doku-Update**
5. **Rest-Risiko** (falls vorhanden)
