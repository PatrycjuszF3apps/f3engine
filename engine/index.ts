export {
  ENGINE_NAME,
  ENGINE_VERSION,
  parseSemVer,
  isEngineVersionCompatible,
  checkEngineVersion,
  type SemVerParts,
  type AppManifest,
  type EngineVersionCheckResult,
} from './version';
export { GameLoop, type GameLoopCallbacks } from './GameLoop';
export { StorageStore, type StoreListener } from './StorageStore';
export {
  ColorPalette,
  type PaletteColorToken,
  type PaletteIndex,
  type PaletteDefinition,
  type RGBAColor,
} from './Palette';
export {
  VirtualFont,
  DEFAULT_FONT_ID,
  F3_RETRO_5X7_FONT,
  type CompiledGlyph,
  type VirtualFontSpec,
  type VirtualFontRef,
  type TextAlign,
  type VirtualTextOptions,
  type PixelPlotter,
} from './VirtualFont';
export {
  HP_100LX_6X8_FONT,
  IBM_BIOS_8X8_FONT,
  IBM_CGATHIN_8X8_FONT,
} from './fonts';
export {
  CHARSET_PRESETS,
  compileSfntBitmapFont,
  compileBdfFont,
  synthesizeNationalGlyph,
  resolveTargetCharacters,
  validateFontLocaleCoverage,
  type CharsetPresetId,
  type FontCompileOptions,
  type FontCoverageReport,
} from './VirtualFontCompiler';
export {
  VirtualFramebuffer,
  type IVirtualSurface,
  type VirtualRect,
} from './VirtualSurface';
export {
  Canvas2DRendererBackend,
  WebGLRendererBackend,
  type IRendererBackend,
  type RendererBackendType,
} from './RendererBackend';
export {
  VirtualViewport,
  computeHeightForAspectRatio,
  ASPECT_RATIO_VALUES,
  type ViewportAspectRatio,
  type VirtualPointerEvent,
  type VirtualViewportState,
  type VirtualViewportConfig,
  type ViewportStateListener,
  type EngineDebugHooks,
} from './VirtualViewport';
export {
  VirtualUIDecorator,
  DEFAULT_UI_THEME,
  type VirtualUITheme,
  type HitLayer,
  type VirtualHitRegion,
  type VirtualPanelOptions,
  type VirtualButtonOptions,
} from './VirtualUIDecorator';
export {
  VideoFilterManager,
  type VideoFilterType,
  type VideoFilterPalette,
} from './VideoFilter';
export {
  MenuSystem,
  type MenuScreenConfig,
  type MenuItemConfig,
  type MenuChoiceOption,
} from './MenuSystem';
export {
  OverlayManager,
  type OverlayPromptConfig,
} from './OverlayManager';
export {
  GamepadManager,
  type GamepadDirection,
  type GamepadAction,
  type GamepadCallbacks,
} from './GamepadManager';
export {
  I18nManager,
  type TranslationDictionary,
  type I18nParams,
  type LocaleChangeListener,
} from './I18nManager';
