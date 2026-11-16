import {
  AppManifest,
  ColorPalette,
  I18nManager,
  StorageStore,
  VideoFilterManager,
  VideoFilterPalette,
  VideoFilterType,
  VirtualFont,
  VirtualUIDecorator,
  VirtualViewport,
} from '../../../engine';
import manifestData from './manifest.json';
import { AMSTRAD_PC_8X8_FONT, ATI_SMALLW_6X8_FONT } from './fonts';
import { Snake2ArenaBoardNode } from './Snake2ArenaBoardNode';
import {
  DEFAULT_SNAKE_STATE,
  LOCALE_ASSETS,
  SNAKE_VIEWPORT_DEFAULTS,
  SnakeAppRootNode,
  SnakePersistedState,
  StringId,
  SupportedLocale,
  type DemoSession,
} from '../snake';

export const SNAKE2_MANIFEST: AppManifest = manifestData;

const STORAGE_KEY_SNAKE2 = 'f3engine_snake2_settings_v1';

const SNAKE2_PALETTE_DEFINITIONS: Record<
  VideoFilterType,
  { definition: VideoFilterPalette; pixelated: boolean }
> = {
  none: {
    pixelated: false,
    definition: {
      bgOuter: '#090614',
      panelBg: '#1b1336',
      panelAlt: '#110b24',
      border: '#3b2d66',
      borderHighlight: '#f59e0b',
      textMain: '#f8fafc',
      textMuted: '#a78bfa',
      textInverse: '#1e1b4b',
      accent: '#d97706',
      accentBright: '#fbbf24',
      overlayDim: '#070410',
      boardBgEven: '#0f0a21',
      boardBgOdd: '#150f2e',
      primaryEntityHead: '#fbbf24',
      primaryEntityBody: '#f59e0b',
      primaryEntityEye: '#110b24',
      targetFill: '#ec4899',
      targetHighlight: '#fbcfe8',
    },
  },
  crt: {
    pixelated: false,
    definition: {
      bgOuter: '#06030d',
      panelBg: '#180f30',
      panelAlt: '#0e081f',
      border: '#4c1d95',
      borderHighlight: '#38bdf8',
      textMain: '#f0f9ff',
      textMuted: '#c084fc',
      textInverse: '#0f172a',
      accent: '#f59e0b',
      accentBright: '#fde047',
      overlayDim: '#05020a',
      boardBgEven: '#0c061a',
      boardBgOdd: '#120a26',
      primaryEntityHead: '#fde047',
      primaryEntityBody: '#f59e0b',
      primaryEntityEye: '#0c061a',
      targetFill: '#f43f5e',
      targetHighlight: '#fecdd3',
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

function createSnake2Palettes(): Record<VideoFilterType, ColorPalette> {
  return {
    none: new ColorPalette(
      SNAKE2_PALETTE_DEFINITIONS.none.definition,
      SNAKE2_PALETTE_DEFINITIONS.none.pixelated
    ),
    crt: new ColorPalette(
      SNAKE2_PALETTE_DEFINITIONS.crt.definition,
      SNAKE2_PALETTE_DEFINITIONS.crt.pixelated
    ),
    nokia: new ColorPalette(
      SNAKE2_PALETTE_DEFINITIONS.nokia.definition,
      SNAKE2_PALETTE_DEFINITIONS.nokia.pixelated
    ),
  };
}

function createSnake2I18n(
  initialLocale: SupportedLocale = 'en'
): I18nManager<SupportedLocale, StringId> {
  const customAssets: Record<SupportedLocale, Record<StringId, string>> = {
    en: {
      ...LOCALE_ASSETS.en,
      'header.brand_title': 'SNAKE II',
      'header.brand_badge': 'ARENA',
      'menu.title.heading': 'SNAKE II: ARENA',
      'menu.title.subtitle':
        'Obstacle Pillars & Twin-Apple Arcade Challenge',
    },
    pl: {
      ...LOCALE_ASSETS.pl,
      'header.brand_title': 'SNAKE II',
      'header.brand_badge': 'ARENA',
      'menu.title.heading': 'SNAKE II: ARENA',
      'menu.title.subtitle': 'Filary na planszy i podwójne jabłka',
    },
  };
  return new I18nManager<SupportedLocale, StringId>(
    customAssets,
    initialLocale
  );
}

/**
 * Mounts an instance of the "Snake 2: Arena" demo inside the provided host container,
 * reusing `SnakeAppRootNode` and injecting the OOP-extended `Snake2ArenaBoardNode`.
 */
export function mountSnake2Demo(container: HTMLElement): DemoSession {
  const store = new StorageStore<SnakePersistedState>(
    STORAGE_KEY_SNAKE2,
    DEFAULT_SNAKE_STATE
  );
  const i18n = createSnake2I18n(store.get().language);
  const palettes = createSnake2Palettes();
  const filterManager = new VideoFilterManager([container], palettes);

  const viewport = new VirtualViewport({
    container,
    manifest: SNAKE2_MANIFEST,
    virtualWidth: SNAKE_VIEWPORT_DEFAULTS.virtualWidth,
    aspectRatio: SNAKE_VIEWPORT_DEFAULTS.aspectRatio,
    windowScalePercent: SNAKE_VIEWPORT_DEFAULTS.windowScalePercent,
    lockAspectRatio: SNAKE_VIEWPORT_DEFAULTS.lockAspectRatio,
    palette: filterManager.getPalette(),
    canvasAriaLabel: i18n.t('board.canvas_aria'),
  });
  filterManager.attachViewport(viewport);

  VirtualFont.registerFont(AMSTRAD_PC_8X8_FONT);
  VirtualFont.registerFont(ATI_SMALLW_6X8_FONT);

  const uiDecorator = new VirtualUIDecorator(viewport);
  uiDecorator.setFonts({
    body: ATI_SMALLW_6X8_FONT,
    heading: AMSTRAD_PC_8X8_FONT,
  });

  const appRoot = new SnakeAppRootNode(
    { viewport, ui: uiDecorator },
    {
      store,
      i18n,
      filterManager,
      createBoardNode: (boardProps) =>
        new Snake2ArenaBoardNode('snake2-arena-board', boardProps),
    }
  );
  appRoot.start();

  return {
    id: SNAKE2_MANIFEST.id,
    name: SNAKE2_MANIFEST.name,
    manifest: SNAKE2_MANIFEST,
    hooks: viewport.getDebugHooks(),
    i18n,
    dispose: () => {
      appRoot.dispose();
    },
  };
}

export { Snake2ArenaBoardNode } from './Snake2ArenaBoardNode';
