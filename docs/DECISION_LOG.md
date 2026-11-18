# Architectural Decision Log (ADR)

This document records foundational architectural and design decisions made in **f3engine**. Following open-source ADR conventions, it captures the problem context, rejected alternatives, and architectural trade-offs rather than per-commit history.

---

## ADR-001: Four-Layer Bundle Isolation & Zero Runtime Dependencies

- **Status**: Accepted
- **Introduced in**: `v1.0.0`
- **Layer Scope**: `engine/`, `degub_bar/`, `demos/games/`, `demos/html5_launcher/`, `vite.config.ts`

### 1. Problem & Context
Coupling core 2D engine rendering and input logic with HTML debug controls or game-specific logic prevents reusing the engine across other 2D games and bloats production builds. Additionally, external runtime dependencies introduce supply-chain churn and bundle overhead for lightweight HTML5 canvas applications.

### 2. Evaluated Alternatives
- **Monolithic Single-Bundle Architecture** – Rejected because debug tooling (`degub_bar/`) and demo game code would leak into core engine distributions and encourage circular imports.
- **Third-Party UI / Rendering Libraries** – Rejected to keep the engine deterministic, lightweight, and 100% self-contained on standard Web APIs.

### 3. Decision
1. Enforce four strictly isolated layers compiled into dedicated Rollup chunks via `vite.config.ts`:
   - `engine/` (`dist/assets/engine-*.js`) — Core 2D virtual viewport, node graph, input router, and UI kits; completely blind to DOM debug UI and specific applications.
   - `degub_bar/` (`dist/assets/debug-bar-*.js`) — Standalone HTML inspector interacting with the engine solely via `EngineDebugHooks` (`viewport.getDebugHooks()`).
   - `demos/games/` (`dist/assets/demos-games-*.js`) — Self-contained reference applications (`snake`, `snake2`) structured like real standalone applications built on the engine (each with its own `manifest.json`, `README.md`, assets, and `DemoSession` lifecycle entrypoint).
   - `demos/html5_launcher/` (`dist/assets/launcher-*.js`) — Host stage bootstrap, debug bar binder, and live demo switcher.
2. Rely strictly on standard Web APIs (`CanvasRenderingContext2D`, `WebGLRenderingContext`, `Gamepad API`, `localStorage`, `requestAnimationFrame`) with **zero external runtime dependencies**.

---

## ADR-002: Indexed Virtual Framebuffer (`Uint8Array`), Semantic Palettes & Dual Renderer Backends

- **Status**: Accepted
- **Introduced in**: `v1.0.0`
- **Layer Scope**: `engine/VirtualSurface.ts`, `engine/Palette.ts`, `engine/RendererBackend.ts`, `engine/VideoFilter.ts`

### 1. Problem & Context
Drawing direct RGB/hex colors onto an HTML5 Canvas makes instant palette swapping, authentic monochrome LCD sub-pixel simulation (`Old Nokia` mode), and pixel-for-pixel parity between `Canvas 2D` and `WebGL` difficult to guarantee.

### 2. Evaluated Alternatives
- **Direct RGBA Drawing on `CanvasRenderingContext2D`** – Rejected because re-theming or switching video filters mid-frame requires application-level color logic and breaks indexed palette inspection.

### 3. Decision
1. **Indexed Framebuffer (`VirtualFramebuffer`)**: All drawing primitives write semantic palette indices into a 1D `Uint8Array(virtualWidth * virtualHeight)` buffer rather than raw RGBA pixels.
2. **Semantic Color Tokens (`ColorPalette`)**: Nodes and surfaces draw using semantic tokens (`bgOuter`, `panelBg`, `border`, `textMain`, `accent`, `primaryEntityHead`, `targetFill`, etc.) and respect `palette.pixelated` so switching filters/palettes re-themes the entire scene automatically.
3. **Dual Renderer Backends (`IRendererBackend`)**: `Canvas2DRendererBackend` and `WebGLRendererBackend` consume the exact same indexed surface and apply post-processing `VideoFilter` modes (`none`, `crt` scanlines/vignette, `nokia` LCD dot matrix).

---

## ADR-003: Multi-Modal Input & Localization-First Architecture

