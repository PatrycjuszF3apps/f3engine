# Project Roadmap & Backlog (`ROADMAP.md`)

This document tracks completed milestones and outlines upcoming enhancements for **f3engine** and its demo suite.

---

## Completed Milestones

- [x] **M1: Core Virtual Viewport Engine (`engine/`)** – Indexed framebuffer (`VirtualFramebuffer`), strict color palettes (`ColorPalette`), bitmap font rasterizer (`VirtualFont`), object-oriented UI decorator (`VirtualUIDecorator`), and swappable `Canvas 2D` / `WebGL` backends.
- [x] **M2: Decoupled Debug Bar (`degub_bar/`)** – Engine exposes DOM-agnostic `EngineDebugHooks`; `DebugToolbar` binds purely via hooks without engine awareness of debug HTML.
- [x] **M3: HTML5 Demo Launcher & Multi-Demo Switching (`demos/html5_launcher/`)** – Demo catalog supporting live switching and clean engine resets between **Snake (Classic)** and **Snake 2: Arena**.
- [x] **M4: Multi-Modal Controls & Retro Filters** – Keyboard, Gamepad API (with rumble), and virtual pointer controls across `None`, `CRT Scanlines`, and `Old Nokia` video filters.
- [x] **M5: Engine Versioning & Application Manifests (`engine/version.ts`)** – Semantic engine versioning (`ENGINE_VERSION`), per-application `manifest.json` (`AppManifest`) declaring target engine compatibility, and live Engine vs. Manifest version comparison in `DebugToolbar`.
- [x] **M6: Multi-Font Pixel-Mask Compilation & Multilingual Charset Support (`engine/VirtualFontCompiler.ts`, `scripts/compile-font.ts`)** – Ahead-of-time compilation of `.otb`/`.ttf`/`.bdf` bitmap fonts to 1-bit pixel masks (`VirtualFontSpec`), national character presets (`en`, `pl`, `de`, `cs`, `fi`, `latin-ext`), Unicode NFD diacritic synthesis, simultaneous multi-font rendering (`bodyFont` + `headingFont`), built-in engine default fonts (`engine/fonts/`), and game-bundled custom third-party fonts (`demos/games/snake2/fonts/`).
- [x] **M7: Hierarchical Application Node Graph, Normalized Input Router & Namespaced `UIKit.ClassicV1` Controls (`engine/nodes/`, `engine/input/`, `engine/ui/`)** – Scene/application node hierarchy (`Node`, `CanvasNode`, `ContainerNode`, `ControlNode`, `AppRootNode`, `NodeTreeProcessor`) with cascading parent-over-child state authority (`freeze`, `hide`, `resetState`, `unload`), node/tree lifecycle phase hooks (`BEFORE_UPDATE`, `AFTER_UPDATE`, `BEFORE_RENDER`, `AFTER_RENDER`), normalized `InputRouter` (`DIRECTION`, `ACTION`, `POINTER`), out-of-the-box composite controls in `UIKit.ClassicV1` (including cascading `ModalDialogNode` sub-dialogs, `SettingsDialogNode`, `MenuListControl`, `ResponsiveAppShellNode`), and full OOP rewrite of **Snake (Classic)** and **Snake 2: Arena**.

---

## Upcoming Iterations (Backlog)

### Stage 5: Retro Web Audio Synthesizer (`engine/SoundSynth.ts`)
> **Session Prompt:**
> *"Add a zero-dependency `SoundSynth` module to `engine/` using the Web Audio API to generate 8-bit chiptune sound effects (menu navigation, option toggle, apple pickup, and game over). Add a persisted Sound On/Off toggle to `SettingsDialogNode`."*

### Stage 6: 2D Virtual Particle SystemNode (`engine/nodes/ParticleSystemNode.ts`)
> **Session Prompt:**
> *"Add a `ParticleSystemNode extends CanvasNode` to `engine/` that renders pixel particles onto `IVirtualSurface` using active `ColorPalette` tokens. Mount it as a child node of `SnakeBoardNode` to trigger particle bursts when collecting apples and on collision."*

### Stage 7: Additional Arcade Demo (`demos/games/breakout/`)
> **Session Prompt:**
> *"Create a new playable demo in `demos/games/breakout/` extending `AppRootNode` and `CanvasNode` with `UIKit.ClassicV1` controls, and register it in `demos/html5_launcher/demoRegistry.ts` so users can switch between Snake, Snake 2, and Breakout in the launcher."*

### Stage 8: Local High Score Leaderboard Dialog (`UIKit.ClassicV1.LeaderboardDialogNode`)
> **Session Prompt:**
> *"Extend `StorageStore` usage in the demos to persist a Top 5 High Scores table (with score, difficulty, and date) and add a cascading `LeaderboardDialogNode` sub-dialog to the Title Dialog."*
