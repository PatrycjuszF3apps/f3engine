# AGENTS.md — AI Agent Instructions (Vibecoding Standard)

This document defines the architectural boundaries, coding standards, and verification workflows for AI agents contributing to **f3engine**.

---

## 1. Project Philosophy & Layer Separation

The repository is structured into four strictly separated layers bundled into dedicated chunks via `vite.config.ts`:

1. **`engine/` (`dist/assets/engine-*.js`)** – Core 2D Virtual Viewport Engine:
   - **FORBIDDEN** to import anything from `degub_bar/` or `demos/`.
   - **FORBIDDEN** to query or reference any HTML/DOM context belonging to `degub_bar/`. The engine exposes `EngineDebugHooks` (`viewport.getDebugHooks()`) and remains completely blind to any surrounding debug UI.
   - Engine modules must remain reusable across any 2D HTML5 game or demo (e.g., Snake, Tetris, Breakout, Pong).

2. **`degub_bar/` (`dist/assets/debug-bar-*.js`)** – Standalone HTML Debug Bar:
   - Communicates with the engine exclusively through the `EngineDebugHooks` interface exported by `engine/`.
   - Displays live Engine version vs. Application Manifest target Engine version (`state.versionCheck`) and provides live controls for aspect ratio, virtual grid dimensions, window scale, UI scale, renderer backend (`Canvas 2D` / `WebGL`), palette inspection, virtual cursor coordinates, and demo switching/resetting.

3. **`demos/games/` (`dist/assets/demos-games-*.js`)** – Playable Demo Games:
   - `demos/games/snake/` – Classic 20×20 Snake demo (`manifest.json`).
   - `demos/games/snake2/` – Snake 2: Arena demo with obstacle pillars and dual targets (`manifest.json`).
   - Each demo provides an `AppManifest` declaring the compatible `engineVersion` and exports a mount function returning a `DemoSession` (`id`, `name`, `manifest`, `hooks`, `i18n`, `dispose()`).

4. **`demos/html5_launcher/` (`dist/assets/launcher-*.js`)** – HTML5 Demo Wrapper Application:
   - Initializes the viewport stage, mounts the active demo from `demoRegistry.ts`, and binds `DebugToolbar`.
   - Handles switching between demos and resetting the engine cleanly via `session.dispose()`.

---

## 2. Tech Stack & Commands

- **Environment**: Node.js `v20+`, Vite `6+`, TypeScript `5.7+` (strict mode), pure HTML5 Canvas / WebGL + CSS3 (zero external runtime UI frameworks).
- **Commands**:
  - `npm run dev` – Starts the Vite development server (`http://localhost:5173/`).
  - `npm run build` – Runs full TypeScript typechecking (`tsc`) and builds production bundles into `dist/`.
  - `npm run preview` – Serves the production build locally.
  - `npm run compile-font` – Compiles `.otb`/`.ttf`/`.bdf` bitmap fonts into `VirtualFontSpec` 1-bit pixel masks with national locale character presets (`en`, `pl`, `de`, `cs`, `fi`, `latin-ext`).

---

## 3. Coding Guardrails

1. **Zero Runtime Dependencies**: Do not install external runtime libraries when functionality can be cleanly implemented with standard Web APIs (`CanvasRenderingContext2D`, `WebGLRenderingContext`, `Gamepad API`, `localStorage`, `requestAnimationFrame`).
2. **Strict Typing**: `tsconfig.json` enforces `"strict": true`, `"noUnusedLocals": true`, and `"noUnusedParameters": true`. Every change must pass `npm run build` with zero warnings or errors.
3. **English-Only Code & Docs**: All Markdown documentation, code comments, JSDoc blocks, and identifiers must be written in English.
4. **Palette & Filter Consistency**: Every entity drawn onto `IVirtualSurface` must use semantic color tokens from `ColorPalette` and respect `palette.pixelated` (for the `Old Nokia` mode).
5. **Multi-Modal Input**: All interactive screens and menus must support keyboard (`Arrows`, `WASD`, `Enter`, `Escape`), gamepad, and mouse (`hover` + `click`).
6. **No Hardcoded UI Strings**: Always route user-facing text through `I18nManager.t(...)` and keep translations in JSON locale files (`locales/en.json`, `locales/pl.json`).
7. **Privacy & Public Repo Hygiene**: Never commit machine-specific paths, environment details, or local agent scratch files to documentation or source files.

---

## 4. Visual Verification Workflow (Chrome DevTools / MCP)

After modifying rendering logic, UI layouts, or CSS styles:
1. Ensure the Vite dev server is running (`http://localhost:5173/`).
2. Connect to the local browser instance via Chrome DevTools MCP.
3. Bring the page to the front before capturing screenshots to avoid background `requestAnimationFrame` throttling.
4. Verify zero console or runtime errors and inspect visual rendering across video filters (`none`, `crt`, `nokia`), renderer backends (`canvas2d`, `webgl`), and demo switches (`snake` ↔ `snake2`).

---

## 5. Documentation Map

- [`README.md`](./README.md) – Repository overview, directory layout, and quick start guide.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) – Detailed multi-bundle architecture, `EngineDebugHooks` contract, and rendering pipeline.
- [`docs/DECISION_LOG.md`](./docs/DECISION_LOG.md) – Architectural Decision Records (ADR) logging design choices and trade-offs.
- [`docs/GDD.md`](./docs/GDD.md) – Game Design Document for the included Snake demos.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) – Completed milestones and backlog for future engine/demo iterations.
