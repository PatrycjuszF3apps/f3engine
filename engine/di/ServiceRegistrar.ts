import {
  AnyLayerServiceToken,
  EngineLayer,
  LayerPhaseMap,
  LayerRegistrationContext,
  PipelineSlotBinding,
  ResolvedDependencies,
  ServiceToken,
} from './ServiceTypes';

/**
 * Base Shadow Service Registrar class (`*.registrar.ts`).
 *
 * Inspired by Symfony ServiceDefinitions / CompilerPasses:
 * - Lives alongside its pure service class in the exact same DDD layer directory.
 * - Declares the interface contract it `provides` and the layer-local interface tokens it `inject`s.
 * - Evaluates conditional registration via `shouldRegister(ctx)` using only its own layer's context.
 * - Hooks the service into deterministic frame lifecycle phase slots via `getPipelineSlots()`.
 */
export abstract class LayerServiceRegistrar<
  TLayer extends EngineLayer,
  TContract,
  TDeps extends readonly AnyLayerServiceToken<TLayer>[] = readonly [],
> {
  public abstract readonly layer: TLayer;
  public abstract readonly provides: ServiceToken<TContract, TLayer>;
  public abstract readonly inject: TDeps;

  /**
   * Conditional registration guard.
   * By default, registers the service only if no higher-priority provider (e.g. from the application)
   * has already registered an implementation for `this.provides`.
   */
  public shouldRegister(ctx: LayerRegistrationContext<TLayer>): boolean {
    return !ctx.hasProvider(this.provides);
  }

  /**
   * Instantiates the pure service class with its autowired layer-local dependencies.
   */
  public abstract createInstance(
    ...deps: ResolvedDependencies<TLayer, TDeps>
  ): TContract;

  /**
   * Optional declarative pipeline phase slot bindings for automatic frame lifecycle execution.
   */
  public getPipelineSlots(): readonly PipelineSlotBinding<
    TContract,
    LayerPhaseMap[TLayer]
  >[] {
    return [];
  }
}

/**
 * Shadow Registrar base class for L1: Infrastructure (Hardware, Platform & Physical Primitives).
 */
export abstract class L1InfrastructureServiceRegistrar<
  TContract,
  TDeps extends readonly AnyLayerServiceToken<'L1_INFRASTRUCTURE'>[] = readonly [],
> extends LayerServiceRegistrar<'L1_INFRASTRUCTURE', TContract, TDeps> {
  public readonly layer = 'L1_INFRASTRUCTURE' as const;
}

/**
 * Shadow Registrar base class for L2: Runtime (Scene Graph, Metadata, Ordering & Signal Kernel).
 */
export abstract class L2RuntimeServiceRegistrar<
  TContract,
  TDeps extends readonly AnyLayerServiceToken<'L2_RUNTIME'>[] = readonly [],
> extends LayerServiceRegistrar<'L2_RUNTIME', TContract, TDeps> {
  public readonly layer = 'L2_RUNTIME' as const;
}

/**
 * Shadow Registrar base class for L3: Interaction (Spatial Composition, Layer Elevation & UI Mechanics).
 */
export abstract class L3InteractionServiceRegistrar<
  TContract,
  TDeps extends readonly AnyLayerServiceToken<'L3_INTERACTION'>[] = readonly [],
> extends LayerServiceRegistrar<'L3_INTERACTION', TContract, TDeps> {
  public readonly layer = 'L3_INTERACTION' as const;
}

/**
 * Shadow Registrar base class for L4: Domain (Application & Game Universe Rules).
 */
export abstract class L4DomainServiceRegistrar<
  TContract,
  TDeps extends readonly AnyLayerServiceToken<'L4_DOMAIN'>[] = readonly [],
> extends LayerServiceRegistrar<'L4_DOMAIN', TContract, TDeps> {
  public readonly layer = 'L4_DOMAIN' as const;
}
