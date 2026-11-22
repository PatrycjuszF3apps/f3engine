import type { Node } from '../nodes/Node';

/**
 * L2 Runtime contract responsible for determining child traversal order during rendering
 * (back-to-front) and interaction/hit-testing (front-to-back).
 *
 * Applications can replace this service via a custom `L2RuntimeServiceRegistrar`
 * to implement real-time Z-index sorting, Y-sorting, or group-based layering.
 */
export interface IChildOrderService {
  prepareFrameOrder(frameId: number): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveRenderOrder(parent: Node<any, any>): readonly Node<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveInteractionOrder(parent: Node<any, any>): readonly Node<any, any>[];
}

/**
 * Default engine `IChildOrderService` preserving natural child insertion order
 * (`children[0..n-1]` for rendering, `children[n-1..0]` for hit-testing and input routing).
 */
export class DefaultInsertionChildOrderService implements IChildOrderService {
  public prepareFrameOrder(_frameId: number): void {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public resolveRenderOrder(parent: Node<any, any>): readonly Node<any, any>[] {
    return parent.children;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public resolveInteractionOrder(parent: Node<any, any>): readonly Node<any, any>[] {
    const len = parent.children.length;
    if (len <= 1) return parent.children;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reversed: Node<any, any>[] = new Array(len);
    for (let i = 0; i < len; i++) {
      reversed[i] = parent.children[len - 1 - i];
    }
    return reversed;
  }
}
