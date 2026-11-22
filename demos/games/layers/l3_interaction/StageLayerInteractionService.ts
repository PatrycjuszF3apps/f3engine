import {
  IL3BoundaryPort,
  ILayerElevationService,
  LayerElevationDirectiveDTO,
} from '../../../../engine';

/**
 * Application-custom L3 Interaction Layer Elevation Service for the Layer Stack demo.
 *
 * Consumes pure `DomainDepthFactDTO` records published by L4, applies interaction-level
 * grouping priorities (`COSMIC` vs `SYNTH`) and manual user focus/pin elevation, and
 * commits `LayerElevationDirectiveDTO` commands downwards to L2.
 */
export class StageLayerInteractionService implements ILayerElevationService {
  private readonly groupPriorities = new Map<string, number>([
    ['COSMIC', 10],
    ['SYNTH', 10],
  ]);
  private pinnedNodeId: string | null = null;
  private highlightedNodeId = 'layer-starfield';
  private latestDirectives: readonly LayerElevationDirectiveDTO[] = [];

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

  public setHighlightedNodeId(nodeId: string): void {
    this.highlightedNodeId = nodeId;
  }

  public getHighlightedNodeId(): string {
    return this.highlightedNodeId;
  }

  public getLatestDirectives(): readonly LayerElevationDirectiveDTO[] {
    return this.latestDirectives;
  }

  public resolveFrameElevations(
    _frameId: number
  ): readonly LayerElevationDirectiveDTO[] {
    const facts = this.boundaryPort.readDomainDepthFacts();
    if (facts.length === 0) {
      return this.latestDirectives;
    }

    const directives: LayerElevationDirectiveDTO[] = facts.map((fact) => {
      const isPinned =
        this.pinnedNodeId !== null && fact.entityKey === this.pinnedNodeId;
      const baseGroupPriority = this.getGroupPriority(fact.groupKey);
      return {
        nodeId: fact.entityKey,
        layerGroup: fact.groupKey,
        groupOrder: isPinned ? baseGroupPriority + 500 : baseGroupPriority,
        zIndex: isPinned ? 999 : Math.round(fact.domainDepthScore),
      };
    });

    this.latestDirectives = directives;
    this.boundaryPort.commitElevationDirectives(directives);
    return directives;
  }
}
