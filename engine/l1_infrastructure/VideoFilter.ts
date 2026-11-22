import { ColorPalette, PaletteDefinition } from './Palette';
import { VirtualViewport } from './VirtualViewport';

export type VideoFilterType = 'none' | 'crt' | 'nokia';

export interface VideoFilterPalette extends PaletteDefinition {
  bgOuter: string;
  panelBg: string;
  panelAlt: string;
  border: string;
  borderHighlight: string;
  textMain: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  accentBright: string;
  overlayDim: string;
  boardBgEven: string;
  boardBgOdd: string;
  primaryEntityHead: string;
  primaryEntityBody: string;
  primaryEntityEye: string;
  targetFill: string;
  targetHighlight: string;
}

const DEFAULT_FILTER_PALETTES: Record<
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

/**
 * Engine module responsible for applying video filters (None, CRT Scanlines, Old Nokia)
 * to the virtual viewport container and supplying the corresponding ColorPalette.
 */
export class VideoFilterManager {
  private readonly targets: HTMLElement[];
  private readonly palettes: Record<VideoFilterType, ColorPalette>;
  private viewport: VirtualViewport | null = null;
  private currentFilter: VideoFilterType = 'none';

  constructor(
    targets: HTMLElement[],
    customPalettes?: Partial<Record<VideoFilterType, ColorPalette>>
  ) {
    this.targets = targets;
    this.palettes = {
      none:
        customPalettes?.none ??
        new ColorPalette(
          DEFAULT_FILTER_PALETTES.none.definition,
          DEFAULT_FILTER_PALETTES.none.pixelated
        ),
      crt:
        customPalettes?.crt ??
        new ColorPalette(
          DEFAULT_FILTER_PALETTES.crt.definition,
          DEFAULT_FILTER_PALETTES.crt.pixelated
        ),
      nokia:
        customPalettes?.nokia ??
        new ColorPalette(
          DEFAULT_FILTER_PALETTES.nokia.definition,
          DEFAULT_FILTER_PALETTES.nokia.pixelated
        ),
    };
    this.apply('none');
  }

  public attachViewport(viewport: VirtualViewport): void {
    this.viewport = viewport;
    const frameEl = viewport.getFrameElement();
    if (!this.targets.includes(frameEl)) {
      this.targets.push(frameEl);
    }
    this.apply(this.currentFilter);
  }

  public apply(filter: VideoFilterType): void {
    this.currentFilter = filter;
    for (const el of this.targets) {
      el.classList.remove(
        'video-filter-none',
        'video-filter-crt',
        'video-filter-nokia'
      );
      el.classList.add(`video-filter-${filter}`);
      el.dataset.videoFilter = filter;
    }
    if (this.viewport) {
      this.viewport.setPalette(this.palettes[this.currentFilter]);
    }
  }

  public getFilter(): VideoFilterType {
    return this.currentFilter;
  }

  public getPalette(): ColorPalette {
    return this.palettes[this.currentFilter];
  }
}
