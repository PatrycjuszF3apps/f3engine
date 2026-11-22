import {
  EngineKernel,
  EngineKernelConfig,
  LayeredRegistrarSet,
} from '../../di/EngineKernel';
import { DefaultFrameClockTelemetryServiceRegistrar } from '../../l1_infrastructure/services/FrameClockTelemetryService.registrar';
import { VirtualRect } from '../../l1_infrastructure/VirtualSurface';
import { VirtualViewport } from '../../l1_infrastructure/VirtualViewport';
import { DefaultLayerElevationServiceRegistrar } from '../../l3_interaction/services/LayerElevationService.registrar';
import { L3_TOKENS } from '../../l3_interaction/services/L3Tokens';
import {
  VirtualUIDecorator,
  VirtualUITheme,
} from '../../l3_interaction/VirtualUIDecorator';
import { DefaultDomainDepthPolicyServiceRegistrar } from '../../l4_domain/services/DomainDepthPolicyService.registrar';
import { L4_TOKENS } from '../../l4_domain/services/L4Tokens';
import { InputKeyBindings, InputRouter } from '../input/InputRouter';
import { DefaultChildOrderServiceRegistrar } from '../services/ChildOrderService.registrar';
import { DefaultHitTestServiceRegistrar } from '../services/HitTestService.registrar';
import { L2_TOKENS } from '../services/L2Tokens';
import { DefaultNodeMetadataServiceRegistrar } from '../services/NodeMetadataService.registrar';
import { CanvasNode } from './CanvasNode';
import { ContainerNode } from './ContainerNode';
import { NodeTreeProcessor } from './NodeTreeProcessor';

export interface AppRootConfig {
  viewport: VirtualViewport;
  ui?: VirtualUIDecorator;
  theme?: VirtualUITheme;
  keyBindings?: InputKeyBindings;
  /**
   * Optional application-supplied Shadow Service Registrars (`*.registrar.ts`) per DDD layer.
   * Evaluated before engine defaults, allowing applications to override or extend services at any layer.
   */
  registrars?: LayeredRegistrarSet;
  /** Optional per-layer feature flags inspected by registrars during `shouldRegister(ctx)`. */
  features?: EngineKernelConfig['features'];
}

export const DEFAULT_ENGINE_REGISTRARS: LayeredRegistrarSet = {
  l1_infrastructure: [new DefaultFrameClockTelemetryServiceRegistrar()],
  l2_runtime: [
    new DefaultNodeMetadataServiceRegistrar(),
    new DefaultChildOrderServiceRegistrar(),
    new DefaultHitTestServiceRegistrar(),
  ],
  l3_interaction: [new DefaultLayerElevationServiceRegistrar()],
  l4_domain: [new DefaultDomainDepthPolicyServiceRegistrar()],
};

/**
 * Root node of an f3engine application tree.
 * Connects the `EngineKernel` (4-layer DDD DI & Frame Phase Pipeline), `VirtualViewport`,
 * `VirtualUIDecorator`, `NodeTreeProcessor`, `InputRouter`, and the `requestAnimationFrame` loop.
 */
export class AppRootNode<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProps extends object = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TState extends object = Record<string, any>,
> extends ContainerNode<TProps, TState> {
  protected readonly viewport: VirtualViewport;
  protected readonly ui: VirtualUIDecorator;
  protected readonly kernel: EngineKernel;
  protected readonly inputRouter: InputRouter;
  protected readonly processor: NodeTreeProcessor;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private running = false;

  constructor(config: AppRootConfig, id = 'app-root', props?: TProps) {
    super(id, props);
    this.viewport = config.viewport;
    this.ui =
      config.ui ?? new VirtualUIDecorator(config.viewport, config.theme);

    this.kernel = new EngineKernel({
      features: config.features,
    });

    // Bind strict DTO inter-layer boundary ports into their respective layer containers
    const ports = this.kernel.getBoundaryPorts();
    this.kernel.l2.bindInstance(L2_TOKENS.BoundaryPort, ports.l2FromL3);
    this.kernel.l3.bindInstance(L3_TOKENS.BoundaryPort, ports.l3);
    this.kernel.l4.bindInstance(L4_TOKENS.BoundaryPort, ports.l4ToL3);

    // 1. Apply application-level shadow registrars first (overrides & app extensions)
    if (config.registrars) {
      this.kernel.applyRegistrarSet(config.registrars);
    }

    // 2. Apply engine default shadow registrars second (fallback for non-overridden tokens)
    this.kernel.applyRegistrarSet(DEFAULT_ENGINE_REGISTRARS);
    this.kernel.boot();

    this.processor = new NodeTreeProcessor({
      childOrderService: this.kernel.l2.resolve(L2_TOKENS.ChildOrderService),
      hitTestService: this.kernel.l2.resolve(L2_TOKENS.HitTestService),
    });
    this.processor.root = this;
    this.treeProcessor = this.processor;

    this.inputRouter = new InputRouter({
      viewport: this.viewport,
      keyBindings: config.keyBindings,
      onEvent: (event) => {
        this.processor.dispatchControlEvent(event);
      },
    });

    this.syncViewportBounds();

    this.viewport.setRenderCallback(() => {
      this.renderFrame();
    });

    this._notifyMounted(this.processor);
  }

  protected override isAppRootNode(): boolean {
    return true;
  }

  public getKernel(): EngineKernel {
    return this.kernel;
  }

  public override getViewport(): VirtualViewport | null {
    return this.viewport ?? null;
  }

  public override getUI(): VirtualUIDecorator | null {
    return this.ui ?? null;
  }

  public override getInput(): InputRouter | null {
    return this.inputRouter ?? null;
  }

  public getTreeProcessor(): NodeTreeProcessor {
    return this.processor;
  }

  /**
   * Starts the application's input router and 4-layer lifecycle execution loop.
   */
  public start(): this {
    if (this.running) return this;
    this.running = true;
    this.inputRouter.start();
    this.lastFrameTime = performance.now();
    this.renderFrame();

    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;

      this.syncViewportBounds();
      this.kernel.executeUpdatePipeline(dt);
      this.processor.runUpdateCycle(dt);
      this.renderFrame(dt);

      if (this.running) {
        this.rafId = requestAnimationFrame(frame);
      }
    };

    this.rafId = requestAnimationFrame(frame);
    return this;
  }

  /**
   * Stops the application loop and input router without destroying the node tree.
   */
  public stop(): this {
    this.running = false;
    this.inputRouter.stop();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    return this;
  }

  /**
   * Executes an immediate layout and render pass of the entire node tree
   * onto the virtual viewport and presents the frame.
   */
  public renderFrame(dt = 0): void {
    if (this.destroyed) return;
    this.syncViewportBounds();
    this.kernel.executeRenderPipeline(dt);
    const surface = this.viewport.getSurface();
    this.processor.runRenderCycle(surface);
    this.viewport.present();
  }

  /**
   * Cleanly stops the loop, disposes input listeners, destroys all nodes in the tree,
   * disposes the 4-layer kernel, and disposes the underlying `VirtualViewport`.
   */
  public dispose(): void {
    this.stop();
    this.inputRouter.dispose();
    this.destroy();
    this.kernel.dispose();
    this.viewport.dispose();
  }

  protected override onLayout(bounds: VirtualRect): void {
    for (const child of this.children) {
      if (child instanceof CanvasNode && !child.destroyed) {
        child.setBounds(bounds);
      }
    }
  }

  private syncViewportBounds(): void {
    this.setBounds({
      x: 0,
      y: 0,
      width: this.viewport.getVirtualWidth(),
      height: this.viewport.getVirtualHeight(),
    });
  }
}
