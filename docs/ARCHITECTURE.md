# Architecture — Engine, Debug Bar, Demos & HTML5 Launcher

**f3engine** implements a **Virtual Viewport (2D Machine Emulator)** architecture: all game graphics, boards, bitmap fonts, HUD panels, menus, and virtual controls are rasterized onto a virtual pixel grid with a declared resolution, aspect ratio, and indexed color palette.

---

## 1. Module & Bundle Separation Diagram

```mermaid
flowchart TD
    subgraph EngineBundle["Bundle: engine-*.js (engine/)"]
        VER["version.ts\n(ENGINE_VERSION, AppManifest, checkEngineVersion)"]
        VP["VirtualViewport.ts\n(Virtual Grid W×H, Aspect Ratios, Stage Scaling, EngineDebugHooks)"]
        FB["VirtualSurface.ts\n(VirtualFramebuffer — Indexed Pixel Buffer)"]
        PAL["Palette.ts\n(ColorPalette — Strict Indexed Palette)"]
        FONT["VirtualFont.ts\n(Scalable 5×7 Bitmap Font EN/PL)"]
        UID["VirtualUIDecorator.ts\n(UI Decorator + Virtual Pointer Hit-Testing)"]
        MS["MenuSystem.ts\n(Virtual Grid Menu System)"]
        OM["OverlayManager.ts\n(Virtual Grid Ready Overlay)"]
        RB["RendererBackend.ts\n(IRendererBackend: Canvas2D / WebGL)"]
        GL["GameLoop.ts"]
        SS["StorageStore.ts"]
        GM["GamepadManager.ts"]
        I18N["I18nManager.ts"]
        VF["VideoFilter.ts"]

        VER --> VP
        PAL --> FB
        FONT --> FB
        FB --> VP
        RB --> VP
        VP --> UID
        UID --> MS
        UID --> OM
    end

    subgraph DebugBarBundle["Bundle: debug-bar-*.js (degub_bar/)"]
        DT["DebugToolbar.ts\n(Standalone HTML Inspector, Version Badge & Demo Switcher)"]
    end

    subgraph DemosBundle["Bundle: demos-games-*.js (demos/games/)"]
        S1["snake/\n(Classic 20×20 Snake Demo + manifest.json)"]
        S2["snake2/\n(Snake 2: Arena Demo + manifest.json)"]
    end

    subgraph LauncherBundle["Bundle: launcher-*.js (demos/html5_launcher/)"]
        REG["demoRegistry.ts\n(Playable Demo Catalog)"]
        MAIN["main.ts\n(Lifecycle Wrapper: Mount / Switch / Reset)"]
        REG --> MAIN
    end

    VP ==>|EngineDebugHooks| DT
    UID ==>|IVirtualSurface / UI API| S1
    UID ==>|IVirtualSurface / UI API| S2
    MAIN ==>|Mounts & Disposes| S1
    MAIN ==>|Mounts & Disposes| S2
    MAIN ==>|Binds Hooks| DT
```

---

## 2. Core Architectural Principles

### 2.1. Blind Engine & `EngineDebugHooks` Contract
- The `engine/` package has **zero knowledge** of `degub_bar/` or any external HTML toolbar elements.
- `VirtualViewport` sizes itself strictly relative to its parent stage container (`hostContainer.parentElement`) and exposes `getDebugHooks(): EngineDebugHooks`.
- `EngineDebugHooks` provides a clean programmatic API:
  - `getState()` & `subscribe(listener)` – Reactive snapshots including engine version (`engineVersion`), application manifest (`appManifest`), version compatibility (`versionCheck`), virtual/physical dimensions, aspect ratio, scale factors, active backend, cursor coordinates, and palette entries.
  - `getEngineVersion()` & `getAppManifest()`
  - `setVirtualGrid(width, aspectRatio, customHeight)`
  - `setPhysicalScaling(windowScalePercent, lockAspectRatio)`
  - `setUIScaleOverride(scale)`
  - `setRendererBackend('canvas2d' | 'webgl')`
  - `setCursorInspectorEnabled(enabled)`
  - `resetToDefaults()` & `updatePhysicalSize()`

### 2.2. Engine Versioning & Application Manifests (`engine/version.ts`)
- The engine exports a canonical semantic version constant `ENGINE_VERSION` (`"1.0.0"`) along with `AppManifest` and `checkEngineVersion(...)`.
- Every application/game built on **f3engine** includes a `manifest.json` conforming to `AppManifest`:
  - `id`: Unique application identifier (e.g., `"snake"`, `"snake2"`).
  - `name`: Display name of the application.
  - `version`: Application semantic version (e.g., `"1.0.0"`).
  - `engineVersion`: Target **f3engine** version the application is compatible with (supports exact `"1.0.0"`, caret `"^1.0.0"`, tilde `"~1.0.0"`, or wildcard `"1.0.x"` constraints).
- When a game initializes `VirtualViewport({ ..., manifest })`, the viewport evaluates `checkEngineVersion(manifest, ENGINE_VERSION)` and exposes the result via `EngineDebugHooks`.
- `DebugToolbar` (`degub_bar/`) reads `state.versionCheck` from `EngineDebugHooks` and displays a live comparison badge (`Engine v1.0.0 vs Manifest v1.0.0 (OK)`) in the toolbar header.

### 2.3. Virtual Pixel Grid & Aspect Ratio Presets (`VirtualViewport`)
- The virtual pixel grid (`virtualWidth × virtualHeight`) is completely independent of the physical display resolution.
- Built-in aspect ratio presets (`ViewportAspectRatio`):
  - `'4:3-portrait'` (`3:4`, default for Snake demos: `300×400` virtual pixels)
  - `'4:3-horizontal'` (`4:3`)
  - `'16:9-portrait'` (`9:16`)
  - `'16:9-horizontal'` (`16:9`)
  - `'custom'` (arbitrary `W × H` dimensions)

### 2.4. Strict Indexed Color Palette (`ColorPalette` + `VirtualFramebuffer`)
- Each demo declares its own `ColorPalette` definitions per video filter.
- `VirtualFramebuffer` stores the virtual grid as a `Uint8Array` of palette indices (`virtualWidth * virtualHeight`).
- Every virtual pixel (game entities, bitmap text, and UI panels) resolves strictly to an index in the active palette.

### 2.5. Swappable Renderer Backends (`IRendererBackend`)
- Game logic and UI decorators draw exclusively onto the abstract `IVirtualSurface` interface.
- Physical presentation is handled by a hot-swappable `IRendererBackend`:
  - `Canvas2DRendererBackend` – Converts the indexed buffer via a 32-bit ABGR LUT directly into `ImageData`.
  - `WebGLRendererBackend` – Uploads the indexed buffer as a `LUMINANCE` texture and the palette as a `256×1 RGBA` LUT texture to a WebGL fragment shader.

### 2.6. HTML5 Demo Launcher & Lifecycle Management (`demos/html5_launcher/`)
- Every demo in `demos/games/` implements a mount function returning a `DemoSession` with a `dispose()` method that stops game loops, unbinds keyboard/gamepad listeners, and disposes the `VirtualViewport`.
- When the user selects another demo or clicks `Reload` in the Debug Bar, the launcher disposes the active session, mounts the new demo onto `#app`, and rebinds `DebugToolbar` via `debugToolbar.bindEngine(...)`.
