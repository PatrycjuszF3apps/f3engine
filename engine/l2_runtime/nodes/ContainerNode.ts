import { VirtualRect } from '../../l1_infrastructure/VirtualSurface';
import { CanvasNode } from './CanvasNode';
import { Node } from './Node';

/**
 * Container node capable of grouping child nodes/controls, computing child layouts,
 * and performing batch state transitions across its child hierarchy.
 */
export class ContainerNode<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProps extends object = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TState extends object = Record<string, any>,
> extends CanvasNode<TProps, TState> {
  /**
   * Invoked during the render cycle before rendering self and children,
   * allowing the container to compute and assign `bounds` to its child nodes.
   */
  public performLayout(): void {
    if (!this.visible || this.destroyed) return;
    this.onLayout(this.getGlobalBounds());
  }

  /**
   * Freezes update/tick execution of all direct child nodes.
   */
  public freezeChildren(): this {
    for (const child of this.children) {
      if (!child.destroyed) {
        child.freeze();
      }
    }
    return this;
  }

  /**
   * Resumes update/tick execution of all direct child nodes.
   */
  public unfreezeChildren(): this {
    for (const child of this.children) {
      if (!child.destroyed) {
        child.unfreeze();
      }
    }
    return this;
  }

  /**
   * Hides all direct child nodes.
   */
  public hideChildren(): this {
    for (const child of this.children) {
      if (!child.destroyed) {
        child.hide();
      }
    }
    return this;
  }

  /**
   * Shows only the child node matching `childId` (and enables it) while disabling/hiding all other children.
   * Useful for deck/tab/modal switching inside a container.
   */
  public activateOnlyChild(childId: string | null): this {
    for (const child of this.children) {
      if (child.destroyed) continue;
      if (childId !== null && child.id === childId) {
        child.enable();
      } else {
        child.disable();
      }
    }
    this.requestRender();
    return this;
  }

  /**
   * Adds multiple child controls/nodes to this container.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addControls(...controls: Array<Node<any, any>>): this {
    return this.addChildren(...controls);
  }

  /**
   * Override in container subclasses to position and size child nodes based on the container's bounds.
   */
  protected onLayout(_bounds: VirtualRect): void {}
}
