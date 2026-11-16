import { ControlEvent, PointerControlEvent } from '../input/ControlEvents';
import { IVirtualSurface } from '../VirtualSurface';
import { CanvasNode } from './CanvasNode';
import { ContainerNode } from './ContainerNode';
import { ControlNode } from './ControlNode';
import { Node } from './Node';
import { HookPhase, NodeHookFn } from './NodeTypes';

/**
 * Traverses and orchestrates the application Node tree:
 * 1. `runUpdateCycle(dt)` – Executes `BEFORE_UPDATE` / `AFTER_UPDATE` hooks, cascading `enabled`/`paused` checks,
 *    node frame/tick logic, and lazy garbage collection of destroyed child nodes.
 * 2. `runRenderCycle(surface)` – Executes `BEFORE_RENDER` / `AFTER_RENDER` hooks, container layouts,
 *    and back-to-front visual rendering for visible branches.
 * 3. `dispatchControlEvent(event)` – Routes normalized and raw `ControlEvent` instances top-down
 *    (front-to-back Z-order), performing automatic pointer hit-testing and enforcing `modal` barriers.
 */
export class NodeTreeProcessor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public root: Node<any, any> | null = null;

  private readonly phaseHooks: Record<
    HookPhase,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Array<NodeHookFn<Node<any, any>>>
  > = {
    [HookPhase.BEFORE_UPDATE]: [],
    [HookPhase.AFTER_UPDATE]: [],
    [HookPhase.BEFORE_RENDER]: [],
    [HookPhase.AFTER_RENDER]: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hoveredControl: ControlNode<any, any> | null = null;

  public addHook(
    phase: HookPhase,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hook: NodeHookFn<Node<any, any>>
  ): () => void {
    const list = this.phaseHooks[phase];
    list.push(hook);
    return () => {
      const idx = list.indexOf(hook);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    };
  }

  public runUpdateCycle(dt: number): void {
    if (!this.root || this.root.destroyed) return;
    this.processUpdateNode(this.root, true, dt);
  }

  public runRenderCycle(surface: IVirtualSurface): void {
    if (!this.root || this.root.destroyed) return;
    this.processRenderNode(this.root, true, surface);
  }

  public dispatchControlEvent(event: ControlEvent): boolean {
    if (!this.root || this.root.destroyed) return false;

    if (event.kind === 'GAMEPAD_STATUS') {
      this.broadcastEvent(this.root, event);
      return event.consumed;
    }

    if (event.kind === 'POINTER') {
      return this.dispatchPointerEvent(event);
    }

    this.dispatchKeyOrActionNode(this.root, event);
    return event.consumed;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getHoveredControl(): ControlNode<any, any> | null {
    return this.hoveredControl;
  }

  private processUpdateNode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    canParentUpdate: boolean,
    dt: number
  ): void {
    if (node.destroyed) return;

    node.treeProcessor = this;

    // Phase 1: BEFORE_UPDATE
    this.executeTreeHooks(node, HookPhase.BEFORE_UPDATE, dt);
    node.executeHooks(HookPhase.BEFORE_UPDATE, dt);

    const canBranchUpdate = canParentUpdate && node.enabled && !node.paused;
    if (canBranchUpdate) {
      node.processUpdate(dt);
    }

    // Phase 2: AFTER_UPDATE
    node.executeHooks(HookPhase.AFTER_UPDATE, dt);
    this.executeTreeHooks(node, HookPhase.AFTER_UPDATE, dt);

    let hasDestroyedChildren = false;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.destroyed) {
        hasDestroyedChildren = true;
      } else {
        this.processUpdateNode(child, canBranchUpdate, dt);
        if (child.destroyed) {
          hasDestroyedChildren = true;
        }
      }
    }

    if (hasDestroyedChildren) {
      node.children = node.children.filter((c) => !c.destroyed);
    }
  }

  private processRenderNode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    canParentRender: boolean,
    surface: IVirtualSurface
  ): void {
    if (node.destroyed) return;

    const canBranchRender = canParentRender && node.visible;
    if (!canBranchRender) return;

    // Phase 3: BEFORE_RENDER
    this.executeTreeHooks(node, HookPhase.BEFORE_RENDER, 0);
    node.executeHooks(HookPhase.BEFORE_RENDER, 0);

    if (node instanceof ContainerNode) {
      node.performLayout();
    }

    if (node instanceof CanvasNode) {
      node.render(surface);
    }

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (!child.destroyed) {
        this.processRenderNode(child, canBranchRender, surface);
      }
    }

    // Phase 4: AFTER_RENDER
    node.executeHooks(HookPhase.AFTER_RENDER, 0);
    this.executeTreeHooks(node, HookPhase.AFTER_RENDER, 0);
  }

  private dispatchPointerEvent(event: PointerControlEvent): boolean {
    if (!this.root) return false;

    if (event.pointerType === 'LEAVE') {
      this.updateHoveredControl(null);
      return false;
    }

    const hitResult = this.findTopHitControl(this.root, event.vx, event.vy);
    const target = hitResult.target;

    this.updateHoveredControl(target);

    if (target) {
      if (event.pointerType === 'CLICK') {
        target.triggerClick(event);
        target.handleControlEvent(event);
        event.consume();
      } else {
        target.handleControlEvent(event);
      }
      return event.consumed;
    }

    if (hitResult.blockedByModal) {
      event.consume();
      return true;
    }

    return false;
  }

  private findTopHitControl(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    vx: number,
    vy: number
  ): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: ControlNode<any, any> | null;
    blockedByModal: boolean;
  } {
    if (node.destroyed || !node.visible || !node.enabled) {
      return { target: null, blockedByModal: false };
    }

    // Traverse children in reverse order (top-most rendered layer first)
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      const res = this.findTopHitControl(child, vx, vy);
      if (res.target) {
        return res;
      }
      if (res.blockedByModal) {
        return { target: null, blockedByModal: true };
      }
    }

    if (node instanceof ControlNode) {
      if (node.interactive && node.containsPoint(vx, vy)) {
        return { target: node, blockedByModal: node.modal };
      }
      if (node.modal) {
        return { target: null, blockedByModal: true };
      }
    }

    return { target: null, blockedByModal: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updateHoveredControl(next: ControlNode<any, any> | null): void {
    if (this.hoveredControl && (this.hoveredControl.destroyed || !this.hoveredControl.isEffectivelyVisible())) {
      this.hoveredControl.setHovered(false);
      this.hoveredControl = null;
    }

    if (this.hoveredControl === next) {
      const vp = this.root?.getViewport();
      if (vp) {
        vp.setCursorStyle(next ? next.cursor : 'default');
      }
      return;
    }

    if (this.hoveredControl) {
      this.hoveredControl.setHovered(false);
    }
    this.hoveredControl = next;
    if (next) {
      next.setHovered(true);
    }

    const vp = this.root?.getViewport();
    if (vp) {
      vp.setCursorStyle(next ? next.cursor : 'default');
    }
  }

  private dispatchKeyOrActionNode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    event: ControlEvent
  ): { consumed: boolean; blockedByModal: boolean } {
    if (node.destroyed || !node.enabled || !node.visible) {
      return { consumed: false, blockedByModal: false };
    }

    // 1. Dispatch to children in reverse order (top-most layer first)
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      const res = this.dispatchKeyOrActionNode(child, event);
      if (res.consumed || event.consumed) {
        return { consumed: true, blockedByModal: true };
      }
      if (res.blockedByModal) {
        return { consumed: false, blockedByModal: true };
      }
    }

    // 2. Dispatch to self
    if (node.handleControlEvent(event) || event.consumed) {
      return { consumed: true, blockedByModal: true };
    }

    // 3. Enforce modal barrier so events never leak behind an active modal control/dialog
    if (node instanceof ControlNode && node.modal) {
      return { consumed: false, blockedByModal: true };
    }

    return { consumed: false, blockedByModal: false };
  }

  private broadcastEvent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    event: ControlEvent
  ): void {
    if (node.destroyed) return;
    node.handleControlEvent(event);
    for (const child of node.children) {
      if (!child.destroyed) {
        this.broadcastEvent(child, event);
      }
    }
  }

  private executeTreeHooks(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    phase: HookPhase,
    dt: number
  ): void {
    const list = this.phaseHooks[phase];
    for (let i = list.length - 1; i >= 0; i--) {
      const hook = list[i];
      if (hook(node, dt)) {
        list.splice(i, 1);
      }
    }
  }
}
