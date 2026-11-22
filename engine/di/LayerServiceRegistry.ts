import { LayerServiceRegistrar } from './ServiceRegistrar';
import {
  AnyLayerServiceToken,
  EngineLayer,
  FramePhaseContext,
  LayerPhaseMap,
  LayerRegistrationContext,
  ServiceToken,
} from './ServiceTypes';

interface CompiledPhaseSlot<TPhase extends string> {
  readonly priority: number;
  readonly registrationOrder: number;
  readonly run: (ctx: FramePhaseContext<TPhase>) => void;
}

/**
 * Isolated Dependency Injection & Frame Phase Pipeline Container for a single DDD abstraction layer.
 * Enforces strict layer boundaries: only tokens and registrars belonging to `TLayer` can be registered or resolved.
 */
export class LayerServiceRegistry<TLayer extends EngineLayer>
  implements LayerRegistrationContext<TLayer>
{
  public readonly layer: TLayer;

  private readonly registrars = new Map<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LayerServiceRegistrar<TLayer, any, any>
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly instances = new Map<string, any>();
  private readonly resolvingIds = new Set<string>();
  private readonly features = new Map<string, unknown>();
  private readonly phaseSlots = new Map<
    LayerPhaseMap[TLayer],
    Array<CompiledPhaseSlot<LayerPhaseMap[TLayer]>>
  >();

  private compiled = false;
  private registrationCounter = 0;

  constructor(layer: TLayer, initialFeatures?: Record<string, unknown>) {
    this.layer = layer;
    if (initialFeatures) {
      for (const [key, value] of Object.entries(initialFeatures)) {
        this.features.set(key, value);
      }
    }
  }

  public setFeature(featureKey: string, value: unknown): this {
    this.features.set(featureKey, value);
    return this;
  }

  public hasFeature(featureKey: string): boolean {
    return Boolean(this.features.get(featureKey));
  }

  public getFeature<T = unknown>(featureKey: string): T | undefined {
    return this.features.get(featureKey) as T | undefined;
  }

  public hasProvider(token: AnyLayerServiceToken<TLayer>): boolean {
    return (
      this.registrars.has(token.id) || this.instances.has(token.id)
    );
  }

  /**
   * Evaluates a Shadow Service Registrar (`*.registrar.ts`) against this layer's context
   * and registers its provider and pipeline phase slots if `shouldRegister(this)` returns true.
   */
  public register(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registrar: LayerServiceRegistrar<TLayer, any, any>
  ): boolean {
    if (registrar.layer !== this.layer) {
      throw new Error(
        `[LayerServiceRegistry:${this.layer}] Layer violation: Cannot register service "${registrar.provides.id}" belonging to "${registrar.layer}".`
      );
    }

    if (!registrar.shouldRegister(this)) {
      return false;
    }

    this.registrars.set(registrar.provides.id, registrar);
    this.instances.delete(registrar.provides.id);
    this.compiled = false;
    return true;
  }

  /**
   * Directly binds a pre-constructed singleton instance (such as an inter-layer boundary port)
   * to a layer-scoped service token.
   */
  public bindInstance<TContract>(
    token: ServiceToken<TContract, TLayer>,
    instance: TContract
  ): this {
    if (token.layer !== this.layer) {
      throw new Error(
        `[LayerServiceRegistry:${this.layer}] Layer violation: Token "${token.id}" belongs to "${token.layer}".`
      );
    }
    this.instances.set(token.id, instance);
    this.compiled = false;
    return this;
  }

  /**
   * Resolves a service contract within this layer, autowiring its constructor dependencies recursively.
   */
  public resolve<TContract>(token: ServiceToken<TContract, TLayer>): TContract {
    if (token.layer !== this.layer) {
      throw new Error(
        `[LayerServiceRegistry:${this.layer}] Layer violation: Cannot resolve token "${token.id}" from layer "${token.layer}".`
      );
    }

    if (this.instances.has(token.id)) {
      return this.instances.get(token.id) as TContract;
    }

    const registrar = this.registrars.get(token.id);
    if (!registrar) {
      throw new Error(
        `[LayerServiceRegistry:${this.layer}] Missing service provider for token "${token.id}".`
      );
    }

    if (this.resolvingIds.has(token.id)) {
      throw new Error(
        `[LayerServiceRegistry:${this.layer}] Circular dependency detected while resolving "${token.id}".`
      );
    }

    this.resolvingIds.add(token.id);
    try {
      const resolvedDeps = registrar.inject.map((depToken: AnyLayerServiceToken<TLayer>) =>
        this.resolve(depToken)
      );
      const instance = registrar.createInstance(...resolvedDeps) as TContract;
      this.instances.set(token.id, instance);
      return instance;
    } finally {
      this.resolvingIds.delete(token.id);
    }
  }

  /**
   * Instantiates all registered services in this layer and compiles their declarative
   * pipeline phase slot bindings sorted by priority.
   */
  public compilePipeline(): void {
    if (this.compiled) return;
    this.phaseSlots.clear();
    this.registrationCounter = 0;

    for (const registrar of this.registrars.values()) {
      const serviceInstance = this.resolve(registrar.provides);
      const slots = registrar.getPipelineSlots();

      for (const slot of slots) {
        const list = this.phaseSlots.get(slot.phase) ?? [];
        const order = this.registrationCounter++;
        list.push({
          priority: slot.priority ?? 0,
          registrationOrder: order,
          run: (frameCtx) => {
            slot.execute(serviceInstance, frameCtx);
          },
        });
        this.phaseSlots.set(slot.phase, list);
      }
    }

    for (const list of this.phaseSlots.values()) {
      list.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.registrationOrder - b.registrationOrder;
      });
    }

    this.compiled = true;
  }

  /**
   * Executes all service slots attached to the specified frame lifecycle phase in priority order.
   */
  public executePhase(
    phaseId: LayerPhaseMap[TLayer],
    frameId: number,
    dt: number,
    elapsedMs: number
  ): void {
    if (!this.compiled) {
      this.compilePipeline();
    }
    const slots = this.phaseSlots.get(phaseId);
    if (!slots || slots.length === 0) return;

    const context: FramePhaseContext<LayerPhaseMap[TLayer]> = {
      frameId,
      phaseId,
      dt,
      elapsedMs,
    };

    for (let i = 0; i < slots.length; i++) {
      slots[i].run(context);
    }
  }

  /**
   * Returns a snapshot of all registered service token IDs in this layer.
   */
  public getRegisteredServiceIds(): readonly string[] {
    const ids = new Set<string>([
      ...this.instances.keys(),
      ...this.registrars.keys(),
    ]);
    return Array.from(ids);
  }
}
