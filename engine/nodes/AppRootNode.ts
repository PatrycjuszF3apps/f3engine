import { InputKeyBindings, InputRouter } from '../input/InputRouter';
import { VirtualRect } from '../VirtualSurface';
import { VirtualUIDecorator, VirtualUITheme } from '../VirtualUIDecorator';
import { VirtualViewport } from '../VirtualViewport';
import { CanvasNode } from './CanvasNode';
import { ContainerNode } from './ContainerNode';
import { NodeTreeProcessor } from './NodeTreeProcessor';

export interface AppRootConfig {
  viewport: VirtualViewport;
  ui?: VirtualUIDecorator;
  theme?: VirtualUITheme;
  keyBindings?: InputKeyBindings;
}

/**
 * Root node of an f3engine application tree.
 * Connects the `VirtualViewport`, `VirtualUIDecorator`, `NodeTreeProcessor`,
 * `InputRouter`, and the `requestAnimationFrame` execution loop.
 *
 * Applications can either instantiate `AppRootNode` directly or extend it via OOP
 * (`class MyAppNode extends AppRootNode<MyProps, MyState>`) to encapsulate
 * application-level state, dialogs, and lifecycle orchestration.
 */
export class AppRootNode<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProps extends object = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TState extends object = Record<string, any>,
> extends ContainerNode<TProps, TState> {
  protected readonly viewport: VirtualViewport;
  protected readonly ui: VirtualUIDecorator;
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

    this.processor = new NodeTreeProcessor();
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
   * Starts the application's input router and requestAnimationFrame cycle.
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
      this.processor.runUpdateCycle(dt);
      this.renderFrame();

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
  public renderFrame(): void {
    if (this.destroyed) return;
    this.syncViewportBounds();
    const surface = this.viewport.getSurface();
    this.processor.runRenderCycle(surface);
    this.viewport.present();
  }

  /**
   * Cleanly stops the loop, disposes input listeners, destroys all nodes in the tree,
   * and disposes the underlying `VirtualViewport`.
   */
  public dispose(): void {
    this.stop();
    this.inputRouter.dispose();
    this.destroy();
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
