import { LayerServiceRegistry } from './LayerServiceRegistry';
import {
  L1InfrastructureServiceRegistrar,
  L2RuntimeServiceRegistrar,
  L3InteractionServiceRegistrar,
  L4DomainServiceRegistrar,
} from './ServiceRegistrar';

/**
 * Pure DTO representing a domain-evaluated depth fact emitted by L4 (Domain)
 * and consumed by L3 (Interaction) without exposing L4 domain entities or L2 Node instances.
 */
export interface DomainDepthFactDTO {
  readonly entityKey: string;
  readonly groupKey: string;
  readonly domainDepthScore: number;
  readonly label?: string;
}

/**
 * Pure DTO representing a normalized layer elevation directive emitted by L3 (Interaction)
 * and consumed by L2 (Runtime) to update low-level node ordering metadata.
 */
export interface LayerElevationDirectiveDTO {
  readonly nodeId: string;
  readonly layerGroup: string;
  readonly groupOrder: number;
  readonly zIndex: number;
}

/**
 * Boundary port exposed inside L4 (Domain) for publishing domain depth facts downwards to L3.
 */
export interface IL4ToL3BoundaryPort {
  publishDomainDepthFacts(facts: readonly DomainDepthFactDTO[]): void;
  getLatestDomainDepthFacts(): readonly DomainDepthFactDTO[];
}

/**
 * Boundary port exposed inside L3 (Interaction) for reading L4 domain depth facts
 * and committing normalized layer elevation directives downwards to L2.
 */
export interface IL3BoundaryPort {
  readDomainDepthFacts(): readonly DomainDepthFactDTO[];
  commitElevationDirectives(
    directives: readonly LayerElevationDirectiveDTO[]
  ): void;
  getLatestElevationDirectives(): readonly LayerElevationDirectiveDTO[];
}

/**
 * Boundary port exposed inside L2 (Runtime) for draining normalized layer elevation directives
 * committed by L3 during the current frame.
 */
export interface IL2FromL3BoundaryPort {
  drainElevationDirectives(): readonly LayerElevationDirectiveDTO[];
  peekElevationDirectives(): readonly LayerElevationDirectiveDTO[];
}

/**
 * Internal message channel bridging L4 -> L3 -> L2 strictly via immutable DTOs
 * so adjacent layers never reference each other's services or containers directly.
 */
class InterLayerBoundaryBus
  implements IL4ToL3BoundaryPort, IL3BoundaryPort, IL2FromL3BoundaryPort
{
  private domainFacts: readonly DomainDepthFactDTO[] = [];
  private elevationDirectives: readonly LayerElevationDirectiveDTO[] = [];
  private pendingDrain: readonly LayerElevationDirectiveDTO[] = [];

  public publishDomainDepthFacts(facts: readonly DomainDepthFactDTO[]): void {
    this.domainFacts = [...facts];
  }

  public getLatestDomainDepthFacts(): readonly DomainDepthFactDTO[] {
    return this.domainFacts;
  }

  public readDomainDepthFacts(): readonly DomainDepthFactDTO[] {
    return this.domainFacts;
  }

  public commitElevationDirectives(
    directives: readonly LayerElevationDirectiveDTO[]
  ): void {
    this.elevationDirectives = [...directives];
    this.pendingDrain = [...directives];
  }

  public getLatestElevationDirectives(): readonly LayerElevationDirectiveDTO[] {
    return this.elevationDirectives;
  }

  public drainElevationDirectives(): readonly LayerElevationDirectiveDTO[] {
    const drained = this.pendingDrain;
    this.pendingDrain = [];
    return drained;
  }

  public peekElevationDirectives(): readonly LayerElevationDirectiveDTO[] {
    return this.elevationDirectives;
  }
}

export interface LayeredRegistrarSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  l1_infrastructure?: ReadonlyArray<L1InfrastructureServiceRegistrar<any, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  l2_runtime?: ReadonlyArray<L2RuntimeServiceRegistrar<any, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  l3_interaction?: ReadonlyArray<L3InteractionServiceRegistrar<any, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  l4_domain?: ReadonlyArray<L4DomainServiceRegistrar<any, any>>;
}

export interface EngineKernelConfig {
  /** Custom application registrars evaluated BEFORE engine default registrars (allowing zero-config overrides). */
  appRegistrars?: LayeredRegistrarSet;
  /** Default engine registrars evaluated as fallbacks when not overridden by the application. */
  engineRegistrars?: LayeredRegistrarSet;
  /** Optional per-layer feature flags accessible via `ctx.hasFeature(...)` inside `shouldRegister(ctx)`. */
  features?: {
    l1_infrastructure?: Record<string, unknown>;
    l2_runtime?: Record<string, unknown>;
    l3_interaction?: Record<string, unknown>;
    l4_domain?: Record<string, unknown>;
  };
}

/**
 * Central 4-Layer DDD Lifecycle Kernel.
 *
 * Maintains four strictly isolated `LayerServiceRegistry` containers (`l1`, `l2`, `l3`, `l4`),
 * wires the DTO boundary ports between adjacent layers, evaluates application and engine
 * Shadow Service Registrars (`*.registrar.ts`), and orchestrates frame lifecycle phases.
 */
export class EngineKernel {
  public readonly l1: LayerServiceRegistry<'L1_INFRASTRUCTURE'>;
  public readonly l2: LayerServiceRegistry<'L2_RUNTIME'>;
  public readonly l3: LayerServiceRegistry<'L3_INTERACTION'>;
  public readonly l4: LayerServiceRegistry<'L4_DOMAIN'>;

