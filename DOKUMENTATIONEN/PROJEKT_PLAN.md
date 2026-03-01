# Projektplan: AI FilmStudio

### Projektziel
Entwicklung eines **hybriden Video-Editors**, der klassische Schnittfunktionen mit einer tiefen Integration von **ComfyUI** verbindet. Das Tool fungiert als Desktop-Anwendung (via Electron oder Tauri) und nutzt **TypeScript** im Frontend sowie Python/ComfyUI-Workflows im Backend.


### Phase 1: Die Editor-Basis (Timeline & UI)
*   **Timeline-System: Erstelle eine Timeline, die mehrere Video- und Audiospuren (Mono/Stereo) unterstützt.
*   **Schnitt-Werkzeuge: Implementiere Funktionen für Trim, Cut, Slip, Snapping (Einrasten) und Rippling.
*   **Asset-Management: Ein System zum Importieren von Clips via Drag-and-Drop, inklusive Miniaturansichten (Thumbnails) und einer Ordnerstruktur zur Organisation.
*   **Inspector: Ein Bedienfeld auf der rechten Seite zur Steuerung von Transformationen (Skalierung, Position), Deckkraft (Opacity), Blurring und Mischmodi.

### Phase 2: Die ComfyUI-Schnittstelle ("The Bridge")
*   **Workflow-Integration:** Skript zum Einlesen von ComfyUI-Workflows (API-JSON) und automatische Generierung von UI-Eingabemasken (Slider, Textfelder).
*   **Queue-System:** Hintergrundverarbeitung von Render-Aufträgen, während der Editor aktiv bleibt.
*   **Extend with AI:** Rechtsklick-Funktion, um Clips zur KI-gestützten Verlängerung direkt an das "Generate"-Modul zu senden.

### Phase 3: Generative Features & KI-Tools
*   **Cinematography Tags:** Auswahl vordefinierter Tags für Kamerafahrten (Dolly, Track), Winkel und Beleuchtung.
*   **Image Annotation:** Tool zum Maskieren von Bildbereichen für gezielte KI-Bearbeitungen.
*   **LLM-Modul:** Integration von Sprachmodellen zur Unterstützung bei komplexen Prompts.

### Phase 4: Spezial-Funktionen & Export
*   **Keyframing:** Animationssystem inklusive eines **Dope Sheets** zur präzisen Bearbeitung von Keyframes.
*   **Stock-Integration:** Direkte Anbindung der Pexels-API für den Import von Videomaterial.
*   **Multi-Timeline-Support:** Unterstützung verschiedener Timeline-Formate (z. B. vertikal für Social Media) innerhalb eines Projekts.
*   **Export-Modul:** Support für MP4 und ProRes mit optionaler Hardwarebeschleunigung (Nvidia NVENC).
---

## Technischer Stack & Strategie
*   **Frontend:** React mit **TypeScript** (für Typsicherheit).
*   **Styling:** Tailwind CSS für ein professionelles "Dark Mode" Design.
*   **Backend:** Python-Skripte zur Kommunikation mit der ComfyUI-API.
*   **Rendering:** Nutze für die Timeline-Interaktionen dnd-kit oder als Basis, aber custom Canvas für das Rendering (Konva.js).
*   **Desktop-Wrapper: Electron + electron-vite. Dies ist notwendig, um auf lokale Dateipfade für ComfyUI zuzugreifen und Hardware-Beschleunigung wie NVENC zu nutzen.
*   **State Management: Nutze Zustand, um die Timeline-Daten (Clip-Positionen, Layer, Keyframes) global zu verwalten.
---

## Spezifische Programmier-Anweisungen

### Timeline-Logik
*   **professionelle NLE-Basis
*   **Datenmodell:** Erstellung des Interfaces `TimelineTrack` mit einer Liste von `TimelineClip`-Objekten (Eigenschaften: startTime, duration, sourcePath, offset).
*   **Clip-Eigenschaften: Jeder Clip braucht startTime, duration, sourcePath und offset.
*   **Editing-Algorithmen:
    - Snapping: Implementiere eine Funktion, die prüft, ob ein Clip beim Verschieben innerhalb eines Schwellenwerts (z. B. 10 Pixel) zum Ende eines anderen Clips springt.
    - Rippling: Wenn ein Clip gelöscht wird, berechne die Positionen aller nachfolgenden Clips neu, um die Lücke zu schließen.
    - Slipping: Programmiere eine Logik, bei der sich der In- und Out-Punkt des Inhalts ändert, die Position des Clips in der Timeline aber gleich bleibt.
*   **Schnitt-Algorithmen:** Implementierung von Snapping (Schwellenwert ca. 10 Pixel), Rippling (Lückenschluss) und Slipping (Inhalt verschieben bei fester Position).

