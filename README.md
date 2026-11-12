# f3engine — 2D Virtual Viewport Game Engine & HTML5 Demo Launcher

**f3engine** is a zero-dependency, modular 2D HTML5 game engine built with TypeScript and Vite. It emulates a retro virtual pixel grid (`VirtualViewport`) with strict indexed color palettes (`ColorPalette`), multi-font 1-bit pixel-mask typography (`VirtualFont` & `VirtualFontCompiler`), object-oriented virtual UI rendering (`VirtualUIDecorator`), hot-swappable physical renderer backends (`Canvas 2D` and `WebGL`), and a decoupled HTML debug bar (`degub_bar`).

---

## Repository Structure

```text
f3engine/
├── engine/                 # Core 2D engine (versioned via version.ts; agnostic of games & debug bar DOM)
│   └── fonts/              # Built-in default compiled pixel-mask fonts (HP 100LX 6×8, IBM BIOS 8×8, IBM CGA Thin 8×8)
├── degub_bar/              # Standalone HTML Debug Bar consuming EngineDebugHooks
├── demos/
│   ├── games/
│   │   ├── snake/          # Demo 1: Classic 20×20 Arcade Snake (uses engine default fonts + manifest.json)
│   │   └── snake2/         # Demo 2: Snake 2: Arena (ships custom game-bundled fonts in fonts/ + manifest.json)
│   └── html5_launcher/     # HTML5 wrapper app initializing the canvas, debug bar, and demo switcher
├── scripts/
│   └── compile-font.ts     # CLI compiler converting .otb/.ttf/.bdf fonts to 1-bit pixel masks with national locales
└── docs/
    ├── ARCHITECTURE.md     # Multi-bundle architecture, versioning, font compilation & hook contracts
    ├── DECISION_LOG.md     # Architectural Decision Records (ADR)
    ├── GDD.md              # Game Design Document for the Snake demos
    └── ROADMAP.md          # Project roadmap and upcoming features
```

---

## Key Architectural Highlights

1. **Core Engine (`engine/`)**:
   - `ENGINE_VERSION` & `AppManifest` (`version.ts`) – Semantic engine versioning (`1.1.0`) and application manifest contract (`isEngineVersionCompatible`, `checkEngineVersion`). Every game built on `f3engine` supplies an `AppManifest` (`manifest.json`) declaring the engine version it targets.
   - `VirtualViewport` – Manages an independent virtual pixel grid (`virtualWidth × virtualHeight`), aspect ratio presets (`4:3-portrait`, `4:3-horizontal`, `16:9-portrait`, `16:9-horizontal`, `custom`), physical stage scaling, and virtual pointer coordinate mapping. Exposes `getDebugHooks(): EngineDebugHooks` without any awareness of external debug bar HTML.
   - `ColorPalette` & `VirtualFramebuffer` – Indexed framebuffer (`Uint8Array`) guaranteeing that every virtual pixel on screen strictly belongs to the declared palette.
   - `IRendererBackend` (`Canvas2DRendererBackend` / `WebGLRendererBackend`) – Swappable physical rendering layer allowing instant runtime switching between Canvas 2D (`ImageData`) and WebGL (`LUMINANCE` + `256×1 RGBA` LUT shader).
   - `VirtualFont` & `VirtualFontCompiler` – Multi-font 1-bit pixel-mask rasterizer and compiler supporting national character sets (`en`, `pl`, `de`, `cs`, `fi`, `latin-ext`), Unicode NFD diacritic synthesis, locale coverage verification (`validateFontLocaleCoverage`), and simultaneous multi-font rendering (`bodyFont` + `headingFont`).
   - `VirtualUIDecorator` – Scalable UI component renderer (panels, score cards, buttons, badges, D-Pad) operating strictly in virtual pixel space with multi-font role support.
   - `MenuSystem` & `OverlayManager` – Modal menus and readiness overlays rendered on the virtual grid with keyboard, gamepad, and mouse support.
   - `GameLoop`, `StorageStore<T>`, `GamepadManager`, `I18nManager`, `VideoFilterManager`.

2. **Decoupled Debug Bar (`degub_bar/`)**:
   - Renders an HTML inspector bar that binds to the engine solely through `EngineDebugHooks`.
   - Displays live **Engine Version vs. App Manifest Engine Version** compatibility status (`Engine v1.1.0 vs Manifest v1.1.0 (OK)`), and allows live inspection and overrides of grid aspect ratio, virtual resolution (`240w`, `300w`, `360w`, `480w`, or custom `W×H`), window scale percentage, UI/font scale multiplier, active renderer backend (`Canvas 2D` / `WebGL`), palette swatches, and virtual cursor `(X, Y)` coordinates.

3. **HTML5 Demo Launcher (`demos/html5_launcher/`)**:
   - Initializes the host stage, mounts the selected demo game from `DEMO_CATALOG`, and connects `DebugToolbar`.
   - Supports live demo switching (`Snake (Classic)` ↔ `Snake 2: Arena`) and full engine reset (`Reload`) directly from the top bar.

---

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Compile custom bitmap fonts (`.otb` / `.ttf` / `.bdf`) to 1-bit pixel masks**:
   ```bash
   npm run compile-font -- --input <path-to-font.otb> --output <out.ts> --id <font-id> --name "<Font Name>" --locales en,pl,de,cs,fi --scan-locales demos/games/snake/locales
   ```

4. **Build production bundles**:
   ```bash
   npm run build
   ```

5. **Preview production build**:
   ```bash
   npm run preview
   ```

---

## License

Released under the [MIT License](./LICENSE). Built-in retro PC bitmap font adaptations in `engine/fonts/` and `demos/games/snake2/fonts/` derive from *The Ultimate Oldschool PC Font Pack v2.2* by VileR ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)).