  private readonly boundaryBus = new InterLayerBoundaryBus();
  private frameId = 0;
  private elapsedMs = 0;
  private booted = false;

  constructor(config: EngineKernelConfig = {}) {
    this.l1 = new LayerServiceRegistry(
      'L1_INFRASTRUCTURE',
      config.features?.l1_infrastructure
    );
    this.l2 = new LayerServiceRegistry(
      'L2_RUNTIME',
      config.features?.l2_runtime
    );
    this.l3 = new LayerServiceRegistry(
      'L3_INTERACTION',
      config.features?.l3_interaction
    );
    this.l4 = new LayerServiceRegistry(
      'L4_DOMAIN',
      config.features?.l4_domain
    );

    // 1. Register Application Shadow Registrars first (highest precedence)
    if (config.appRegistrars) {
      this.applyRegistrarSet(config.appRegistrars);
    }

    // 2. Register Engine Default Shadow Registrars second (conditional fallback via shouldRegister)
    if (config.engineRegistrars) {
      this.applyRegistrarSet(config.engineRegistrars);
    }
  }

  public getBoundaryPorts(): {
    readonly l4ToL3: IL4ToL3BoundaryPort;
    readonly l3: IL3BoundaryPort;
    readonly l2FromL3: IL2FromL3BoundaryPort;
  } {
    return {
      l4ToL3: this.boundaryBus,
      l3: this.boundaryBus,
      l2FromL3: this.boundaryBus,
    };
  }

  public applyRegistrarSet(set: LayeredRegistrarSet): void {
    for (const reg of set.l1_infrastructure ?? []) {
      this.l1.register(reg);
    }
    for (const reg of set.l2_runtime ?? []) {
      this.l2.register(reg);
    }
    for (const reg of set.l3_interaction ?? []) {
      this.l3.register(reg);
    }
    for (const reg of set.l4_domain ?? []) {
      this.l4.register(reg);
    }
  }

  public boot(): void {
    if (this.booted) return;
    this.l1.compilePipeline();
    this.l2.compilePipeline();
    this.l3.compilePipeline();
    this.l4.compilePipeline();

    this.l1.executePhase('L1_BOOT', 0, 0, 0);
    this.l2.executePhase('L2_BOOT', 0, 0, 0);
    this.l3.executePhase('L3_BOOT', 0, 0, 0);
    this.l4.executePhase('L4_BOOT', 0, 0, 0);
    this.booted = true;
  }

  /**
   * Executes the pre-tree update lifecycle phases across L1 -> L2 -> L4 -> L3 -> L2.
   */
  public executeUpdatePipeline(dt: number): number {
    if (!this.booted) {
      this.boot();
    }
    this.frameId += 1;
    this.elapsedMs += dt * 1000;
    const fId = this.frameId;
    const elapsed = this.elapsedMs;

    // 1. Hardware input & signal broadcast (L1 -> L2)
    this.l1.executePhase('L1_INPUT_POLL', fId, dt, elapsed);
    this.l2.executePhase('L2_SIGNAL_BROADCAST', fId, dt, elapsed);

    // 2. Domain simulation & domain depth evaluation (L4)
    this.l4.executePhase('L4_DOMAIN_UPDATE', fId, dt, elapsed);
    this.l4.executePhase('L4_DEPTH_EVALUATION', fId, dt, elapsed);

    // 3. Interaction state & layer elevation resolution (L3)
    this.l3.executePhase('L3_INTERACTION_SYNC', fId, dt, elapsed);
    this.l3.executePhase('L3_LAYER_ELEVATION', fId, dt, elapsed);

    // 4. Runtime tree update & child order resolution (L2)
    this.l2.executePhase('L2_TREE_UPDATE', fId, dt, elapsed);
    this.l2.executePhase('L2_ORDER_RESOLVE', fId, dt, elapsed);

    return fId;
  }

  /**
   * Executes the render lifecycle phases across L1 -> L2 -> L3 -> L1.
   */
  public executeRenderPipeline(dt = 0): void {
    if (!this.booted) {
      this.boot();
    }
    const fId = this.frameId;
    const elapsed = this.elapsedMs;

    this.l2.executePhase('L2_ORDER_RESOLVE', fId, dt, elapsed);
    this.l1.executePhase('L1_SURFACE_PREPARE', fId, dt, elapsed);
    this.l2.executePhase('L2_TREE_RENDER', fId, dt, elapsed);
    this.l3.executePhase('L3_UI_SYNC', fId, dt, elapsed);
    this.l1.executePhase('L1_SURFACE_PRESENT', fId, dt, elapsed);
  }

  public dispose(): void {
    if (!this.booted) return;
    const fId = this.frameId;
    const elapsed = this.elapsedMs;

    this.l4.executePhase('L4_DISPOSE', fId, 0, elapsed);
    this.l3.executePhase('L3_DISPOSE', fId, 0, elapsed);
    this.l2.executePhase('L2_DISPOSE', fId, 0, elapsed);
    this.l1.executePhase('L1_DISPOSE', fId, 0, elapsed);
    this.booted = false;
  }

  public getFrameId(): number {
    return this.frameId;
  }

  public getElapsedMs(): number {
    return this.elapsedMs;
  }
}
