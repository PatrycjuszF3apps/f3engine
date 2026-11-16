import {
  AppManifest,
  EngineDebugHooks,
  HP_100LX_6X8_FONT,
  I18nManager,
  IBM_BIOS_8X8_FONT,
  StorageStore,
  VideoFilterManager,
  VirtualUIDecorator,
  VirtualViewport,
} from '../../../engine';
import manifestData from './manifest.json';
import { SnakeAppRootNode } from './SnakeAppRootNode';
import {
  DEFAULT_SNAKE_STATE,
  SNAKE_VIEWPORT_DEFAULTS,
  SnakePersistedState,
  createSnakePalettes,
} from './SnakeSettings';
import { StringId, SupportedLocale, createGameI18n } from './i18n';

export const SNAKE_MANIFEST: AppManifest = manifestData;

const STORAGE_KEY = 'f3engine_snake_settings_v1';

export interface DemoSession {
  readonly id: string;
  readonly name: string;
  readonly manifest: AppManifest;
  readonly hooks: EngineDebugHooks;
  readonly i18n: I18nManager<SupportedLocale, StringId>;
  dispose(): void;
}

/**
 * Mounts an instance of the Classic Snake demo built on the f3engine
 * `AppRootNode` + `UIKit.ClassicV1` node hierarchy.
 */
export function mountSnakeDemo(container: HTMLElement): DemoSession {
  const store = new StorageStore<SnakePersistedState>(
    STORAGE_KEY,
    DEFAULT_SNAKE_STATE
  );
  const i18n = createGameI18n(store.get().language);
  const snakePalettes = createSnakePalettes();
  const filterManager = new VideoFilterManager([container], snakePalettes);

  const viewport = new VirtualViewport({
    container,
    manifest: SNAKE_MANIFEST,
    virtualWidth: SNAKE_VIEWPORT_DEFAULTS.virtualWidth,
    aspectRatio: SNAKE_VIEWPORT_DEFAULTS.aspectRatio,
    windowScalePercent: SNAKE_VIEWPORT_DEFAULTS.windowScalePercent,
    lockAspectRatio: SNAKE_VIEWPORT_DEFAULTS.lockAspectRatio,
    palette: filterManager.getPalette(),
    canvasAriaLabel: i18n.t('board.canvas_aria'),
  });
  filterManager.attachViewport(viewport);

  const uiDecorator = new VirtualUIDecorator(viewport);
  uiDecorator.setFonts({
    body: HP_100LX_6X8_FONT,
    heading: IBM_BIOS_8X8_FONT,
  });

  const appRoot = new SnakeAppRootNode(
    { viewport, ui: uiDecorator },
    { store, i18n, filterManager }
  );
  appRoot.start();

  return {
    id: SNAKE_MANIFEST.id,
    name: SNAKE_MANIFEST.name,
    manifest: SNAKE_MANIFEST,
    hooks: viewport.getDebugHooks(),
    i18n,
    dispose: () => {
      appRoot.dispose();
    },
  };
}

export {
  SnakeBoardNode,
  type Direction,
  type GameStatus,
  type Point,
  type GameStats,
  type SnakeBoardProps,
  type SnakeBoardState,
} from './SnakeBoardNode';
export {
  SnakeAppRootNode,
  type SnakeAppRootProps,
  type SnakeAppRootState,
} from './SnakeAppRootNode';
export {
  DIFFICULTY_PRESETS,
  SNAKE_VIEWPORT_DEFAULTS,
  DEFAULT_SNAKE_STATE,
  createSnakePalettes,
  type Difficulty,
  type DifficultyPreset,
  type SnakePersistedState,
} from './SnakeSettings';
export {
  LOCALE_ASSETS,
  createGameI18n,
  type SupportedLocale,
  type StringId,
} from './i18n';
