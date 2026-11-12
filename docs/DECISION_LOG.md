# Architectural Decision Log (ADR)

This document records key architectural decisions made during the evolution of **f3engine**, including the context, evaluated alternatives, decision rationale, and consequences.

---

## ADR-001: Ahead-of-Time Pixel-Mask Font Compilation (`VirtualFontSpec`)

- **Date**: 2026-11-12
- **Status**: Accepted
- **Layer Scope**: `engine/`, `demos/games/`, `scripts/`

### 1. Context & Problem Statement

Initially, `f3engine` hardcoded a single `5×7` bitmap glyph table (`GLYPHS_5X7`) inside `engine/VirtualFont.ts` with fixed constants (`BASE_WIDTH = 5`, `BASE_HEIGHT = 7`). Game developers adopting the engine needed a reliable way to:
1. Import and use custom retro/pixel fonts of varying dimensions (`5×7`, `6×8`, `8×8`, proportional or fixed-width).
2. Support national characters and diacritics for multiple European languages (e.g., **Polish**, **German**, **Czech**, **Finnish**) without manual per-pixel array editing.
3. Render multiple font faces simultaneously within a single game frame (e.g., a bold display font for headings/scores paired with a compact UI font for HUD badges, buttons, and wrapped descriptions).
4. Guarantee 100% deterministic pixel output across both `Canvas 2D` (`Canvas2DRendererBackend`) and `WebGL` (`WebGLRendererBackend`), while strictly respecting the indexed `ColorPalette` (`Uint8Array` framebuffer) and video filters (`None`, `CRT`, `Old Nokia`).

### 2. Evaluated Options

#### Option A: Native Browser Vector Text Rendering (`CanvasRenderingContext2D.fillText`)
- **Description**: Load `.ttf` / `.woff2` files via CSS `@font-face` and render text directly onto a 2D canvas or upload rasterized text textures to WebGL.
- **Pros**: Native browser layout and kerning.
- **Cons**:
  - **Breaks Indexed Framebuffer Architecture**: `f3engine` rasterizes all graphics into an indexed `VirtualFramebuffer` (`Uint8Array` of palette indices) before presenting to `Canvas 2D` or `WebGL`.
  - **Non-Deterministic Subpixel Anti-Aliasing**: Font smoothing and hinting differ across operating systems (Windows DirectWrite/ClearType, macOS CoreText, Linux FreeType). Thresholding browser-rendered text at small pixel sizes (`6px–8px`) produces inconsistent, blurry, or broken glyphs across client machines.

#### Option B: Raw Sprite-Sheet Image Atlases Only (`.png` + coordinate map)
- **Description**: Require developers to supply a `.png` sprite sheet for every font and slice glyphs at runtime via an offscreen canvas.
- **Pros**: Familiar to pixel artists using image editors.
- **Cons**:
  - Adding support for a new language (e.g., Czech `áčďéěíňóřšťúůýž` or German `äöüß`) requires manually redrawing the PNG atlas and updating character coordinate maps.
  - Requires asynchronous image loading before the first frame can be rendered.

#### Option C: Compile-to-Pixel-Mask Pipeline (`VirtualFontSpec`) with Multilingual Charset Presets & NFD Diacritic Synthesis (Selected)
- **Description**:
  - Define a deterministic, serializable 1-bit pixel-mask font specification (`VirtualFontSpec`) understood natively by `VirtualFont` and `VirtualFramebuffer`.
  - Provide a zero-dependency compiler (`VirtualFontCompiler` + CLI `scripts/compile-font.ts`) capable of extracting exact 1-bit glyph masks from standard bitmap font containers (`.otb` OpenType Bitmap `EBLC`/`EBDT`, `.ttf` Mixed Bitmap, and `.bdf` Bitmap Distribution Format).
  - Include built-in national character presets (`ascii`, `pl`, `de`, `cs`, `fi`, `latin-ext`, `ui`), automatic `locales/*.json` character coverage scanning, and automatic Unicode `NFD` diacritic composition for legacy code-page fonts (such as CP437 fonts) that lack pre-drawn national characters.

