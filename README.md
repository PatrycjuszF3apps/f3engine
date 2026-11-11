# f3engine — 2D Virtual Viewport Game Engine & HTML5 Demo Launcher

**f3engine** is a zero-dependency, modular 2D HTML5 game engine built with TypeScript and Vite. It emulates a retro virtual pixel grid (`VirtualViewport`) with strict indexed color palettes (`ColorPalette`), bitmap typography (`VirtualFont`), object-oriented virtual UI rendering (`VirtualUIDecorator`), hot-swappable physical renderer backends (`Canvas 2D` and `WebGL`), and a decoupled HTML debug bar (`degub_bar`).

---

## Repository Structure

```text
f3engine/
├── engine/                 # Core 2D engine (completely agnostic of games and debug bar DOM)
├── degub_bar/              # Standalone HTML Debug Bar consuming EngineDebugHooks
├── demos/
│   ├── games/
│   │   ├── snake/          # Demo 1: Classic 20×20 Arcade Snake
│   │   └── snake2/         # Demo 2: Snake 2: Arena (obstacle pillars & dual targets)
│   └── html5_launcher/     # HTML5 wrapper app initializing the canvas, debug bar, and demo switcher
└── docs/
    ├── ARCHITECTURE.md     # Multi-bundle architecture & hook contracts
    ├── GDD.md              # Game Design Document for the Snake demos
    └── ROADMAP.md          # Project roadmap and upcoming features
```

---

## Key Architectural Highlights

1. **Core Engine (`engine/`)**:
   - `VirtualViewport` – Manages an independent virtual pixel grid (`virtualWidth × virtualHeight`), aspect ratio presets (`4:3-portrait`, `4:3-horizontal`, `16:9-portrait`, `16:9-horizontal`, `custom`), physical stage scaling, and virtual pointer coordinate mapping. Exposes `getDebugHooks(): EngineDebugHooks` without any awareness of external debug bar HTML.
   - `ColorPalette` & `VirtualFramebuffer` – Indexed framebuffer (`Uint8Array`) guaranteeing that every virtual pixel on screen strictly belongs to the declared palette.
   - `IRendererBackend` (`Canvas2DRendererBackend` / `WebGLRendererBackend`) – Swappable physical rendering layer allowing instant runtime switching between Canvas 2D (`ImageData`) and WebGL (`LUMINANCE` + `256×1 RGBA` LUT shader).
   - `VirtualFont` & `VirtualUIDecorator` – Bitmap font rasterizer (ASCII, Polish diacritics, directional icons) and scalable UI component renderer (panels, score cards, buttons, D-Pad) operating strictly in virtual pixel space.
   - `MenuSystem` & `OverlayManager` – Modal menus and readiness overlays rendered on the virtual grid with keyboard, gamepad, and mouse support.
   - `GameLoop`, `StorageStore<T>`, `GamepadManager`, `I18nManager`, `VideoFilterManager`.

2. **Decoupled Debug Bar (`degub_bar/`)**:
   - Renders an HTML inspector bar that binds to the engine solely through `EngineDebugHooks`.
   - Allows live inspection and overrides of grid aspect ratio, virtual resolution (`240w`, `300w`, `360w`, `480w`, or custom `W×H`), window scale percentage, UI/font scale multiplier, active renderer backend (`Canvas 2D` / `WebGL`), palette swatches, and virtual cursor `(X, Y)` coordinates.

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

3. **Build production bundles**:
   ```bash
   npm run build
   ```

4. **Preview production build**:
   ```bash
   npm run preview
   ```

---

## License

Released under the [MIT License](./LICENSE).
