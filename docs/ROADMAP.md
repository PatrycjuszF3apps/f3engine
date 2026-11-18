# f3engine — Non-Linear Idea Map (`ROADMAP.md`)

This document serves as an **open, non-chronological Idea Map** for **f3engine**. Ideas listed here have no forced execution order and can be picked up, expanded, or combined independently at any time.

---

## 1. Documentation & Developer Experience (DX)

### [Idea] Developer Guide: Creating an Application or Game from Scratch
- **Goal**: Provide a comprehensive developer documentation suite explaining how to build a 2D game or application on top of `f3engine` from zero, use built-in controls, and extend engine/application classes.
- **Core Deliverables & Sections**:
  1. **Starter Boilerplate / Application Skeleton**:
     - Ready-to-use, minimal skeleton project structure (`manifest.json`, `locales/en.json`, `locales/pl.json`, `AppRootNode` subclass, `CanvasNode` subclass, and `index.ts` exporting a `DemoSession`).
     - Minimal runnable template that boots a viewport, renders a custom canvas, and wires a basic shell/menu out of the box.
  2. **Controls Usage Guide (`UIKit.ClassicV1` Cookbook)**:
     - Practical guide on instantiating, composing, and wiring built-in controls: `ResponsiveAppShellNode`, `HeaderBarControl`, `ControlDeckControl`, `DPadControl`, `MenuListControl`, `MenuActionItemControl`, `MenuChoiceItemControl`, `ChoicePillControl`.
     - Managing modal flows and cascading sub-dialogs (`ModalDialogNode.openSubDialog()` / `closeSubDialog()`, `SettingsDialogNode`, `ReadyPromptDialogNode`) with automatic focus/selection restoration.
  3. **Class Extension, Containerization & OOP Inheritance Guide**:
     - How to extend core base classes (`Node`, `CanvasNode`, `ContainerNode`, `ControlNode`, `AppRootNode`).
     - Overriding template methods (`onUpdate`, `onRender`, `onControlEvent`, `onResetState`, `onDestroy`) and attaching lifecycle phase hooks (`BEFORE_UPDATE`, `AFTER_UPDATE`, `BEFORE_RENDER`, `AFTER_RENDER`).
     - Controlling child subtrees via cascading parent authority (`freeze`, `unfreeze`, `hide`, `show`, `enable`, `disable`, `resetState`, `unload`).
     - Composing multi-layer gameplay stages (e.g., stacking `ParallaxNode` + `DestructibleTerrainNode` + `ParticleSystemNode` inside a single board container) and knowing the **architectural boundary of when to use `Node` vs. plain data structures**.
  4. **Surface Rendering, Palettes, Fonts & Input Reference**:
     - Drawing on `IVirtualSurface` with semantic `ColorPalette` slots and respecting `palette.pixelated`.
     - Consuming normalized `ControlEvent` instances (`DIRECTION`, `ACTION`, `POINTER`, `GAMEPAD_STATUS`, `RAW_KEY`) from `InputRouter`.
     - Using `I18nManager` and compiling custom bitmap fonts (`VirtualFontSpec` via `npm run compile-font`).

---

## 2. Build Pipeline, Security & Production Packaging

### [Idea] Production Compilation Mode: Disabling `degub_bar/` & Stripping `EngineDebugHooks`
- **Goal**: Ensure that when an application or game is compiled for production deployment, all development/debug tooling is completely disabled and debug hooks are inaccessible.
- **Core Requirements**:
  1. **Disable & Exclude `degub_bar/` in Production Builds**:
     - Production builds must not mount `DebugToolbar` or bundle the `degub_bar/` chunk (`dist/assets/debug-bar-*.js`) into the final production release of an application/game.
  2. **Disable / Strip `EngineDebugHooks` Exposure**:
     - Hooks dedicated to `degub_bar/` (`viewport.getDebugHooks()`, runtime grid/aspect/scale overrides, renderer backend switching, palette forcing, and debug state subscriptions) must be unavailable in production mode.
  3. **Clean Separation of Dev vs. Prod Targets**:
     - Support running full debug instrumentation (`DebugToolbar` + `EngineDebugHooks`) in development/demo-preview modes while producing a locked-down, minimal production bundle (`engine` + target application only).

