# AGENTS.md — AI Agent Instructions (Vibecoding Standard)

This document defines the architectural boundaries, coding standards, and verification workflows for AI agents contributing to **f3engine**.

> **Local Developer Overrides (`.local/`)**: If `.local/AGENTS.md` or `.local/rules/*.md` exists in the local workspace, its instructions carry the **highest priority** and override any conflicting defaults in this document (covering local environment setup, private testing rules, and machine-specific workflows). Never commit, quote, or reference `.local/` files in tracked repository files.

---

## 1. Project Philosophy & Layer Separation

The repository is structured into four strictly separated layers bundled into dedicated chunks via `vite.config.ts`:

1. **`engine/` (`dist/assets/engine-*.js`)** – Core 2D Virtual Viewport, 4-Layer DDD Service Kernel & Application Node Engine:
   - **FORBIDDEN** to import anything from `degub_bar/` or `demos/`.
   - **FORBIDDEN** to query or reference any HTML/DOM context belonging to `degub_bar/`. The engine exposes `EngineDebugHooks` (`viewport.getDebugHooks()`) and remains completely blind to any surrounding debug UI.
   - **4-Layer DDD Lifecycle Topology & Per-Layer DI**: Structured into `engine/di/` (`EngineKernel`, `LayerServiceRegistry<'L1'..'L4'>`, `ServiceToken`, and `*.registrar.ts` shadow registrars) and four strictly isolated abstraction layers:
     - `engine/l1_infrastructure/` (`L1_INFRASTRUCTURE`) – Hardware, DOM, `VirtualViewport`, `VirtualSurface`, `IRendererBackend` (`Canvas2D` / `WebGL` + `RendererRuntimeInfo`), `ColorPalette`, `VirtualFont` / `VirtualFontCompiler`, `VideoFilter`, `GamepadManager`, `StorageStore`, and L1 telemetry services.
     - `engine/l2_runtime/` (`L2_RUNTIME`) – Scene graph nodes (`engine/l2_runtime/nodes/`), normalized input routing (`engine/l2_runtime/input/`), and pluggable L2 runtime services (`INodeMetadataService`, `IChildOrderService`, `IHitTestService`).
     - `engine/l3_interaction/` (`L3_INTERACTION`) – Layer grouping/elevation (`ILayerElevationService`), `VirtualUIDecorator`, `I18nManager`, and versioned UI kits (`engine/l3_interaction/ui/classic_v1/`).
     - `engine/l4_domain/` (`L4_DOMAIN`) – Reusable domain policy contracts (`IDomainDepthPolicyService`).
   - **Application-Oriented Naming**: Core engine nodes (`engine/l2_runtime/nodes/`), input routing (`engine/l2_runtime/input/`), and UI kits (`engine/l3_interaction/ui/`) use general application terminology (`AppRootNode`, `Node`, `CanvasNode`, `ContainerNode`, `ControlNode`, `InputRouter`, `UIKit.ClassicV1`) rather than coupling to a specific game genre.
   - Engine modules must remain reusable across any 2D HTML5 application or game (e.g., Snake, Tetris, Breakout, multi-layer compositors, RPG UI systems).

2. **`degub_bar/` (`dist/assets/debug-bar-*.js`)** – Standalone HTML Debug Bar:
   - Communicates with the engine exclusively through the `EngineDebugHooks` interface exported by `engine/`.
   - Displays live Engine version vs. Application Manifest target Engine version (`state.versionCheck`), live hardware renderer context (`state.rendererRuntimeInfo`: `CanvasRenderingContext2D` vs. `WebGLRenderingContext`), and provides live controls for aspect ratio, virtual grid dimensions, window scale, UI scale, renderer backend (`Canvas 2D` / `WebGL`), palette inspection, virtual cursor coordinates, and demo switching/resetting.

