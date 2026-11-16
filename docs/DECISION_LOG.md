# Architectural Decision Log (ADR)

This document records key architectural decisions made during the evolution of **f3engine**, including the context, evaluated alternatives, decision rationale, and consequences.

---

## ADR-001: Ahead-of-Time Pixel-Mask Font Compilation (`VirtualFontSpec`)

- **Date**: 2026-11-12
- **Status**: Accepted
- **Layer Scope**: `engine/`, `demos/games/`, `scripts/`

### 1. Context & Problem Statement

Initially, `f3engine` hardcoded a single `5×7` bitmap glyph table (`GLYPHS_5X7`) inside `engine/VirtualFont.ts` with fixed constants (`BASE_WIDTH = 5`, `BASE_HEIGHT = 7`). Application and game developers adopting the engine needed a reliable way to:
1. Import and use custom retro/pixel fonts of varying dimensions (`5×7`, `6×8`, `8×8`, proportional or fixed-width).
2. Support national characters and diacritics for multiple European languages (e.g., **Polish**, **German**, **Czech**, **Finnish**) without manual per-pixel array editing.
3. Render multiple font faces simultaneously within a single frame (e.g., a bold display font for headings/scores paired with a compact UI font for HUD badges, buttons, and wrapped descriptions).
4. Guarantee 100% deterministic pixel output across both `Canvas 2D` (`Canvas2DRendererBackend`) and `WebGL` (`WebGLRendererBackend`), while strictly respecting the indexed `ColorPalette` (`Uint8Array` framebuffer) and video filters (`None`, `CRT`, `Old Nokia`).

### 2. Evaluated Options

- **Option A: Native Browser Vector Text Rendering (`CanvasRenderingContext2D.fillText`)** – Rejected due to OS-dependent subpixel anti-aliasing and incompatibility with the indexed `Uint8Array` framebuffer.
- **Option B: Raw Sprite-Sheet Image Atlases Only (`.png` + coordinate map)** – Rejected due to manual atlas editing overhead when adding new locales.
- **Option C: Compile-to-Pixel-Mask Pipeline (`VirtualFontSpec`) with Multilingual Charset Presets & NFD Diacritic Synthesis (Selected)** – Extracts deterministic 1-bit glyph masks ahead-of-time from `.otb`, `.ttf` (`EBLC`/`EBDT`), and `.bdf` bitmap fonts, automatically synthesizes missing national diacritics via Unicode `NFD`, and validates 100% coverage against `locales/*.json`.

---

## ADR-002: Hierarchical Application Node Graph, Normalized Input Router & Namespaced UI Kits (`UIKit.ClassicV1`)

- **Date**: 2026-11-16
- **Status**: Accepted
- **Layer Scope**: `engine/nodes/`, `engine/input/`, `engine/ui/`, `demos/games/`

### 1. Context & Problem Statement

In earlier versions of `f3engine` (`v1.0.0–v1.1.0`), each demo application had to manually wire:
1. Low-level DOM `window.addEventListener('keydown', ...)` listeners alongside `GamepadManager` callbacks, manually translating key codes (`ArrowUp`, `KeyW`) and synthesizing fake `KeyboardEvent` instances to drive `MenuSystem`.
2. Ad-hoc procedural HUD layout coordinate math (`SnakeHUDRenderer`) and flat per-frame hit-region registration (`ui.registerHitRegion`), which only supported two hardcoded layers (`'hud'` and `'modal'`) and could not naturally represent cascading windows or nested control hierarchies.
3. Manual state tracking (`activeMenuView`, `settingsReturnTo`) to remember which parent screen opened the Settings view, resulting in substantial boilerplate duplication between `demos/games/snake` and `demos/games/snake2`.

### 2. Evaluated Options

#### Option A: Keep Procedural HUD Renderers & Imperative Event Wiring per Application
- **Pros**: No changes required to core engine classes.
- **Cons**: High boilerplate in every new application; fragile modal/focus handling when nesting windows (such as Settings inside Pause or multi-window RPG interfaces); tight coupling between application logic and physical input devices.

#### Option B: Introduce an Application-Oriented Node & Control Hierarchy with Normalized Input Routing and Versioned UI Namespaces (Selected)
- **Description**:
  - Introduce a hierarchical scene/application graph in `engine/nodes/` (`Node`, `CanvasNode`, `ContainerNode`, `ControlNode`, `AppRootNode`, `NodeTreeProcessor`) using general application terminology (`App*`, `Control*`, `Dialog*`).
  - Provide cascading parent-over-child authority (`hide`, `show`, `enable`, `disable`, `freeze`, `unfreeze`, `resetState`, `unload`, `destroy`) and lifecycle phase hooks (`HookPhase.BEFORE_UPDATE`, `AFTER_UPDATE`, `BEFORE_RENDER`, `AFTER_RENDER`).
  - Introduce `InputRouter` (`engine/input/`) to normalize Keyboard, Gamepad, Virtual Pointer, and on-screen virtual controls (`DPadControl`) into unified `ControlEvent` instances (`DIRECTION`, `ACTION`, `POINTER`, `GAMEPAD_STATUS`, `RAW_KEY`) dispatched top-down through the node tree with `event.consume()` and automatic `modal` barriers.
  - Package ready-to-use atomic and higher-level composite controls inside a versioned namespace (`UIKit.ClassicV1` in `engine/ui/classic_v1/`) so future UI collections can coexist alongside `ClassicV1` without breaking legacy applications.

### 3. Decision Outcome

We selected **Option B**.

Key architectural improvements delivered:
1. **Cascading Parent Authority & Lifecycle Hooks (`engine/nodes/`)**:
   - Calling `freeze()`, `hide()`, `resetState()`, or `unload()` on a parent container automatically governs its entire child subtree.
   - `ModalDialogNode` supports cascading child sub-dialogs (`openSubDialog(childDialog)` / `closeSubDialog()`): opening `SettingsDialogNode` from `TitleDialog`, `PauseDialog`, or `GameOverDialog` automatically suspends the parent dialog's menu list and restores the parent's exact selection state when the child dialog closes.
2. **Higher-Level Composite Controls (`UIKit.ClassicV1`)**:
   - `MenuListControl` owns and orchestrates `MenuActionItemControl` and `MenuChoiceItemControl` (which in turn owns `ChoicePillControl` children), managing `selectedIndex`, focus, hover synchronization, and `UP`/`DOWN`/`LEFT`/`RIGHT`/`CONFIRM` handling internally.
   - `ResponsiveAppShellNode` orchestrates `HeaderBarControl`, the main application `CanvasNode`, `ControlDeckControl`, and the modal layer across Portrait and Horizontal aspect ratios.
3. **OOP Application Extensibility Verified in Demos (`demos/games/snake/` & `demos/games/snake2/`)**:
   - `SnakeBoardNode` extends `CanvasNode` and consumes only normalized `DIRECTION` and `ACTION` control events.
   - `SnakeAppRootNode` extends `AppRootNode` and composes `UIKit.ClassicV1` nodes.
   - `Snake2ArenaBoardNode` extends `SnakeBoardNode` via OOP inheritance to add arena obstacle pillars, dual targets, and custom scoring, eliminating over 900 lines of duplicated UI and input boilerplate.
