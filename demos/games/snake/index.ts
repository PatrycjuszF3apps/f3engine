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
import {
  DEFAULT_SNAKE_STATE,
  SNAKE_VIEWPORT_DEFAULTS,
  SnakePersistedState,
  createSnakePalettes,
} from './l1_infrastructure/SnakeSettingsRepository';
import { SnakeAppRootNode } from './l2_runtime/SnakeAppRootNode';
import {
  StringId,
  SupportedLocale,
  createGameI18n,
} from './l3_interaction/SnakeI18nService';
import manifestData from './manifest.json';

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
 * Mounts an instance of the Classic Snake demo organized around the
 * 4-layer DDD service architecture (`l1_infrastructure`..`l4_domain`).
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
  SnakeSettingsRepository,
  SNAKE_L1_TOKENS,
  SNAKE_VIEWPORT_DEFAULTS,
  DEFAULT_SNAKE_STATE,
  createSnakePalettes,
  type ISnakeSettingsRepository,
  type SnakePersistedState,
} from './l1_infrastructure/SnakeSettingsRepository';
export { SnakeSettingsRepositoryRegistrar } from './l1_infrastructure/SnakeSettingsRepository.registrar';
export {
  SnakeBoardNode,
  type SnakeBoardProps,
  type SnakeBoardState,
} from './l2_runtime/SnakeBoardNode';
export {
  SnakeAppRootNode,
  type SnakeAppRootProps,
  type SnakeAppRootState,
} from './l2_runtime/SnakeAppRootNode';
export {
  SnakeI18nService,
  SNAKE_L3_TOKENS,
  LOCALE_ASSETS,
  createGameI18n,
  type ISnakeI18nService,
  type SupportedLocale,
  type StringId,
} from './l3_interaction/SnakeI18nService';
export { SnakeI18nServiceRegistrar } from './l3_interaction/SnakeI18nService.registrar';
export {
  SnakeSimulationService,
  SNAKE_L4_TOKENS,
  DIFFICULTY_PRESETS,
  type ISnakeSimulationService,
  type Direction,
  type Difficulty,
  type DifficultyPreset,
  type GameStatus,
  type Point,
  type GameStats,
  type SnakeDomainGridState,
  type SnakeTickResult,
} from './l4_domain/SnakeSimulationService';
export { SnakeSimulationServiceRegistrar } from './l4_domain/SnakeSimulationService.registrar';
