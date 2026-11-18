# Snake 2: Arena — Reference OOP Extension & Game Design Document

**Snake 2: Arena** (`demos/games/snake2/`) is a self-contained arena variant built on **f3engine**. It demonstrates how a standalone application can **extend an existing application class hierarchy via OOP inheritance** (`Snake2ArenaBoardNode extends SnakeBoardNode`) while bundling its own `manifest.json`, custom AOT-compiled bitmap fonts (`fonts/`), custom color palettes, and isolated persistence key.

---

## 1. Application Directory Structure

```text
demos/games/snake2/
├── README.md                   # Application overview, OOP extension guide & Game Design Document (GDD)
├── manifest.json               # AppManifest declaring id ("snake2"), app version, and target engineVersion ("1.2.0")
├── index.ts                    # Application entrypoint registering custom fonts and mounting Snake2ArenaBoardNode
├── Snake2ArenaBoardNode.ts     # Subclass of SnakeBoardNode adding corner L-pillars, dual apples & +15 pt scoring
└── fonts/
    ├── index.ts                # Exports compiled custom VirtualFontSpec definitions
    ├── amstradPc8x8Font.ts     # Compiled 1-bit pixel-mask font: Amstrad PC 8×8 (Headings & Scores)
    └── atiSmallW6x8Font.ts     # Compiled 1-bit pixel-mask font: ATI SmallWonder 6×8 (HUD & Body text with NFD diacritics)
```

---

## 2. High Concept & OOP Reuse Architecture

Instead of duplicating UI layout, modal orchestration, or input handling, **Snake 2: Arena** reuses `SnakeAppRootNode` and injects `Snake2ArenaBoardNode` (`Snake2ArenaBoardNode extends SnakeBoardNode`), overriding five protected template methods:

| Overridden Method in `Snake2ArenaBoardNode` | Classic Snake (`SnakeBoardNode`) | Snake 2: Arena (`Snake2ArenaBoardNode`) |
| :--- | :--- | :--- |
| `createObstacles()` | No internal board obstacles (`[]`) | **4 corner L-shaped obstacle pillars** (`12` solid cells at `(5..6, 5..6)`, `(13..14, 5..6)`, `(5..6, 13..14)`, `(13..14, 13..14)`) |
| `getTargetFoodCount()` | `1` apple on the board at a time | **`2` simultaneous apples** active on the board at all times |
| `getPointsPerFood()` | `+10 pts` per apple | **`+15 pts` per apple** |
| `getOuterBorderToken(pixelated)` | `'border'` (`'primaryEntityHead'` when pixelated) | `'borderHighlight'` (`'primaryEntityHead'` when pixelated) |
| `shouldDrawSnakeEyes()` | `true` | `false` (streamlined cyber-segment silhouette) |

---

## 3. Custom Application-Bundled Fonts (`demos/games/snake2/fonts/`)

**Snake 2: Arena** bundles two custom third-party retro PC bitmap fonts compiled ahead-of-time into `VirtualFontSpec` 1-bit pixel masks via `npm run compile-font` with full national character coverage (`en`, `pl`, `de`, `cs`, `fi`):
- **Heading Font (`AMSTRAD_PC_8X8_FONT`)**: *Amstrad PC 8×8* — bold 8×8 display typography for modal headers, brand badges, and score counters.
- **Body Font (`ATI_SMALLW_6X8_FONT`)**: *ATI SmallWonder 6×8* — compact 6×8 UI font with NFD-synthesized diacritics for buttons, pill selectors, and localized subtitles.

At mount time (`index.ts`), the application registers both fonts with `VirtualFont.registerFont(...)` and assigns them to `VirtualUIDecorator.setFonts({ body: ATI_SMALLW_6X8_FONT, heading: AMSTRAD_PC_8X8_FONT })`.

---

## 4. Arena Palettes & Video Filters

- **`None` (`none`)**: Cyberpunk deep-violet arena (`#090614` / `#1b1336`) with high-contrast amber/gold snake segments (`#fbbf24` / `#f59e0b`) and magenta dual targets (`#ec4899`).
- **`CRT Scanlines` (`crt`)**: High-contrast violet/cyan CRT cabinet theme (`#06030d` / `#180f30`) with sky-blue border highlights (`#38bdf8`), golden snake segments (`#fde047`), and scanline/vignette post-processing.
- **`Old Nokia` (`nokia`)**: Monochrome Nokia 3310 LCD palette (`pixelated: true`, `#9bbc0f` / `#0f380f`) rendering sharp LCD blocks for the snake, corner L-pillars, and hollow-diamond targets.