- **Status**: Accepted
- **Introduced in**: `v1.0.0`
- **Layer Scope**: `engine/I18nManager.ts`, `engine/GamepadManager.ts`, `engine/input/`, `demos/games/`

### 1. Problem & Context
Web-based retro engines frequently hardcode English strings directly in rendering logic and assume a single input device (keyboard-only), making localization and controller/pointer accessibility painful to retrofit.

### 2. Evaluated Alternatives
- **Hardcoded UI Strings with Optional Post-Hoc Translation** – Rejected because retro bitmap fonts require ahead-of-time glyph coverage validation against all translated characters.
- **Keyboard-Only Navigation** – Rejected to ensure every application works out of the box across desktop keyboards, gamepads, and mouse/touch pointers.

### 3. Decision
1. **No Hardcoded UI Strings**: All user-facing text passes through `I18nManager.t(...)` backed by JSON locale dictionaries (`locales/en.json`, `locales/pl.json`).
2. **First-Class Multi-Modal Input**: Every interactive screen, menu, dialog, and gameplay loop must support Keyboard (`Arrows`, `WASD`, `Enter`, `Escape`), Gamepad (`GamepadManager` with analog deadzone, edge-triggered buttons, and dual-rumble), and Virtual Pointer (`hover` + `click` mapped to virtual pixel coordinates).

---

## ADR-004: Engine Versioning & Self-Contained Application Package Blueprint

- **Status**: Accepted
- **Introduced in**: `v1.0.0`
- **Layer Scope**: `engine/version.ts`, `demos/games/<app-id>/`, `degub_bar/DebugToolbar.ts`, `docs/`

### 1. Problem & Context
As `f3engine` evolves alongside multiple reference applications, two structural issues arise:
1. Runtime mismatches between the active engine version and the target engine version expected by an application must be surfaced explicitly.
2. Scattering game-specific assets, manifests, or Game Design Documents (GDDs) into engine-level directories (`engine/` or root `docs/`) blurs the boundary between the reusable engine and standalone applications built on top of it.

### 2. Evaluated Alternatives
- **Implicit Version Coupling & Centralized Game Docs in `docs/`** – Rejected because applications mounted against an incompatible engine version would fail silently, and mixing game-specific GDDs into root `docs/` pollutes engine documentation as new demo applications are added.

### 3. Decision
1. **Engine Version & Manifest Contract**: Export `ENGINE_VERSION` in `engine/version.ts` and require every application built on `f3engine` to include a `manifest.json` (`AppManifest`) declaring `id`, `name`, `version`, and target `engineVersion`. Validate compatibility at mount time via `checkEngineVersion(manifest.engineVersion)` and expose `state.versionCheck` through `EngineDebugHooks` so `DebugToolbar` displays a live compatibility badge.
2. **Self-Contained Application Directory Blueprint (`demos/games/<app-id>/`)**: Structure every demo directory to mirror a real standalone application project built on **f3engine**. Each application folder encapsulates its own `manifest.json`, co-located architecture & Game Design Document (`README.md`), localization dictionaries (`locales/*.json`), optional compiled assets (`fonts/`), `AppRootNode` / `CanvasNode` classes, and an `index.ts` entrypoint returning a `DemoSession`. Root `docs/` remains strictly reserved for engine-level documentation (`ARCHITECTURE.md`, `DECISION_LOG.md`, `ROADMAP.md`).

---

## ADR-005: Ahead-of-Time Pixel-Mask Font Compiler & NFD Diacritic Synthesis (`VirtualFontSpec`)

- **Status**: Accepted
- **Introduced in**: `v1.1.0`
- **Layer Scope**: `engine/VirtualFont.ts`, `engine/VirtualFontCompiler.ts`, `engine/fonts/`, `scripts/compile-font.ts`, `demos/games/snake2/fonts/`

### 1. Problem & Context
An initial hardcoded `5×7` glyph table could not support custom typography, varying glyph dimensions (`6×8`, `8×8`), multiple simultaneous font roles (`heading` vs `body`), or European national characters (`ą, ć, ę, ł, ń, ó, ś, ź, ż`, `ä, ö, ü, ß`, `č, ř, š, ž`) without manual per-pixel array editing.

