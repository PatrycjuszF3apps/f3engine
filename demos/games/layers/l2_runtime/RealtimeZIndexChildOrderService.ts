import {
  IChildOrderService,
  INodeMetadataService,
  Node,
} from '../../../../engine';

interface CachedParentOrder {
  readonly frameId: number;
  readonly metadataRevision: number;
  readonly childCount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly renderOrder: readonly Node<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly interactionOrder: readonly Node<any, any>[];
}

/**
 * Application-injected L2 Runtime `IChildOrderService` implementation that sorts
 * container children in real time by `(groupOrder, zIndex, insertionSequence)`.
 *
 * Caches sorted child arrays per parent node and invalidates automatically when
 * `frameId`, `nodeMeta.getRevision()`, or `parent.children.length` changes.
 */
export class RealtimeZIndexChildOrderService implements IChildOrderService {
  private currentFrameId = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly cache = new WeakMap<Node<any, any>, CachedParentOrder>();

  constructor(private readonly nodeMetadata: INodeMetadataService) {}

  public prepareFrameOrder(frameId: number): void {
    this.currentFrameId = frameId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public resolveRenderOrder(parent: Node<any, any>): readonly Node<any, any>[] {
    if (parent.children.length <= 1) {
      return parent.children;
    }
    return this.getOrComputeOrder(parent).renderOrder;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public resolveInteractionOrder(parent: Node<any, any>): readonly Node<any, any>[] {
    if (parent.children.length <= 1) {
      return parent.children;
    }
    return this.getOrComputeOrder(parent).interactionOrder;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getOrComputeOrder(parent: Node<any, any>): CachedParentOrder {
    const rev = this.nodeMetadata.getRevision();
    const len = parent.children.length;
    const existing = this.cache.get(parent);

    if (
      existing &&
      existing.frameId === this.currentFrameId &&
      existing.metadataRevision === rev &&
      existing.childCount === len
    ) {
      return existing;
    }

    const renderOrder = [...parent.children].sort((a, b) => {
      const metaA = this.nodeMetadata.getMetadata(a);
      const metaB = this.nodeMetadata.getMetadata(b);

      if (metaA.groupOrder !== metaB.groupOrder) {
        return metaA.groupOrder - metaB.groupOrder;
      }
      if (metaA.zIndex !== metaB.zIndex) {
        return metaA.zIndex - metaB.zIndex;
      }
      return metaA.insertionSequence - metaB.insertionSequence;
    });

    const interactionOrder = [...renderOrder].reverse();
    const entry: CachedParentOrder = {
      frameId: this.currentFrameId,
      metadataRevision: rev,
      childCount: len,
      renderOrder,
      interactionOrder,
    };
    this.cache.set(parent, entry);
    return entry;
  }
}
