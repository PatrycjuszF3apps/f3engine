# Game Design Document (GDD) — Snake Demos

## 1. High Concept
Two classic arcade **Snake** applications built on **f3engine**, combining responsive grid gameplay with retro display emulation (**CRT Scanlines** and **Old Nokia 3310 LCD**), multi-font pixel-mask typography, and the hierarchical `AppRootNode` + `UIKit.ClassicV1` control architecture:
- **Demo 1 (`demos/games/snake`)**: Classic 20×20 arcade Snake (`SnakeAppRootNode extends AppRootNode`, `SnakeBoardNode extends CanvasNode`) using two built-in **Engine Default Fonts** simultaneously (`IBM PC BIOS 8×8` for titles/headings/score values and `HP 100LX 6×8` for HUD controls, badges, and menus).
- **Demo 2 (`demos/games/snake2`)**: **Snake 2: Arena** (`Snake2ArenaBoardNode extends SnakeBoardNode`) featuring four corner L-shaped obstacle pillars, a gold/violet cyberpunk palette, two simultaneous apples on the board, and **Custom Game-Bundled Third-Party Fonts** (`demos/games/snake2/fonts/`: `Amstrad PC 8×8` for headings/scores and `ATI SmallWonder 6×8` with NFD-synthesized national diacritics for HUD and body text).

---

## 2. Core Application & Gameplay Flow

```mermaid
flowchart LR
    Title["TitleDialog (ModalDialogNode)"] -->|New Game| Ready["ReadyPromptDialogNode"]
    Ready -->|Normalized Direction / Key / Click| Gameplay["SnakeBoardNode (Running)"]
    Title -->|openSubDialog| Settings["SettingsDialogNode (Cascaded Child)"]
    Settings -->|Close / Back / Cancel| Title
    Gameplay -->|Pause / Cancel Action| Pause["PauseDialog (ModalDialogNode)"]
    Pause -->|Resume| Ready
    Pause -->|openSubDialog| Settings
    Gameplay -->|Wall / Obstacle / Tail Collision| GameOver["GameOverDialog (ModalDialogNode)"]
    GameOver -->|New Game| Ready
    GameOver -->|openSubDialog| Settings
    GameOver -->|Title Screen| Title
```

1. Players start on the **Title Dialog**, where they can launch a new game or open **Settings** (`SettingsDialogNode` opened as a cascading child sub-dialog of the active modal) to configure language (`English` / `Polski`), difficulty, and video filter.
2. Before movement begins, the **Ready Prompt Dialog** freezes `SnakeBoardNode` until the player triggers any key, gamepad button, directional input, or pointer click. If confirmed with a directional input (`UP`/`DOWN`/`LEFT`/`RIGHT`), `SnakeBoardNode` immediately queues that initial direction.
3. Eating an apple:
   - Grows the snake by **1 segment**,
   - Awards points (**+10 pts** in Classic Snake, **+15 pts** in Snake 2: Arena) and updates the persisted high score in `localStorage`,
   - Increases movement speed according to the active difficulty preset.
4. Colliding with the board border, an arena pillar (in Snake 2), or the snake's own tail freezes the board node and opens the **Game Over Dialog**.

---

## 3. Difficulty Presets

Difficulty is persisted in `localStorage`. Parameters defined in `SnakeSettings.ts`:

| Difficulty | Initial Interval (`baseIntervalMs`) | Minimum Interval (`minIntervalMs`) | Speedup Step (`stepEveryPoints`) | Interval Decrement (`speedDecrementMs`) | Profile |
|------------|-------------------------------------|------------------------------------|----------------------------------|-----------------------------------------|---------|
| **Easy**   | `165 ms` | `85 ms` | `40 pts` | `-6 ms` | Relaxed pace, gentle acceleration |
| **Medium** | `130 ms` | `60 ms` | `30 pts` | `-8 ms` | Balanced arcade challenge (default) |
| **Hard**   | `92 ms`  | `45 ms` | `20 pts` | `-7 ms` | Fast starting speed, rapid acceleration |

---

## 4. Video Filters & Palettes (`VideoFilterManager`)

Each demo supports three real-time visual profiles:

### 4.1. `None` (`none`)
- **Style**: Crisp dark theme (`#0f172a` / `#1e293b` in Classic Snake; deep violet/amber `#090614` / `#1b1336` in Snake 2: Arena).
- **Virtual Surface Rendering**: Subtle checkerboard cells, rounded snake segments with directional eyes, and highlighted target apples.

### 4.2. `CRT Scanlines` (`crt`)
- **Style**: Arcade cathode-ray tube monitor simulation.
- **Visual Effects**: Horizontal scanline overlay (`background-size: 100% 4px`), corner vignette darkening, boosted contrast/saturation, and glowing frame border.

### 4.3. `Old Nokia` (`nokia`)
- **Style**: Faithful monochrome LCD emulation inspired by the **Nokia 3310**.
- **Color Palette**: Olive LCD background (`#9bbc0f` / `#8bac0f`) and dark green pixels (`#0f380f` / `#306230`).
- **Virtual Surface Rendering (`pixelated: true`)**:
  - Sharp square LCD blocks with 1px inter-segment gaps instead of rounded corners.
  - Classic hollow diamond pixel pattern for apples.
  - Double outer border with a fine CSS LCD pixel grid overlay.

---

## 5. Normalized Controls & UX (`InputRouter` + `UIKit.ClassicV1`)

- **Normalized Direction Queue (`directionQueue`)**: `SnakeBoardNode` receives normalized `DirectionControlEvent`s (`UP`, `DOWN`, `LEFT`, `RIGHT`) regardless of whether they originated from the keyboard, a gamepad, or the on-screen `DPadControl`, buffering up to 2 directional changes per logic tick.
- **Multi-Modal Navigation**:
  - **Keyboard**: `Arrow Keys` / `WASD` to steer or navigate `MenuListControl` items, `Enter` / `Space` (`CONFIRM`), `Escape` / `Backspace` (`CANCEL`), `P` (`PAUSE`), `R` (`RESTART`).
  - **Gamepad**: D-Pad and analog sticks with deadzone, `A` (`CONFIRM`), `B` (`CANCEL`), `Start` (`PAUSE`), `X`/`Y` (`RESTART`), plus `dual-rumble` vibration on scoring and game over.
  - **Mouse / Pointer**: Automatic `ControlNode` hit-testing across `DPadControl` buttons, HUD action buttons (`MENU`, `PAUSE`, `RESTART`), `MenuActionItemControl` rows, and `ChoicePillControl` options.