### 2. Evaluated Alternatives
- **Native Browser Vector Text (`CanvasRenderingContext2D.fillText`)** – Rejected due to OS-dependent subpixel anti-aliasing and incompatibility with the indexed `Uint8Array` framebuffer.
- **Static Image Sprite Atlases (`.png` + UV coordinate map)** – Rejected due to manual atlas editing overhead when adding new locales or national diacritics.

### 3. Decision
1. Provide an ahead-of-time font compiler (`engine/VirtualFontCompiler.ts` + `npm run compile-font`) that extracts deterministic 1-bit pixel masks (`VirtualFontSpec`) from `.otb`, `.ttf` (`EBLC`/`EBDT`), and `.bdf` bitmap fonts.
2. Automatically synthesize missing national diacritics via Unicode `NFD` decomposition and combiner overlays (`en`, `pl`, `de`, `cs`, `fi`, `latin-ext`) and verify 100% character coverage against application `locales/*.json` files.
3. Support multiple simultaneous font faces per frame (`body`, `heading`, `mono`), bundling default PC bitmap fonts in `engine/fonts/` (`HP 100LX 6×8`, `IBM BIOS 8×8`, `IBM CGA Thin 8×8`) while allowing applications to bundle custom compiled fonts (`demos/games/snake2/fonts/`).

---

## ADR-006: Hierarchical Application Node Graph, Normalized `InputRouter` & Versioned `UIKit.ClassicV1`

- **Status**: Accepted
- **Introduced in**: `v1.2.0`
- **Layer Scope**: `engine/nodes/`, `engine/input/`, `engine/ui/classic_v1/`, `demos/games/`

### 1. Problem & Context
In `v1.0.0–v1.1.0`, applications had to wire low-level DOM `keydown` listeners, synthesize fake `KeyboardEvent` objects for gamepad navigation, calculate procedural HUD coordinates manually, and track flat modal return states (`activeMenuView`, `settingsReturnTo`), leading to ~900 lines of duplicated UI and input boilerplate across demos.

### 2. Evaluated Alternatives
- **Procedural Per-Application HUD Renderers & Ad-Hoc Event Listeners** – Rejected due to high boilerplate, fragile focus restoration when nesting dialogs (e.g., opening Settings inside Pause), and tight coupling between application logic and physical input devices.

### 3. Decision
1. **Application-Oriented Node Hierarchy (`engine/nodes/`)**: Introduce `Node`, `CanvasNode`, `ContainerNode`, `ControlNode`, `AppRootNode`, and `NodeTreeProcessor` using general application terminology reusable across games, tools, and RPG UIs.
2. **Cascading Parent Authority & Lifecycle Hooks**: Parent state changes (`hide`, `show`, `enable`, `disable`, `freeze`, `unfreeze`, `resetState`, `unload`, `destroy`) cascade automatically down child subtrees; lifecycle hooks (`HookPhase.BEFORE_UPDATE`, `AFTER_UPDATE`, `BEFORE_RENDER`, `AFTER_RENDER`) enable modular interception.
3. **Normalized Input Routing (`engine/input/`)**: `InputRouter` translates Keyboard, Gamepad, Virtual Pointer, and synthetic on-screen controls (`DPadControl`) into unified `ControlEvent` instances (`DIRECTION`, `ACTION`, `POINTER`, `GAMEPAD_STATUS`, `RAW_KEY`) dispatched top-down with `event.consume()` and automatic `modal` barriers.
4. **Versioned UI Kit (`UIKit.ClassicV1` in `engine/ui/classic_v1/`)**: Provide composite controls (`ResponsiveAppShellNode`, `HeaderBarControl`, `ControlDeckControl`, `MenuListControl`, `ChoicePillControl`, and cascading `ModalDialogNode` / `SettingsDialogNode` with `openSubDialog` selection state restoration) inside a versioned namespace so future UI kits can coexist without breaking existing applications.
5. **OOP Application Extensibility**: Applications can subclass both engine nodes and existing application nodes (demonstrated by `Snake2ArenaBoardNode extends SnakeBoardNode`), overriding only domain-specific gameplay mechanics.