---

## 3. Gameplay Stage Composition, Containerization & `Node` Boundaries

A core architectural principle of **f3engine** is leveraging `Node` **inheritance and containerization** not only for UI menus/dialogs, but directly inside the **gameplay rendering pipeline**, while maintaining a strict boundary against over-engineering with nodes.

### 3.1. Transparent Multi-Sub-Engine Stage Composition
- A game field/stage (`GameStageNode extends CanvasNode`) acts as a **container** that mounts independent rendering sub-modules as child `CanvasNode` layers rendered in deterministic `zIndex` order onto the shared `IVirtualSurface`:
  ```text
  GameStageNode (Parent CanvasNode Container — manages viewport bounds & game state)
  ├── ParallaxBackdropNode (zIndex: 0 — renders multi-plane scrolling sky/mountains in background)
  ├── DestructibleTerrainNode (zIndex: 10 — renders pixel-mask terrain with transparent Air pixels)
  ├── GameplayEntitiesLayerNode (zIndex: 20 — renders characters, projectiles, aiming reticles)
  └── ParticleSystemNode (zIndex: 30 — renders explosions, smoke, and debris bursts on top)
  ```
- **Transparent Orchestration**:
  - Calling `gameStage.freeze()` (e.g., when opening a Pause modal) or `gameStage.resetState()` automatically cascades down to the parallax, terrain, entities, and particle sub-nodes without manual wiring.
  - Sub-modules remain completely decoupled: `ParallaxBackdropNode` knows nothing about `DestructibleTerrainNode`, yet they composite seamlessly within the same viewport frame.

### 3.2. Architectural Boundary: When to Use `Node` vs. When NOT to Use `Node`

| Guideline | Use `Node` (`CanvasNode` / `ContainerNode` / `ControlNode`) | Optional / Hybrid (`Node` or Plain Entity) | Do NOT Use `Node` (Use Plain Classes / Typed Arrays) |
| :--- | :--- | :--- | :--- |
| **Granularity** | Coarse-grained visual layers, sub-engines, screens, dialogs, and UI controls (`1–30` per scene). | Medium-grained interactive board objects (e.g., draggable tabletop cards, distinct interactive stations). | Fine-grained primitives, grid cells, terrain pixels, individual particles, or bullets (`100–100,000+` items). |
| **Why** | Needs lifecycle hooks (`onUpdate`/`onRender`), cascading states (`freeze`, `hide`, `modal`), `zIndex` layering, or `InputRouter` event routing. | Useful when each object benefits from built-in pointer hit-testing (`containsPoint`) and `onControlEvent`. | Tree traversal, hook dispatch, and object allocation overhead per frame would hurt performance and clutter the scene graph. |
| **Concrete Examples** | `ParallaxNode`, `DestructibleTerrainNode`, `HexGridBoardNode`, `ParticleSystemNode` (the emitter container), `MenuListControl`, `ModalDialogNode`. | Interactive card slots in a deckbuilder; a multi-part boss or interactive control panel widget. | Individual snake segments, single hex/square grid cells, single terrain pixels (`Uint8Array`), individual particle sparks, vector/ballistics math helpers (`BallisticsEngine`, `Collision2D`). |

---

## 4. 2D Game Categorization & Engine Spatial/Board Sub-Modules

Rather than generic genre labels, 2D games in **f3engine** are categorized by their **board/world geometry, rendering mechanics, and spatial representation**. Each category maps directly to a dedicated, reusable engine sub-module (base `CanvasNode` specialization):

### 4.1. Hexagonal Grid Sub-Module (`HexGridBoardNode` / Hex Engine Module)
- **Rendering Mechanics**: Pointed-top and flat-top hexagonal tile grids rendered onto `IVirtualSurface` with crisp pixel-art hex outlines, fill patterns, and cell highlights.
- **Interaction & Coordinate Math**:
  - Axial `(q, r)` / Cube `(q, r, s)` coordinate systems and 6-direction neighbor navigation.
  - Pixel-to-Hex hit testing (`POINTER` hover/click picking the exact hex cell) and Hex-to-Pixel center lookup.
  - Built-in helpers for hex distance, movement range rings, line-of-sight, and A* pathfinding on hex grids.
