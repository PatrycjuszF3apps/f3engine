/**
 * Canonical 4-level DDD abstraction layers defining the lifecycle of f3engine and its applications.
 */
export type EngineLayer =
  | 'L1_INFRASTRUCTURE'
  | 'L2_RUNTIME'
  | 'L3_INTERACTION'
  | 'L4_DOMAIN';

export type L1FramePhase =
  | 'L1_BOOT'
  | 'L1_INPUT_POLL'
  | 'L1_SURFACE_PREPARE'
  | 'L1_SURFACE_PRESENT'
  | 'L1_DISPOSE';

export type L2FramePhase =
  | 'L2_BOOT'
  | 'L2_SIGNAL_BROADCAST'
  | 'L2_TREE_UPDATE'
  | 'L2_ORDER_RESOLVE'
  | 'L2_TREE_RENDER'
  | 'L2_DISPOSE';

export type L3FramePhase =
  | 'L3_BOOT'
  | 'L3_INTERACTION_SYNC'
  | 'L3_LAYER_ELEVATION'
  | 'L3_UI_SYNC'
  | 'L3_DISPOSE';

export type L4FramePhase =
  | 'L4_BOOT'
  | 'L4_DOMAIN_UPDATE'
  | 'L4_DEPTH_EVALUATION'
  | 'L4_DISPOSE';

export interface LayerPhaseMap {
  L1_INFRASTRUCTURE: L1FramePhase;
  L2_RUNTIME: L2FramePhase;
  L3_INTERACTION: L3FramePhase;
  L4_DOMAIN: L4FramePhase;
}

/**
 * Strongly-typed service contract token permanently bound to a single DDD abstraction layer.
 * Prevents cross-layer dependency injection at compile time.
 */
export interface ServiceToken<
  TContract,
  TLayer extends EngineLayer = EngineLayer,
> {
  readonly id: string;
  readonly layer: TLayer;
  readonly description?: string;
  readonly __contractBrand?: TContract;
}

export function createServiceToken<TContract, TLayer extends EngineLayer>(
  layer: TLayer,
  id: string,
  description?: string
): ServiceToken<TContract, TLayer> {
  return {
    layer,
    id,
    description,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLayerServiceToken<TLayer extends EngineLayer> = ServiceToken<any, TLayer>;

export type ResolvedDependencies<
  TLayer extends EngineLayer,
  TDeps extends readonly AnyLayerServiceToken<TLayer>[],
> = {
  -readonly [K in keyof TDeps]: TDeps[K] extends ServiceToken<
    infer TContract,
    TLayer
  >
    ? TContract
    : never;
};

/**
 * Execution context passed to services hooked into a frame lifecycle phase slot.
 * Gives the service explicit awareness of the current frame number, phase ID, and delta time.
 */
export interface FramePhaseContext<TPhase extends string> {
  readonly frameId: number;
  readonly phaseId: TPhase;
  readonly dt: number;
  readonly elapsedMs: number;
}

/**
 * Declarative binding attaching a registered service to a specific frame lifecycle phase slot
 * within its abstraction layer (analogous to tagged service compiler passes in Symfony).
 */
export interface PipelineSlotBinding<TContract, TPhase extends string> {
  readonly phase: TPhase;
  /** Higher priority values execute earlier within the same phase slot (default: 0). */
  readonly priority?: number;
  readonly execute: (
    service: TContract,
    frameContext: FramePhaseContext<TPhase>
  ) => void;
}

/**
 * Layer-local inspection context exposed to a Shadow Registrar Class (`*.registrar.ts`)
 * when deciding whether to register its service.
 */
export interface LayerRegistrationContext<TLayer extends EngineLayer> {
  readonly layer: TLayer;
  hasProvider(token: AnyLayerServiceToken<TLayer>): boolean;
  hasFeature(featureKey: string): boolean;
  getFeature<T = unknown>(featureKey: string): T | undefined;
}