### 3. Decision Outcome

We selected **Option C (Compile-to-Pixel-Mask Pipeline + Multi-Font Registry)**.

Key architectural components introduced:
1. **`VirtualFontSpec` & `CompiledGlyph` Contract (`engine/VirtualFont.ts`)**:
   - Replaces hardcoded `5×7` constants with a registry of `VirtualFontSpec` definitions supporting variable glyph widths (`width`, `height`, `offsetX`, `offsetY`, `advance`) and 1-bit row strings (`'1'` = active virtual pixel, `'0'` = transparent).
   - Remains 100% decoupled from `Canvas 2D` and `WebGL`: glyphs plot palette indices directly into `VirtualFramebuffer` via `PixelPlotter.setPixel(x, y, color)`.
2. **Simultaneous Multi-Font Rendering (`VirtualTextOptions.font` & `VirtualUITheme` Font Roles)**:
   - `IVirtualSurface.drawText`, `drawWrappedText`, and `measureText` accept a `font` option (`string | VirtualFontSpec`), defaulting to the surface's active default font face.
   - `VirtualUIDecorator` supports distinct font roles (`bodyFont` for compact HUD controls, buttons, and wrapped text; `headingFont` for titles, menu headings, and scoreboard values) so a single game screen can mix multiple font faces cleanly.
3. **Multilingual Compiler & NFD Fallback (`engine/VirtualFontCompiler.ts` & `scripts/compile-font.ts`)**:
   - Developers can compile `.otb`, `.ttf` (`EBLC`/`EBDT`), or `.bdf` fonts targeting language presets (`en`, `pl`, `de`, `cs`, `fi`, `latin-ext`) and validate coverage against `locales/*.json`.
   - When a source font only covers ASCII / CP437, the compiler decomposes requested national characters via `String.prototype.normalize('NFD')` (plus stroke/ligature rules for `Ł`, `ł`, `ß`) and composites pixel-level diacritic marks (`acute`, `caron`, `diaeresis`, `ring`, `ogonek`, `dot above`, `stroke`) onto the base glyph mask.
4. **Dual Font Delivery Models Verified in Demos**:
   - **Engine Default Fonts (`engine/fonts/`)**: The engine ships with four pre-compiled default fonts (`f3-retro-5x7`, `ibm-bios-8x8`, `hp-100lx-6x8`, `ibm-cgathin-8x8`) derived from the classic `5×7` set and *The Ultimate Oldschool PC Font Pack (v2.2, CC BY-SA 4.0)*. **Snake (Classic)** demonstrates using multiple engine default fonts simultaneously (`ibm-bios-8x8` + `hp-100lx-6x8`).
   - **Game-Bundled Third-Party Fonts (`demos/games/snake2/fonts/`)**: Games can ship their own compiled font modules inside their game directory and register them at mount time via `VirtualFont.registerFont(...)`. **Snake 2: Arena** demonstrates this approach by bundling and registering custom third-party fonts (`amstrad-pc-8x8` + `ati-smallw-6x8`) inside its own module chunk (`demos-games-*.js`).

### 4. Consequences

- **Positive**:
  - Zero runtime dependencies; deterministic 1-bit pixel rendering across every browser, OS, and renderer backend (`Canvas 2D` and `WebGL`).
  - Effortless localization into Polish, German, Czech, Finnish, and other Latin-script languages with compile-time locale coverage verification.
  - Clean bundle separation: engine default fonts reside in `engine-*.js`, while game-specific custom fonts stay isolated inside `demos-games-*.js`.
- **Negative / Trade-offs**:
  - Pure vector `.ttf` fonts without embedded bitmap strikes must either be converted to `.bdf`/`.otb` or rasterized via an offscreen canvas bakery step before being serialized into `.vfont.json` / `.ts`.
