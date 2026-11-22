import {
  AppManifest,
  HP_100LX_6X8_FONT,
  IBM_BIOS_8X8_FONT,
  StorageStore,
  VideoFilterManager,
  VirtualUIDecorator,
  VirtualViewport,
} from '../../../engine';
import type { DemoSession } from '../snake';
import type { StringId } from '../snake';
import {
  DEFAULT_LAYERS_STATE,
  LAYERS_VIEWPORT_DEFAULTS,
  LayersPersistedState,
  createLayersPalettes,
} from './l1_infrastructure/LayersSettingsRepository';
import { LayersAppRootNode } from './l2_runtime/LayersAppRootNode';
import { createLayersI18n } from './l3_interaction/LayersI18nService';
import manifestData from './manifest.json';

export const LAYERS_MANIFEST: AppManifest = manifestData;

const STORAGE_KEY = 'f3engine_layers_settings_v1';

/**
 * Mounts an instance of the Multi-Layer Real-Time Z-Index Compositor demo
 * organized around the 4-layer DDD service architecture (`l1_infrastructure`..`l4_domain`).
 */
export function mountLayersDemo(container: HTMLElement): DemoSession {
  const store = new StorageStore<LayersPersistedState>(
    STORAGE_KEY,
    DEFAULT_LAYERS_STATE
  );
  const i18n = createLayersI18n(store.get().language);
  const palettes = createLayersPalettes();
  const filterManager = new VideoFilterManager([container], palettes);

  const viewport = new VirtualViewport({
    container,
    manifest: LAYERS_MANIFEST,
    virtualWidth: LAYERS_VIEWPORT_DEFAULTS.virtualWidth,
    aspectRatio: LAYERS_VIEWPORT_DEFAULTS.aspectRatio,
    windowScalePercent: LAYERS_VIEWPORT_DEFAULTS.windowScalePercent,
    lockAspectRatio: LAYERS_VIEWPORT_DEFAULTS.lockAspectRatio,
    palette: filterManager.getPalette(),
    canvasAriaLabel: i18n.t('board.canvas_aria'),
  });
  filterManager.attachViewport(viewport);

  const uiDecorator = new VirtualUIDecorator(viewport);
  uiDecorator.setFonts({
    body: HP_100LX_6X8_FONT,
    heading: IBM_BIOS_8X8_FONT,
  });

  const appRoot = new LayersAppRootNode(
    { viewport, ui: uiDecorator },
    { store, i18n, filterManager }
  );
  appRoot.start();

  return {
    id: LAYERS_MANIFEST.id,
    name: LAYERS_MANIFEST.name,
    manifest: LAYERS_MANIFEST,
    hooks: viewport.getDebugHooks(),
    // Cast compatible I18nManager instance for DebugToolbar shared debug.* keys
    i18n: i18n as unknown as DemoSession['i18n'] & {
      t: (id: StringId) => string;
    },
    dispose: () => {
      appRoot.dispose();
    },
  };
}

export {
  LayersSettingsRepository,
  LAYERS_L1_TOKENS,
  LAYERS_VIEWPORT_DEFAULTS,
  DEFAULT_LAYERS_STATE,
  createLayersPalettes,
  type ILayersSettingsRepository,
  type LayersPersistedState,
} from './l1_infrastructure/LayersSettingsRepository';
export { LayersSettingsRepositoryRegistrar } from './l1_infrastructure/LayersSettingsRepository.registrar';
export { RealtimeZIndexChildOrderService } from './l2_runtime/RealtimeZIndexChildOrderService';
export { RealtimeZIndexChildOrderServiceRegistrar } from './l2_runtime/RealtimeZIndexChildOrderService.registrar';
export {
  AnimatedBackdropNode,
  type AnimatedBackdropNodeProps,
} from './l2_runtime/AnimatedBackdropNode';
export {
  LayeredStageContainerNode,
  type LayeredStageContainerProps,
} from './l2_runtime/LayeredStageContainerNode';
export {
  LayersAppRootNode,
  type LayersAppRootProps,
  type LayersAppRootState,
} from './l2_runtime/LayersAppRootNode';
export { StageLayerInteractionService } from './l3_interaction/StageLayerInteractionService';
export { StageLayerInteractionServiceRegistrar } from './l3_interaction/StageLayerInteractionService.registrar';
export {
  BackdropUniverseService,
  type AnimatedBackdropEntity,
  type BackdropPatternKind,
  type DepthSortStrategyMode,
} from './l4_domain/BackdropUniverseService';
export { BackdropUniverseServiceRegistrar } from './l4_domain/BackdropUniverseService.registrar';
