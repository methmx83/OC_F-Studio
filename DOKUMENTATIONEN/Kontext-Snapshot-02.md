# 📦 AI FilmStudio – Aktueller Stand (Stabile UI-Basis)

## 🔧 Projekt-Setup
**Monorepo mit npm Workspaces**

Root:
```
AI-Scene-editor/
```

Desktop App:
```
apps/desktop/
```

Renderer Root:
```
apps/desktop/src/renderer/src/
```

Electron + Vite + Tailwind v3.4.17
Node v22
Windows 10/11
---

## 🎨 UI-Status (funktioniert & stabil)

### Struktur im Renderer:
```
apps/desktop/src/renderer/src/
  main.tsx
  ui/
    layout/
      AppShell.tsx
    theme/
      tokens.css
  features/
    assets/
      AssetLibraryView.tsx
    preview/
      PreviewStage.tsx
    comfy/
      ComfyPanel.tsx
    timeline/
      TimelineDock.tsx
```
---

## ✅ Was aktuell funktioniert
* Electron startet sauber
* Renderer läuft über Vite
* Tailwind korrekt eingebunden
* UI Layout stabil (Dark Editor Look)
* Asset Library (Dummy Assets)
* Drag & Drop von Assets in Timeline (UI-only)
* Preview Stage (UI-only)
* Comfy Panel (UI-only)
* Basic Undo/Redo UI (Dummy)
* Navigation Tabs (Studio / Voice / Lab / Configs)
---

## ❌ Was noch NICHT existiert (bewusst)
* Keine Timeline Engine
* Keine Clip-Datenstruktur
* Keine Persistenz (kein project.json)
* Keine echte Asset-Verwaltung
* Keine echte ComfyUI-Bridge
* Keine FFmpeg Integration
* Kein IPC Layer aktiv
* Keine Undo/Redo Command-Architektur

Alles UI-first, Engine folgt.
---

## 🎯 Nächste geplante Schritte

→ Timeline Domain Model + echte Clip-Engine
---

## 🧠 Architektur-Entscheidung
Klare Trennung geplant:
UI Layer:

```
features/
ui/
```

Engine Layer (kommt als nächstes):

```
core/
  model/
  engine/
  commands/
```

Backend / Electron Layer:

```
main/
preload/
services/
```
---

## 🧱 Design-Entscheidungen
* Kein Cloud-API-Zeug
* Keine API Keys im Frontend
* Alles lokal
* KI-Funktionen nur lokal (ComfyUI / Ollama)
---


