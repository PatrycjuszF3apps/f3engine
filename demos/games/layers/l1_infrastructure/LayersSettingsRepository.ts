import {
  ColorPalette,
  StorageStore,
  VideoFilterPalette,
  VideoFilterType,
  ViewportAspectRatio,
  createServiceToken,
} from '../../../../engine';
import type { SupportedLocale } from '../l3_interaction/LayersI18nService';
import type { DepthSortStrategyMode } from '../l4_domain/BackdropUniverseService';

export interface LayersPersistedState extends Record<string, unknown> {
  language: SupportedLocale;
  sortMode: DepthSortStrategyMode;
  videoFilter: VideoFilterType;
}

export const DEFAULT_LAYERS_STATE: LayersPersistedState = {
  language: 'en',
  sortMode: 'wave',
  videoFilter: 'none',
};

export const LAYERS_VIEWPORT_DEFAULTS: {
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

const LAYERS_PALETTE_DEFINITIONS: Record<
  VideoFilterType,
  { definition: VideoFilterPalette; pixelated: boolean }
> = {
  none: {
    pixelated: false,
    definition: {
      bgOuter: '#090d1a',
      panelBg: '#162038',
      panelAlt: '#0d1426',
      border: '#334155',
      borderHighlight: '#38bdf8',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textInverse: '#082f49',
      accent: '#0ea5e9',
      accentBright: '#38bdf8',
      overlayDim: '#070a14',
      boardBgEven: '#0c1324',
      boardBgOdd: '#111a30',
      primaryEntityHead: '#38bdf8',
      primaryEntityBody: '#22c55e',
      primaryEntityEye: '#facc15',
      targetFill: '#f43f5e',
      targetHighlight: '#c084fc',
    },
  },
  crt: {
    pixelated: false,
    definition: {
      bgOuter: '#040910',
      panelBg: '#0d2030',
      panelAlt: '#081420',
      border: '#1d4d6e',
      borderHighlight: '#5eff9e',
      textMain: '#e0f2fe',
      textMuted: '#7dd3fc',
      textInverse: '#03220e',
      accent: '#27e86b',
      accentBright: '#5eff9e',
      overlayDim: '#03070c',
      boardBgEven: '#07121c',
      boardBgOdd: '#0b1927',
      primaryEntityHead: '#5eff9e',
      primaryEntityBody: '#38bdf8',
      primaryEntityEye: '#fde047',
      targetFill: '#ff4252',
      targetHighlight: '#e879f9',
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
      targetHighlight: '#306230',
    },
  },
};

export function createLayersPalettes(): Record<VideoFilterType, ColorPalette> {
  return {
    none: new ColorPalette(
      LAYERS_PALETTE_DEFINITIONS.none.definition,
      LAYERS_PALETTE_DEFINITIONS.none.pixelated
    ),
    crt: new ColorPalette(
      LAYERS_PALETTE_DEFINITIONS.crt.definition,
      LAYERS_PALETTE_DEFINITIONS.crt.pixelated
    ),
    nokia: new ColorPalette(
      LAYERS_PALETTE_DEFINITIONS.nokia.definition,
      LAYERS_PALETTE_DEFINITIONS.nokia.pixelated
    ),
  };
}

export interface ILayersSettingsRepository {
  getStore(): StorageStore<LayersPersistedState>;
  getPalettes(): Record<VideoFilterType, ColorPalette>;
}

export const LAYERS_L1_TOKENS = {
  SettingsRepository: createServiceToken<
    ILayersSettingsRepository,
    'L1_INFRASTRUCTURE'
  >(
    'L1_INFRASTRUCTURE',
    'layers.l1.settings_repository',
    'Provides persistent settings storage and filter palettes for the Layers demo.'
  ),
} as const;

const STORAGE_KEY = 'f3engine_layers_settings_v1';

export class LayersSettingsRepository implements ILayersSettingsRepository {
  private readonly store: StorageStore<LayersPersistedState>;
  private readonly palettes: Record<VideoFilterType, ColorPalette>;

  constructor(existingStore?: StorageStore<LayersPersistedState>) {
    this.store =
      existingStore ??
      new StorageStore<LayersPersistedState>(STORAGE_KEY, DEFAULT_LAYERS_STATE);
    this.palettes = createLayersPalettes();
  }

  public getStore(): StorageStore<LayersPersistedState> {
    return this.store;
  }

  public getPalettes(): Record<VideoFilterType, ColorPalette> {
    return this.palettes;
  }
}