### ComfyUI-Bridge
*   **Workflow-Parser: Schreibe ein Skript, das die exportierten API-JSON-Dateien von ComfyUI einliest.
*   **UI-Auto-Builder:** Der Service muss API-JSON-Dateien analysieren und automatisch passende React-Komponenten (Slider, Dropdown) für jeden Input-Knoten generieren.
   - Dynamische UI-Generierung: Der Service soll das JSON analysieren und für jeden Input-Knoten (z. B. Checkpoint-Selector, Seed-Feld, Text-Prompt) automatisch eine TypeScript-React-Komponente generieren.
*   **Queue-Manager:** Verwaltung von Websocket-Verbindungen für Echtzeit-Updates der Generierungen.


### Inspector & Animation (Keyframing)
- Anweisung: "Programmiere ein Keyframe-System für visuelle Parameter."
*   **Inspector-Komponente: Erstelle Regler für Transformation (Skalierung/Position), Opacity und Blurring.
*   **Keyframe-Logik: Speichere Werte als Zeitstempel-Paare (z. B. 0s: Opacity 100%, 2s: Opacity 0%).
*   **Interpolation: Nutze eine Library wie popmotion oder schreibe eigene Interpolations-Funktionen, um flüssige Übergänge zwischen Keyframes im Dope Sheet zu berechnen.

--------------------------------------------------------------------------------
### Spezial-Tools (Annotation & Stock)
- Anweisung: "Implementiere ein Canvas-Annotation-Tool und die Pexels-API-Integration."
*   **Annotation: Erstelle eine Overlay-Komponente, mit der Nutzer auf Standbildern zeichnen können (Maskierung), um Referenzen für das Quen 259 Modell zu senden.
---

## Profi-Ergänzungen für die Entwicklung

1.  **Asset-Organisation:** Funktion zum Markieren von Clips mit Farben (z. B. Blau für KI, Grün für Stock).
- Dein Asset-Management sollte nicht nur Dateien auflisten, sondern Metadaten speichern. Füge eine Funktion hinzu, mit der du Clips mit Farben markieren kannst (z. B. "Blau" für KI-generiert, "Grün" für Stock-Footage), um in der Timeline den Überblick zu behalten.

2.  **Intelligentes AI-Extend:** Automatisches Setzen des letzten Frames eines Clips als Referenzbild für die KI-Verlängerung.
- Per Rechtsklick einen Clip an das Generate-Modul senden.
• Ergänzung: Um dies "professionell" zu machen, sollte die App beim Senden an die KI automatisch den letzten Frame des Clips als Referenzbild (Initial Image) setzen. So stellt dein Tool sicher, dass die KI-Verlängerung nahtlos an das bestehende Material anknüpft.

3.  **Health Check:** Prüfung beim Start, ob ComfyUI läuft und alle benötigten Custom Nodes vorhanden sind.
- Da ComfyUI-Installationen auf jedem Rechner anders sind, ist die Pfadverwaltung oft ein Problem.
• Ergänzung (Profi-Tipp): Baue ein "System-Check"-Modul ein. Beim ersten Start prüft die App, ob ComfyUI läuft, ob die benötigten Custom Nodes installiert sind und ob die API-Schnittstelle erreichbar ist.

4.  **Proxy-System:** Erstellung niedrig aufgelöster Arbeitskopien für flüssiges Editing.
- Da KI-Videos oft sehr groß und rechenintensiv sind, solltest du über ein Proxy-System nachdenken. 
Dabei erstellt die App beim Import eine kleine, niedrig aufgelöste Kopie des Videos für die flüssige Bearbeitung in der Timeline. Erst beim finalen Export wird wieder das hochauflösende Original verwendet.

5.  **Dynamische UI-Generierung (Der "Auto-Builder"):
- Implementiere einen "UI-Parser". Dieser erkennt automatisch, ob ein Knoten im Workflow eine Zahl (Slider), ein Text (Textfeld) oder ein Auswahlmenü (Dropdown) ist. So kannst du neue Workflows in ComfyUI bauen, sie als API speichern, und sie erscheinen automatisch mit den richtigen Reglern in deinem Studio. (API-JSON-Dateien von ComfyUI lesen)

6.  **Das "Dope Sheet" für Animationen:
- Ein Keyframe-System allein reicht oft nicht aus. Ein Dope Sheet ermöglicht es dir, alle Keyframes eines Clips auf einer vertikalen oder horizontalen Liste zu sehen und sie zeitlich präzise zu verschieben, ohne den Clip selbst zu bewegen. Dies ist entscheidend, wenn du komplexe KI-Animationen (z. B. Kamerabewegungen) mit Effekten synchronisieren willst.


