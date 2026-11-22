import {
  ContainerNode,
  ControlEvent,
  IChildOrderService,
  INodeMetadataService,
  IVirtualSurface,
  UIKit,
  VirtualRect,
} from '../../../../engine';
import { StageLayerInteractionService } from '../l3_interaction/StageLayerInteractionService';
import { BackdropUniverseService } from '../l4_domain/BackdropUniverseService';
import { AnimatedBackdropNode } from './AnimatedBackdropNode';

export interface LayeredStageContainerProps {
  readonly universeService: BackdropUniverseService;
  readonly interactionService: StageLayerInteractionService;
  readonly metadataService: INodeMetadataService;
  readonly childOrderService: IChildOrderService;
  readonly onPauseRequest: () => void;
  readonly onShuffleRequest: () => void;
}

/**
 * Dedicated `ContainerNode` subclass managing 5 independent `AnimatedBackdropNode` children
 * whose rendering and hit-testing order (`zIndex`) is updated in real time by the
 * application's 4-layer DDD service pipeline (`L4 -> L3 -> L2`).
 */
export class LayeredStageContainerNode
  extends ContainerNode<LayeredStageContainerProps>
  implements UIKit.ClassicV1.ModalBoundsProvider
{
  private readonly backdropNodes: AnimatedBackdropNode[] = [];
  private readonly rankByNodeId = new Map<string, number>();

  constructor(id: string, props: LayeredStageContainerProps) {
    super(id, props);

    const entities = props.universeService.getBackdrops();
    for (const entity of entities) {
      const childNode: AnimatedBackdropNode = new AnimatedBackdropNode(
        entity.id,
        {
          entityId: entity.id,
          getEntity: () => props.universeService.getBackdropById(entity.id),
          getZIndex: (): number =>
            props.metadataService.getMetadata(childNode).zIndex,
          getRank: () => this.rankByNodeId.get(entity.id) ?? 1,
          isPinned: () =>
            props.interactionService.getPinnedNodeId() === entity.id,
          isSelected: () =>
            props.interactionService.getHighlightedNodeId() === entity.id,
          onLayerClicked: (clickedId) => {
            this.handleLayerClick(clickedId);
          },
        }
      );

      props.metadataService.setNodeOrder(childNode, {
        layerGroup: entity.groupKey,
        groupOrder: 10,
        zIndex: Math.round(entity.currentDepthScore),
      });

      this.backdropNodes.push(childNode);
      this.addChild(childNode);
    }
  }

  public getModalTargetBounds(availableBounds: VirtualRect): VirtualRect {
    return {
      x: availableBounds.x + 2,
      y: availableBounds.y + 2,
      width: Math.max(40, availableBounds.width - 4),
      height: Math.max(40, availableBounds.height - 4),
    };
  }

  public getFrontMostNodeSummary(): {
    readonly shortName: string;
    readonly zIndex: number;
  } {
    const ordered = this.props.childOrderService.resolveRenderOrder(this);
    const topNode = ordered[ordered.length - 1];
    if (!topNode) {
      return { shortName: '--', zIndex: 0 };
    }
    const entity = this.props.universeService.getBackdropById(topNode.id);
    const meta = this.props.metadataService.getMetadata(topNode);
    return {
      shortName: entity?.shortName ?? topNode.id,
      zIndex: meta.zIndex,
    };
  }

  public getPinnedNodeShortName(): string | null {
    const pinnedId = this.props.interactionService.getPinnedNodeId();
    if (!pinnedId) return null;
    return (
      this.props.universeService.getBackdropById(pinnedId)?.shortName ??
      pinnedId
    );
  }

  protected override onLayout(bounds: VirtualRect): void {
    const footerH = 14;
    const stageX = bounds.x + 2;
    const stageY = bounds.y + 2;
    const stageW = Math.max(40, bounds.width - 4);
    const stageH = Math.max(40, bounds.height - footerH - 4);

    // Update live rank lookup [1..N] from L2 IChildOrderService
    const ordered = this.props.childOrderService.resolveRenderOrder(this);
    for (let i = 0; i < ordered.length; i++) {
      this.rankByNodeId.set(ordered[i].id, i + 1);
    }

    // Position each child AnimatedBackdropNode inside the stage container bounds
    for (const childNode of this.backdropNodes) {
      const entity = this.props.universeService.getBackdropById(childNode.id);
      if (!entity) continue;

      const w = Math.max(44, Math.round(stageW * entity.normW));
      const h = Math.max(34, Math.round(stageH * entity.normH));
      const x =
        stageX +
        Math.min(
          Math.max(0, Math.round(stageW * entity.normX)),
          Math.max(0, stageW - w)
        );
      const y =
        stageY +
        Math.min(
          Math.max(0, Math.round(stageH * entity.normY)),
          Math.max(0, stageH - h)
        );

      childNode.setBounds({ x, y, width: w, height: h });
    }
  }

  protected override onControlEvent(event: ControlEvent): boolean {
    if (event.kind === 'DIRECTION' && event.phase !== 'released') {
      if (event.direction === 'LEFT' || event.direction === 'RIGHT') {
        this.cycleHighlightedLayer(event.direction === 'RIGHT' ? 1 : -1);
        return true;
      }
      if (event.direction === 'UP' || event.direction === 'DOWN') {
        this.togglePinHighlightedLayer();
        return true;
      }
    }

    if (event.kind === 'ACTION') {
      if (event.action === 'CONFIRM' && event.source !== 'pointer') {
        this.togglePinHighlightedLayer();
        return true;
      }
      if (event.action === 'PAUSE' || event.action === 'CANCEL') {
        this.props.onPauseRequest();
        return true;
      }
      if (event.action === 'RESTART') {
        this.props.onShuffleRequest();
        return true;
      }
    }

    return false;
  }

  protected override onRender(
    surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const footerH = 14;
    const stageX = bounds.x + 2;
    const stageY = bounds.y + 2;
    const stageW = Math.max(40, bounds.width - 4);
    const stageH = Math.max(40, bounds.height - footerH - 4);

    // 1. Stage outer background & subtle dot grid
    surface.fillRect(stageX, stageY, stageW, stageH, 'panelAlt');
    for (let gx = stageX + 8; gx < stageX + stageW - 4; gx += 12) {
      for (let gy = stageY + 8; gy < stageY + stageH - 4; gy += 12) {
        surface.setPixel(gx, gy, 'border');
      }
    }
    surface.strokeRect(stageX, stageY, stageW, stageH, 'border', 1);

    // 2. Bottom real-time Z-Order Stack status strip
    const footerY = stageY + stageH + 1;
    surface.fillRect(stageX, footerY, stageW, footerH - 1, 'panelBg');
    surface.strokeRect(stageX, footerY, stageW, footerH - 1, 'border', 1);

    const ordered = this.props.childOrderService.resolveRenderOrder(this);
    const labels: string[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const node = ordered[i];
      const entity = this.props.universeService.getBackdropById(node.id);
      const z = this.props.metadataService.getMetadata(node).zIndex;
      const tag = entity ? entity.shortName.slice(0, 3) : node.id;
      labels.push(`${i + 1}:${tag}(${z})`);
    }

    surface.drawText(labels.join(' '), stageX + 3, footerY + 3, {
      color: 'textMain',
      scale: 1,
    });
  }

  private handleLayerClick(entityId: string): void {
    this.props.interactionService.setHighlightedNodeId(entityId);
    const currentPinned = this.props.interactionService.getPinnedNodeId();
    this.props.interactionService.setPinnedNodeId(
      currentPinned === entityId ? null : entityId
    );
    this.requestRender();
  }

  private cycleHighlightedLayer(delta: number): void {
    const backdrops = this.props.universeService.getBackdrops();
    if (backdrops.length === 0) return;
    const currentId = this.props.interactionService.getHighlightedNodeId();
    const idx = backdrops.findIndex((b) => b.id === currentId);
    const nextIdx =
      (Math.max(0, idx) + delta + backdrops.length) % backdrops.length;
    this.props.interactionService.setHighlightedNodeId(backdrops[nextIdx].id);
    this.requestRender();
  }

  private togglePinHighlightedLayer(): void {
    const highlighted = this.props.interactionService.getHighlightedNodeId();
    const currentPinned = this.props.interactionService.getPinnedNodeId();
    this.props.interactionService.setPinnedNodeId(
      currentPinned === highlighted ? null : highlighted
    );
    this.requestRender();
  }
}
