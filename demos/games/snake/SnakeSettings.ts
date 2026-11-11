import {
  ColorPalette,
  VideoFilterPalette,
  VideoFilterType,
  ViewportAspectRatio,
} from '../../../engine';
import { StringId, SupportedLocale } from './i18n';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyPreset {
  labelId: StringId;
  baseIntervalMs: number;
  minIntervalMs: number;
  stepEveryPoints: number;
  speedDecrementMs: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    labelId: 'difficulty.easy',
    baseIntervalMs: 165,
    minIntervalMs: 85,
    stepEveryPoints: 40,
    speedDecrementMs: 6,
  },
  medium: {
    labelId: 'difficulty.medium',
    baseIntervalMs: 130,
    minIntervalMs: 60,
    stepEveryPoints: 30,
    speedDecrementMs: 8,
  },
  hard: {
    labelId: 'difficulty.hard',
    baseIntervalMs: 92,
    minIntervalMs: 45,
    stepEveryPoints: 20,
    speedDecrementMs: 7,
  },
};

/**
 * Default Virtual Viewport configuration for the Snake demo:
 * - Virtual grid width: 300 virtual pixels
 * - Aspect ratio: 4:3 Portrait (3:4 -> 300x400 virtual pixels)
 * - Physical window scaling: 50% of browser stage + centered
 */
export const SNAKE_VIEWPORT_DEFAULTS: {
  virtualWidth: number;
  aspectRatio: ViewportAspectRatio;
  windowScalePercent: number;
  lockAspectRatio: boolean;
} = {
  virtualWidth: 300,
  aspectRatio: '4:3-portrait',
  windowScalePercent: 50,
  lockAspectRatio: true,
};

/**
 * Declared color palettes for the Snake demo (for each video filter mode).
 * Virtual pixels on the virtual grid are strictly constrained to the active palette.
 */
const SNAKE_PALETTE_DEFINITIONS: Record<
  VideoFilterType,
  { definition: VideoFilterPalette; pixelated: boolean }
> = {
  none: {
    pixelated: false,
    definition: {
      bgOuter: '#0b1120',
      panelBg: '#1e293b',
      panelAlt: '#0f172a',
      border: '#334155',
      borderHighlight: '#4ade80',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textInverse: '#052e16',
      accent: '#22c55e',
      accentBright: '#4ade80',
      overlayDim: '#090d16',
      boardBgEven: '#0f172a',
      boardBgOdd: '#131c31',
      primaryEntityHead: '#4ade80',
      primaryEntityBody: '#22c55e',
      primaryEntityEye: '#052e16',
      targetFill: '#ef4444',
      targetHighlight: '#fca5a5',
    },
  },
  crt: {
    pixelated: false,
    definition: {
      bgOuter: '#050b11',
      panelBg: '#0f2230',
      panelAlt: '#091520',
      border: '#1e4968',
      borderHighlight: '#38bdf8',
      textMain: '#e0f2fe',
      textMuted: '#7dd3fc',
      textInverse: '#03220e',
      accent: '#27e86b',
      accentBright: '#5eff9e',
      overlayDim: '#04090e',
      boardBgEven: '#09131c',
      boardBgOdd: '#0d1b28',
      primaryEntityHead: '#5eff9e',
      primaryEntityBody: '#27e86b',
      primaryEntityEye: '#03220e',
      targetFill: '#ff4252',
      targetHighlight: '#ffb3b9',
    },
  },
  nokia: {
    pixelated: true,
    definition: {
      bgOuter: '#8bac0f',
      panelBg: '#9bbc0f',
      panelAlt: '#8bac0f',
      border: '#306230',
      borderHighlight: '#0f380f',
      textMain: '#0f380f',
      textMuted: '#306230',
      textInverse: '#9bbc0f',
      accent: '#0f380f',
      accentBright: '#0f380f',
      overlayDim: '#8bac0f',
      boardBgEven: '#9bbc0f',
      boardBgOdd: '#8bac0f',
      primaryEntityHead: '#0f380f',
      primaryEntityBody: '#306230',
      primaryEntityEye: '#9bbc0f',
      targetFill: '#0f380f',
      targetHighlight: '#8bac0f',
    },
  },
};

export function createSnakePalettes(): Record<VideoFilterType, ColorPalette> {
  return {
    none: new ColorPalette(
      SNAKE_PALETTE_DEFINITIONS.none.definition,
      SNAKE_PALETTE_DEFINITIONS.none.pixelated
    ),
    crt: new ColorPalette(
      SNAKE_PALETTE_DEFINITIONS.crt.definition,
      SNAKE_PALETTE_DEFINITIONS.crt.pixelated
    ),
    nokia: new ColorPalette(
      SNAKE_PALETTE_DEFINITIONS.nokia.definition,
      SNAKE_PALETTE_DEFINITIONS.nokia.pixelated
    ),
  };
}

export interface SnakePersistedState extends Record<string, unknown> {
  language: SupportedLocale;
  difficulty: Difficulty;
  videoFilter: VideoFilterType;
  highScore: number;
}

export const DEFAULT_SNAKE_STATE: SnakePersistedState = {
  language: 'en',
  difficulty: 'medium',
  videoFilter: 'none',
  highScore: 0,
};
