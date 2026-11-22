import {
  ColorPalette,
  StorageStore,
  VideoFilterPalette,
  VideoFilterType,
  ViewportAspectRatio,
  createServiceToken,
} from '../../../../engine';
import type { Difficulty } from '../l4_domain/SnakeSimulationService';
import type { SupportedLocale } from '../l3_interaction/SnakeI18nService';

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

export interface ISnakeSettingsRepository {
  getStore(): StorageStore<SnakePersistedState>;
  getPalettes(): Record<VideoFilterType, ColorPalette>;
}

export const SNAKE_L1_TOKENS = {
  SettingsRepository: createServiceToken<
    ISnakeSettingsRepository,
    'L1_INFRASTRUCTURE'
  >(
    'L1_INFRASTRUCTURE',
    'snake.l1.settings_repository',
    'Provides persistent settings storage and filter color palettes for Snake.'
  ),
} as const;

const STORAGE_KEY = 'f3engine_snake_settings_v1';

export class SnakeSettingsRepository implements ISnakeSettingsRepository {
  private readonly store: StorageStore<SnakePersistedState>;
  private readonly palettes: Record<VideoFilterType, ColorPalette>;

  constructor(existingStore?: StorageStore<SnakePersistedState>) {
    this.store =
      existingStore ??
      new StorageStore<SnakePersistedState>(STORAGE_KEY, DEFAULT_SNAKE_STATE);
    this.palettes = createSnakePalettes();
  }

  public getStore(): StorageStore<SnakePersistedState> {
    return this.store;
  }

  public getPalettes(): Record<VideoFilterType, ColorPalette> {
    return this.palettes;
  }
}