- **Target Games**: Tactical turn-based combat (*Heroes* / *Panzer General* style), 4X strategy boards, hex puzzle games, hex-based territory control.

### 4.2. Orthogonal Square Grid Sub-Module (`OrthoGridBoardNode`)
- **Rendering Mechanics**: `N × M` square/rectangular cell matrix with configurable cell size, borders, and layer rendering.
- **Interaction & Coordinate Math**:
  - 4-way (cardinal) and 8-way (diagonal) discrete movement, cell occupancy queries, and matrix collision checks.
  - Pixel-to-Cell pointer picking and tick-based or turn-based stepping.
- **Target Games**: Grid arcade (*Snake*, *Tetris*, *Bomberman*), logic puzzles (*Sokoban*, *Minesweeper*), grid roguelikes.

### 4.3. Isometric / 2.5D Diamond Grid Sub-Module (`IsoGridBoardNode`)
- **Rendering Mechanics**: Classic `2:1` pixel-art isometric diamond projection with automatic depth sorting (`painter's algorithm` by `x + y + z` elevation).
- **Interaction & Coordinate Math**:
  - Screen-pixel to isometric tile `(isoX, isoY)` conversion for accurate mouse/pointer picking and directional navigation mapped to isometric axes.
- **Target Games**: Isometric tactical RPGs, retro city-builders / tycoons, isometric puzzle/adventure rooms.

### 4.4. Continuous Free-Space / Kinematic Arcade Sub-Module (`ArcadeStageNode`)
- **Rendering Mechanics**: Sub-cell / pixel-coordinate entity rendering with sprites or geometric primitives inside a fixed or scrolling arena.
- **Interaction & Coordinate Math**:
  - Continuous `dt`-driven positions and viewport boundary handling.
- **Target Games**: *Breakout / Arkanoid*, *Pong*, *Space Invaders / Shmups*, *2D Platformers*.

### 4.5. Scrolling Tilemap & Camera World Sub-Module (`ScrollingWorldNode` + `Camera2D`)
- **Rendering Mechanics**: Multi-layer tilemaps larger than the virtual viewport rendered through a movable `Camera2D` (panning, target tracking, viewport culling).
- **Interaction & Coordinate Math**:
  - World-space ↔ Viewport-space coordinate transforms, solid/trigger tile collisions, and camera-relative pointer picking.
- **Target Games**: Top-down RPGs (*Zelda* / *Pokémon* style), large scrolling strategy maps, side-scrolling exploration.

### 4.6. Destructible Pixel-Terrain Sub-Module (`DestructibleTerrainNode` — *Worms 2D / Lemmings / Liero* Terrain)
- **Rendering & Generation Mechanics**:
  - Per-pixel material bitmask/buffer (`Uint8Array` terrain states: `Air`, `Destructible Soil`, `Indestructible Rock`, `Liquid/Water`) synchronized with `IVirtualSurface` and `ColorPalette`.
  - Procedural 2D landscape generator (heightmaps, hills, cavern tunnels, bridges) with automatic top-crust / border shading; transparent `Air` pixels allow underlying child/sibling nodes (such as `ParallaxNode`) to show through effortlessly.
- **Deformation & Surface Mechanics**:
  - Real-time Boolean pixel operations: carving circular/polygonal craters on explosion, drilling tunnels, or stamping constructive terrain (girders, bridges, dirt).
  - Local surface normal estimation `(nx, ny)` at any terrain pixel for accurate projectile bounce angles and character slope walking.
- **Target Games**: 2D artillery games (*Worms 2D*, *Scorched Earth*), real-time cave shooters (*Liero*), terrain puzzle games (*Lemmings*).

---

## 5. Visual Effects, Layering & Graphics Sub-Modules

Dedicated engine sub-modules for rendering sprites, depth layers, and visual effects on `IVirtualSurface` while strictly preserving `ColorPalette` indexing and retro filters (`None`, `CRT`, `Old Nokia`):

