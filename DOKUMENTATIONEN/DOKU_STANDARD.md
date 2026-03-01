# DOKU_STANDARD.md

## Ziel
Vollstaendige, nachvollziehbare, wartbare Projektdokumentation.

## Verbindlicher Ablauf pro Task
1. **Bauen** (Implementierung)
2. **Pruefen** (mind. `npm run typecheck`, optional Build/Lint je nach Aenderung)
3. **Dokumentieren**
4. **Kurzer Statusbericht an Bro**

---

## Dokumentationsstruktur (verbindlich)

### 1) Projektplan (einmalig + bei groben Richtungswechseln)
Datei: `PROJEKT_PLAN.md`

Inhalt:
- Zielbild
- Featureliste
- priorisierte ToDos
- Phasen/Milestones

### 2) Abgeschlossene Aufgaben (laufend pflegen)
Datei: `Abgeschlossende_Aufgabe.md`

Pro Eintrag:
- Titel / Aufgabe
- Was wurde geaendert (Dateien + Kernpunkte)
- Verifikation (welche Checks liefen, Ergebnis)
- Wirkung/Ergebnis

### 3) Kontext-Aktuell (Arbeitsgedaechtnis fuer Agent)
Datei: `Kontext-Aktuell.md`

Muss immer enthalten:
- Letzter/Aktueller Stand
- Abgeschlossene Aufgaben (kurz)
- Anstehende Aufgaben
- Probleme + Fixes

---

## Versionsregel bei Wachstum
Wenn eine Datei zu gross/unklar wird:
- neue Datei beginnen, z. B. `Kontext-Snapshot-04.md` oder `Abgeschlossene_Aufgaben_2026-03.md`
- in der Hauptdatei oben auf die neue Datei verweisen

## Qualitaetsregel
Keine nicht-nachvollziehbaren Sammeltexte.
Jede relevante Aenderung muss Rueckverfolgung auf Dateiebene erlauben.
