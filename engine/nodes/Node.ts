import { ControlEvent } from '../input/ControlEvents';
import type { InputRouter } from '../input/InputRouter';
import type { VirtualUIDecorator } from '../VirtualUIDecorator';
import type { VirtualViewport } from '../VirtualViewport';
import type { AppRootNode } from './AppRootNode';
import type { NodeTreeProcessor } from './NodeTreeProcessor';
import { HookPhase, NodeHookFn, NodeResetOptions } from './NodeTypes';

/**
 * Fundamental scene/application graph node in f3engine.
 *
 * A `Node` represents a self-contained unit of an application:
 * - Can optionally process frame/tick updates (`onUpdate`, `onTick`).
 * - Can optionally render visuals onto the virtual pixel grid (via `CanvasNode` subclass).
 * - Receives normalized and raw `ControlEvent` instances dispatched down the tree.
 * - Maintains strongly-typed `props` and `state` with cascading parent-over-child authority
 *   (`hide`, `show`, `enable`, `disable`, `freeze`, `unfreeze`, `resetState`, `unload`, `destroy`).
 */
export class Node<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProps extends object = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TState extends object = Record<string, any>,
> {
  public readonly id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public parent: Node<any, any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public children: Node<any, any>[] = [];
  public treeProcessor: NodeTreeProcessor | null = null;

  public visible = true;
  public enabled = true;
  public paused = false;

  protected props: TProps;
  protected state: TState;

  private _mounted = false;
  private _destroyed = false;
  private _tickAccumulatorMs = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly hooks: Record<HookPhase, Array<NodeHookFn<Node<any, any>>>> = {
    [HookPhase.BEFORE_UPDATE]: [],
    [HookPhase.AFTER_UPDATE]: [],
    [HookPhase.BEFORE_RENDER]: [],
    [HookPhase.AFTER_RENDER]: [],
  };

  constructor(id: string, props?: TProps) {
    this.id = id;
    this.props = (props ? { ...props } : {}) as TProps;
    this.state = this.createInitialState(this.props);
  }

  public get mounted(): boolean {
    return this._mounted;
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }

  // --- Properties & State Management ---

  public getProps(): Readonly<TProps> {
    return this.props;
  }

  public setProps(partial: Partial<TProps>, requestRender = true): this {
    const prevProps = { ...this.props };
    this.props = { ...this.props, ...partial };
    this.onPropsChanged(prevProps);
    if (requestRender) {
      this.requestRender();
    }
    return this;
  }

  public getState(): Readonly<TState> {
    return this.state;
  }

  public setState(
    updater: Partial<TState> | ((prevState: Readonly<TState>) => Partial<TState>),
    requestRender = true
  ): this {
    const prevState = { ...this.state };
    const patch =
      typeof updater === 'function' ? updater(prevState) : updater;
    this.state = { ...this.state, ...patch };
    this.onStateChanged(prevState);
    if (requestRender) {
      this.requestRender();
    }
    return this;
  }

  /**
   * Resets this node's state to its initial state and optionally cascades
   * the reset to all descendant nodes.
   */
  public resetState(options: NodeResetOptions = {}): this {
    const recursive = options.recursive ?? true;
    this._tickAccumulatorMs = 0;
    this.state = this.createInitialState(this.props);
    this.onResetState();

    if (recursive) {
      for (const child of this.children) {
        if (!child.destroyed) {
          child.resetState({ recursive: true });
        }
      }
    }

    this.requestRender();
    return this;
  }

  // --- Hierarchy Management ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addChild<TChild extends Node<any, any>>(child: TChild): TChild {
    if (child.parent && child.parent !== this) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    child.treeProcessor = this.treeProcessor;
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
    if (this._mounted && !child._mounted) {
      child._notifyMounted(this.treeProcessor);
    }
    this.requestRender();
    return child;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addChildren(...nodes: Array<Node<any, any>>): this {
    for (const node of nodes) {
      this.addChild(node);
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public removeChild(childOrId: Node<any, any> | string): boolean {
    const idx = this.children.findIndex((c) =>
      typeof childOrId === 'string' ? c.id === childOrId : c === childOrId
    );
    if (idx === -1) return false;

    const [removed] = this.children.splice(idx, 1);
    removed._notifyUnmounted();
    removed.parent = null;
    this.requestRender();
    return true;
  }

  public clearChildren(destroyChildren = false): this {
    const current = [...this.children];
    this.children = [];
    for (const child of current) {
      child._notifyUnmounted();
      child.parent = null;
      if (destroyChildren) {
        child.destroy();
      }
    }
    this.requestRender();
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public findChild<T extends Node<any, any> = Node<any, any>>(
    id: string,
    recursive = true
  ): T | null {
    for (const child of this.children) {
      if (child.destroyed) continue;
      if (child.id === id) {
        return child as T;
      }
      if (recursive) {
        const found = child.findChild<T>(id, true);
        if (found) return found;
      }
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getRoot(): AppRootNode<any, any> | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: Node<any, any> | null = this;
    while (current) {
      if (current.isAppRootNode()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return current as unknown as AppRootNode<any, any>;
      }
      current = current.parent;
    }
    return null;
  }

  protected isAppRootNode(): boolean {
    return false;
  }

  public getViewport(): VirtualViewport | null {
    return this.getRoot()?.getViewport() ?? null;
  }

  public getUI(): VirtualUIDecorator | null {
    return this.getRoot()?.getUI() ?? null;
  }

  public getInput(): InputRouter | null {
    return this.getRoot()?.getInput() ?? null;
  }

  public requestRender(): void {
    this.getViewport()?.requestRender();
  }

  // --- Cascading Authority & Lifecycle States ---

  /**
   * Returns true if this node and all of its ancestors are visible and not destroyed.
   */
  public isEffectivelyVisible(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let curr: Node<any, any> | null = this;
    while (curr) {
      if (curr._destroyed || !curr.visible) return false;
      curr = curr.parent;
    }
    return true;
  }

  /**
   * Returns true if this node and all of its ancestors are enabled and not destroyed.
   */
  public isEffectivelyEnabled(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let curr: Node<any, any> | null = this;
    while (curr) {
      if (curr._destroyed || !curr.enabled) return false;
      curr = curr.parent;
    }
    return true;
  }

  /**
   * Returns true if this node or any of its ancestors is paused/frozen.
   */
  public isEffectivelyPaused(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let curr: Node<any, any> | null = this;
    while (curr) {
      if (curr.paused) return true;
      curr = curr.parent;
    }
    return false;
  }

  public show(): this {
    return this.setVisible(true);
  }

  public hide(): this {
    return this.setVisible(false);
  }

  public setVisible(visible: boolean): this {
    if (this.visible === visible) return this;
    this.visible = visible;
    this.onVisibilityChanged(visible);
    this.requestRender();
    return this;
  }

  public enable(): this {
    const changed = !this.enabled || !this.visible;
    this.enabled = true;
    this.visible = true;
    if (changed) {
      this.onEnable();
      this.requestRender();
    }
    return this;
  }

  public disable(): this {
    const changed = this.enabled || this.visible;
    this.enabled = false;
    this.visible = false;
    if (changed) {
      this.onDisable();
      this.requestRender();
    }
    return this;
  }

  public setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    if (enabled) {
      this.onEnable();
    } else {
      this.onDisable();
    }
    this.requestRender();
    return this;
  }

  /**
   * Freezes update/tick execution for this node and its entire child subtree
   * while preserving visibility.
   */
  public freeze(): this {
    if (this.paused) return this;
    this.paused = true;
    this.onFreeze();
    this.requestRender();
    return this;
  }

  /**
   * Resumes update/tick execution for this node and its child subtree.
   */
  public unfreeze(): this {
    if (!this.paused) return this;
    this.paused = false;
    this._tickAccumulatorMs = 0;
    this.onUnfreeze();
    this.requestRender();
    return this;
  }

  public resetTickAccumulator(): void {
    this._tickAccumulatorMs = 0;
  }

  /**
   * Unloads and destroys all child nodes while keeping this container node alive,
   * or destroys this node and its subtree when `destroySelf` is true.
   */
  public unload(destroySelf = false): void {
    if (destroySelf) {
      this.destroy();
    } else {
      this.clearChildren(true);
    }
  }

  /**
   * Permanently destroys this node and cascades destruction to all children.
   */
  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._notifyUnmounted();

    for (const child of this.children) {
      child.destroy();
    }
    this.children = [];
    this.clearHooks();
    this.onDestroy();
  }

  // --- Node Lifecycle Hooks ---

  public addHook(phase: HookPhase, hook: NodeHookFn<this>): () => void {
    const list = this.hooks[phase];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawHook = hook as unknown as NodeHookFn<Node<any, any>>;
    list.push(rawHook);
    return () => {
      const idx = list.indexOf(rawHook);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    };
  }

  public clearHooks(phase?: HookPhase): void {
    if (phase !== undefined) {
      this.hooks[phase] = [];
      return;
    }
    this.hooks[HookPhase.BEFORE_UPDATE] = [];
    this.hooks[HookPhase.AFTER_UPDATE] = [];
    this.hooks[HookPhase.BEFORE_RENDER] = [];
    this.hooks[HookPhase.AFTER_RENDER] = [];
  }

  public executeHooks(phase: HookPhase, dt: number): void {
    const phaseHooks = this.hooks[phase];
    for (let i = phaseHooks.length - 1; i >= 0; i--) {
      const hook = phaseHooks[i];
      if (hook(this, dt)) {
        phaseHooks.splice(i, 1);
      }
    }
  }

  // --- Internal Frame & Event Processing ---

  public processUpdate(dt: number): void {
    this.onUpdate(dt);

    const intervalMs = this.getTickIntervalMs();
    if (intervalMs !== null && intervalMs > 0) {
      this._tickAccumulatorMs += dt * 1000;
      if (this._tickAccumulatorMs >= intervalMs) {
        this._tickAccumulatorMs %= intervalMs;
        this.onTick();
      }
    }
  }

  public handleControlEvent(event: ControlEvent): boolean {
    if (this._destroyed || !this.enabled) return false;
    const handled = this.onControlEvent(event);
    if (handled === true && !event.consumed) {
      event.consume();
    }
    return event.consumed;
  }

  /** @internal */
  public _notifyMounted(processor: NodeTreeProcessor | null): void {
    this.treeProcessor = processor;
    if (!this._mounted) {
      this._mounted = true;
      this.onMount();
    }
    for (const child of this.children) {
      if (!child._destroyed) {
        child._notifyMounted(processor);
      }
    }
  }

  /** @internal */
  public _notifyUnmounted(): void {
    if (!this._mounted) return;
    for (const child of this.children) {
      child._notifyUnmounted();
    }
    this._mounted = false;
    this.onUnmount();
  }

  // --- Protected OOP Extension Hooks for Subclasses ---

  protected createInitialState(_props: Readonly<TProps>): TState {
    return {} as TState;
  }

  protected getTickIntervalMs(): number | null {
    return null;
  }

  protected onMount(): void {}

  protected onUnmount(): void {}

  protected onDestroy(): void {}

  protected onEnable(): void {}

  protected onDisable(): void {}

  protected onFreeze(): void {}

  protected onUnfreeze(): void {}

  protected onVisibilityChanged(_visible: boolean): void {}

  protected onPropsChanged(_prevProps: Readonly<TProps>): void {}

  protected onStateChanged(_prevState: Readonly<TState>): void {}

  protected onResetState(): void {}

  protected onUpdate(_dt: number): void {}

  protected onTick(): void {}

  protected onControlEvent(_event: ControlEvent): boolean | void {
    return false;
  }
}