3. **`demos/games/` (`dist/assets/demos-games-*.js`)** – Self-Contained Reference Demo Applications:
   - **Self-Contained 4-Layer Application Blueprint**: Every demo folder under `demos/games/<app-id>/` mirrors a real standalone application built on **f3engine** using the exact same 4-layer DDD directory structure (`l1_infrastructure/`, `l2_runtime/`, `l3_interaction/`, `l4_domain/`). Each application directory encapsulates its own `manifest.json` (`AppManifest`), application documentation & Game Design Document (`README.md`), localization assets (`locales/*.json`), optional compiled assets (`fonts/`), pure services paired with `*.registrar.ts` shadow registrars, `AppRootNode` / `CanvasNode` classes, and an `index.ts` entrypoint returning a `DemoSession` (`id`, `name`, `manifest`, `hooks`, `i18n`, `dispose()`). Game-specific GDDs and docs must live inside the corresponding demo directory (`demos/games/<app-id>/README.md`), never inside engine `docs/`.
   - `demos/games/snake/` – Classic 20×20 Snake reference application (`manifest.json`, `README.md`, `locales/`, `l1_infrastructure/`..`l4_domain/`), built on the 4-layer DDD service architecture with `*.registrar.ts` shadow registrars.
   - `demos/games/layers/` – Layer Stack: Realtime Z-Index reference application (`manifest.json`, `README.md`, `locales/`, `l1_infrastructure/`..`l4_domain/`), demonstrating 5 independent animated `AnimatedBackdropNode` instances inside `LayeredStageContainerNode extends ContainerNode` with real-time Z-index sorting injected via custom application service registrars.

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
5. **4-Layer DDD Services & Shadow Registrars (`*.registrar.ts`)**: New engine and application capabilities must be implemented as replaceable, interface-driven pure services inside their corresponding DDD layer (`l1_infrastructure/`, `l2_runtime/`, `l3_interaction/`, `l4_domain/`) paired with a companion Shadow Service Registrar (`*.registrar.ts`) declaring `provides`, `inject`, `shouldRegister(ctx)`, and `getPipelineSlots()`. Never mix services across non-adjacent layers; exchange data across layer boundaries strictly via boundary ports and immutable DTOs.
6. **High-Level Nodes & Normalized Input**: Applications should extend `AppRootNode` / `CanvasNode` / `ContainerNode` / `ControlNode`, compose higher-level controls from versioned namespaces (`UIKit.ClassicV1`), and consume normalized `ControlEvent` instances (`DIRECTION`, `ACTION`, `POINTER`) dispatched down the node tree rather than attaching ad-hoc DOM keyboard/gamepad listeners.
7. **Multi-Modal Input**: All interactive screens and menus must support keyboard (`Arrows`, `WASD`, `Enter`, `Escape`), gamepad, and mouse (`hover` + `click`).
8. **No Hardcoded UI Strings**: Always route user-facing text through `I18nManager.t(...)` and keep translations in JSON locale files (`locales/en.json`, `locales/pl.json`).
9. **Privacy & Public Repo Hygiene**: Never commit machine-specific paths, environment details, or local agent scratch files to documentation or source files.

---

## 4. Visual Verification Workflow (Chrome DevTools / MCP)

After modifying rendering logic, UI layouts, or CSS styles:
1. Ensure the Vite dev server is running (`http://localhost:5173/`).
2. Connect to the local browser instance via Chrome DevTools MCP.
3. Bring the page to the front before capturing screenshots to avoid background `requestAnimationFrame` throttling.
4. Verify zero console or runtime errors and inspect visual rendering across video filters (`none`, `crt`, `nokia`), renderer backends (`canvas2d`, `webgl`), and demo switches (`snake` ↔ `layers`).

---

## 5. Documentation Map

- [`README.md`](./README.md) – Repository overview, directory layout, screenshots, and quick start guide.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) – Detailed multi-bundle architecture, 4-layer DDD lifecycle & per-layer DI (`EngineKernel`, `*.registrar.ts`), Node & Control graph, Normalized Input Router, `UIKit.ClassicV1` namespace, `EngineDebugHooks` contract, and rendering pipeline.
- [`docs/DECISION_LOG.md`](./docs/DECISION_LOG.md) – Architectural Decision Records (`ADR-001` through `ADR-007`) logging foundational design choices and trade-offs.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) – Non-linear idea map for engine spatial/board sub-modules, visual effects, physics, and DX enhancements.
- [`demos/games/snake/README.md`](./demos/games/snake/README.md) – Reference application guide & Game Design Document (GDD) for **Snake (Classic)**.
- [`demos/games/layers/README.md`](./demos/games/layers/README.md) – Reference multi-node layering & real-time Z-Index sorting guide for **Layer Stack: Realtime Z-Index**.
