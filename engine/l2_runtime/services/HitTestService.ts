import type { ControlNode } from '../nodes/ControlNode';
import { ControlNode as ControlNodeClass } from '../nodes/ControlNode';
import type { Node } from '../nodes/Node';
import type { IChildOrderService } from './ChildOrderService';

export interface HitTestResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly target: ControlNode<any, any> | null;
  readonly blockedByModal: boolean;
}

/**
 * L2 Runtime contract for spatial pointer hit-testing across the node tree.
 */
export interface IHitTestService {
  findTopHitControl(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    root: Node<any, any>,
    vx: number,
    vy: number
  ): HitTestResult;
}

/**
 * Default L2 Hit-Test Service that delegates child traversal order to the injected
 * `IChildOrderService` so hit-testing always matches the front-to-back visual Z-order.
 */
export class DefaultHitTestService implements IHitTestService {
  constructor(private readonly childOrderService: IChildOrderService) {}

  public findTopHitControl(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: Node<any, any>,
    vx: number,
    vy: number
  ): HitTestResult {
    if (node.destroyed || !node.visible || !node.enabled) {
      return { target: null, blockedByModal: false };
    }

    const interactionChildren =
      this.childOrderService.resolveInteractionOrder(node);
    for (let i = 0; i < interactionChildren.length; i++) {
      const child = interactionChildren[i];
      const res = this.findTopHitControl(child, vx, vy);
      if (res.target) {
        return res;
      }
      if (res.blockedByModal) {
        return { target: null, blockedByModal: true };
      }
    }

    if (node instanceof ControlNodeClass) {
      if (node.interactive && node.containsPoint(vx, vy)) {
        return { target: node, blockedByModal: node.modal };
      }
      if (node.modal) {
        return { target: null, blockedByModal: true };
      }
    }

    return { target: null, blockedByModal: false };
  }
}
