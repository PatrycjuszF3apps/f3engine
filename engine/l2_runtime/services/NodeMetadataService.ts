import type { IL2FromL3BoundaryPort } from '../../di/EngineKernel';
import type { Node } from '../nodes/Node';

export interface NodeRuntimeMetadata {
  readonly nodeId: string;
  layerGroup: string;
  groupOrder: number;
  zIndex: number;
  insertionSequence: number;
  customAttributes: Record<string, number | string | boolean>;
}

/**
 * L2 Runtime service contract for storing low-level ordering, grouping, and runtime tags
 * on `Node` instances externally without polluting the base `Node` class.
 */
export interface INodeMetadataService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ensureMetadata(node: Node<any, any>): NodeRuntimeMetadata;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMetadata(node: Node<any, any>): Readonly<NodeRuntimeMetadata>;
  getMetadataById(nodeId: string): Readonly<NodeRuntimeMetadata> | undefined;
  setNodeOrder(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeOrId: Node<any, any> | string,
    patch: Partial<
      Pick<NodeRuntimeMetadata, 'layerGroup' | 'groupOrder' | 'zIndex'>
    >
  ): void;
  setCustomAttribute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeOrId: Node<any, any> | string,
    key: string,
    value: number | string | boolean
  ): void;
  syncFromBoundaryDirectives(frameId: number): void;
  getRevision(): number;
}

/**
 * Default L2 Runtime implementation storing external node metadata in a `WeakMap<Node, NodeRuntimeMetadata>`
 * alongside an ID index for applying DTO directives received from L3 via `IL2FromL3BoundaryPort`.
 */
export class DefaultNodeMetadataService implements INodeMetadataService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly weakStore = new WeakMap<Node<any, any>, NodeRuntimeMetadata>();
  private readonly idStore = new Map<string, NodeRuntimeMetadata>();
  private sequenceCounter = 0;
  private revision = 1;

  constructor(private readonly boundaryPort: IL2FromL3BoundaryPort) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public ensureMetadata(node: Node<any, any>): NodeRuntimeMetadata {
    let meta = this.weakStore.get(node);
    if (!meta) {
      const existingById = this.idStore.get(node.id);
      if (existingById) {
        meta = existingById;
      } else {
        meta = {
          nodeId: node.id,
          layerGroup: 'default',
          groupOrder: 0,
          zIndex: 0,
          insertionSequence: ++this.sequenceCounter,
          customAttributes: {},
        };
        this.idStore.set(node.id, meta);
      }
      this.weakStore.set(node, meta);
      this.revision++;
    }
    return meta;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getMetadata(node: Node<any, any>): Readonly<NodeRuntimeMetadata> {
    return this.ensureMetadata(node);
  }

  public getMetadataById(
    nodeId: string
  ): Readonly<NodeRuntimeMetadata> | undefined {
    return this.idStore.get(nodeId);
  }

  public setNodeOrder(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeOrId: Node<any, any> | string,
    patch: Partial<
      Pick<NodeRuntimeMetadata, 'layerGroup' | 'groupOrder' | 'zIndex'>
    >
  ): void {
    const meta =
      typeof nodeOrId === 'string'
        ? this.getOrCreateById(nodeOrId)
        : this.ensureMetadata(nodeOrId);

    let changed = false;
    if (patch.layerGroup !== undefined && meta.layerGroup !== patch.layerGroup) {
      meta.layerGroup = patch.layerGroup;
      changed = true;
    }
    if (patch.groupOrder !== undefined && meta.groupOrder !== patch.groupOrder) {
      meta.groupOrder = patch.groupOrder;
      changed = true;
    }
    if (patch.zIndex !== undefined && meta.zIndex !== patch.zIndex) {
      meta.zIndex = patch.zIndex;
      changed = true;
    }
    if (changed) {
      this.revision++;
    }
  }

  public setCustomAttribute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeOrId: Node<any, any> | string,
    key: string,
    value: number | string | boolean
  ): void {
    const meta =
      typeof nodeOrId === 'string'
        ? this.getOrCreateById(nodeOrId)
        : this.ensureMetadata(nodeOrId);
    if (meta.customAttributes[key] !== value) {
      meta.customAttributes[key] = value;
      this.revision++;
    }
  }

  public syncFromBoundaryDirectives(_frameId: number): void {
    const directives = this.boundaryPort.drainElevationDirectives();
    for (const dir of directives) {
      this.setNodeOrder(dir.nodeId, {
        layerGroup: dir.layerGroup,
        groupOrder: dir.groupOrder,
        zIndex: dir.zIndex,
      });
    }
  }

  public getRevision(): number {
    return this.revision;
  }

  private getOrCreateById(nodeId: string): NodeRuntimeMetadata {
    let meta = this.idStore.get(nodeId);
    if (!meta) {
      meta = {
        nodeId,
        layerGroup: 'default',
        groupOrder: 0,
        zIndex: 0,
        insertionSequence: ++this.sequenceCounter,
        customAttributes: {},
      };
      this.idStore.set(nodeId, meta);
      this.revision++;
    }
    return meta;
  }
}
