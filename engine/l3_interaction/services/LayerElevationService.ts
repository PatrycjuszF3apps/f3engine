import type {
  IL3BoundaryPort,
  LayerElevationDirectiveDTO,
} from '../../di/EngineKernel';

/**
 * L3 Interaction service contract translating L4 domain depth facts and L3 group/focus rules
 * into normalized `LayerElevationDirectiveDTO` instructions for L2.
 */
export interface ILayerElevationService {
  setGroupPriority(groupKey: string, priority: number): void;
  getGroupPriority(groupKey: string): number;
  setPinnedNodeId(nodeId: string | null): void;
  getPinnedNodeId(): string | null;
  resolveFrameElevations(frameId: number): readonly LayerElevationDirectiveDTO[];
}

/**
 * Default L3 Interaction Layer Elevation Service.
 */
export class DefaultLayerElevationService implements ILayerElevationService {
  private readonly groupPriorities = new Map<string, number>();
  private pinnedNodeId: string | null = null;

  constructor(private readonly boundaryPort: IL3BoundaryPort) {}

  public setGroupPriority(groupKey: string, priority: number): void {
    this.groupPriorities.set(groupKey, priority);
  }

  public getGroupPriority(groupKey: string): number {
    return this.groupPriorities.get(groupKey) ?? 0;
  }

  public setPinnedNodeId(nodeId: string | null): void {
    this.pinnedNodeId = nodeId;
  }

  public getPinnedNodeId(): string | null {
    return this.pinnedNodeId;
  }

  public resolveFrameElevations(
    _frameId: number
  ): readonly LayerElevationDirectiveDTO[] {
    const facts = this.boundaryPort.readDomainDepthFacts();
    if (facts.length === 0) {
      return [];
    }

    const directives: LayerElevationDirectiveDTO[] = facts.map((fact) => {
      const isPinned =
        this.pinnedNodeId !== null && fact.entityKey === this.pinnedNodeId;
      const baseGroupOrder = this.getGroupPriority(fact.groupKey);
      return {
        nodeId: fact.entityKey,
        layerGroup: fact.groupKey,
        groupOrder: isPinned ? baseGroupOrder + 1000 : baseGroupOrder,
        zIndex: isPinned ? 9999 : Math.round(fact.domainDepthScore),
      };
    });

    this.boundaryPort.commitElevationDirectives(directives);
    return directives;
  }
}