### 5.1. Parallax Generation & Rendering Sub-Module (`ParallaxNode` / `ParallaxLayer`)
- **Multi-Plane Depth Scrolling**: Horizontal, vertical, or 2D omni-directional parallax planes with configurable depth speed multipliers (`scrollFactorX`, `scrollFactorY`), auto-scrolling drift, and seamless infinite wrapping/tiling.
- **Procedural & Sprite-Based Generators**: Built-in generators for classic retro parallax backdrops (multi-speed starfields, horizon grids, silhouettes/mountains, cloud bands) alongside custom sprite/tile layers.
- **Node Tree Integration**: Mountable as a background `CanvasNode` child behind any game board or stage (`ArcadeStageNode`, `ScrollingWorldNode`, `DestructibleTerrainNode`).

### 5.2. Sprite & Animation Sub-Module (`Sprite`, `SpriteAtlas`, `AnimatedSpriteNode`)
- **Palette-Indexed & 1-Bit Sprites**: Compact sprite representations using semantic `ColorPalette` slots (with transparency mask and dynamic palette-slot swapping to recolor sprites per player/state).
- **Sprite Sheets & Frame Animations**: Support for multi-frame animation clips (`loop`, `ping-pong`, `once`), frame timing (`fps` / per-frame duration), horizontal/vertical flipping (`flipX`, `flipY`), and 90°/pixel-safe rotation.
- **Ahead-of-Time / Runtime Asset Pipeline**: Tools/helpers to compile `.png` or pixel-array sprite sheets into deterministic palette-indexed `VirtualSpriteSpec` structures (mirroring `VirtualFontSpec`).

### 5.3. Particle & Screen-Space Feedback Effects (`ParticleSystemNode`, `ViewportFX`)
- **2D Pixel Particle Emitter (`ParticleSystemNode`)**: Lightweight pixel/sprite bursts for explosions, terrain debris, pickups, trails, and weather effects using palette tokens.
- **Screen-Space Transitions & Camera FX**: Screen shake, hit-stop/freeze-frames, palette flash, and pixel-dithered wipe/fade transitions.

---

## 6. Simplified 2D Physics & Ballistics Sub-Modules (`engine/physics/`)

Standalone, zero-dependency 2D physics modules (implemented as lightweight non-Node services/solvers) that can be paired with `DestructibleTerrainNode`, `ArcadeStageNode`, or `ScrollingWorldNode`:

### 6.1. Ballistics & Projectile Physics Sub-Module (`BallisticsEngine`)
- **Trajectory & Environmental Simulation**:
  - Launch angle + initial velocity/power kinematics affected by configurable gravity, wind force vectors, and air drag.
  - **Trajectory Preview Helper**: Deterministic step-predictor to render aiming reticles and dotted parabolic preview arcs before firing.
- **Impact, Bounce & Explosion Mechanics**:
  - **Surface Normal Restitution**: Bouncing projectiles (grenades, cluster bombs, shells) reflecting off pixel-terrain normals or `AABB` walls with configurable bounciness and friction.
  - **Fuses & Fragmentation**: Contact detonation, timed fuses, and secondary sub-munition spawning (cluster fragments).
  - **Radial Blast Shockwaves**: Distance-falloff impulse calculation pushing nearby entities away from the explosion center and triggering terrain crater carving.

### 6.2. Pixel-Slope & Kinematic Body Physics (`KinematicBody2D`)
- **Terrain-Aware Character Movement**: Walking along irregular pixel terrain (auto-stepping up small pixel heights, blocking on steep cliffs, sliding down slopes), jumping arcs, falling under gravity when terrain underneath is destroyed, and knockback state transitions.

### 6.3. Arcade Collision & Reflection Primitives (`Collision2D`)
- **Fast Geometric & Pixel-Mask Checks**: `AABB`-to-`AABB`, Circle-to-Circle, Circle-to-`AABB`, Raycast/Line-of-Sight stepping, and Sprite-Mask-to-Terrain-Mask pixel-perfect overlap detection.
