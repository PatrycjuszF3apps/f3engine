import {
  ControlNode,
  IVirtualSurface,
  PaletteColorToken,
  VirtualRect,
} from '../../../../engine';
import { AnimatedBackdropEntity } from '../l4_domain/BackdropUniverseService';

export interface AnimatedBackdropNodeProps {
  readonly entityId: string;
  readonly getEntity: () => AnimatedBackdropEntity | undefined;
  readonly getZIndex: () => number;
  readonly getRank: () => number;
  readonly isPinned: () => boolean;
  readonly isSelected: () => boolean;
  readonly onLayerClicked: (entityId: string) => void;
}

/**
 * Independent animated background `ControlNode` rendered as a child of `LayeredStageContainerNode`.
 *
 * Each instance draws its own distinct procedural animation (`STARFIELD`, `PLASMA_WAVE`,
 * `MATRIX_GRID`, `PRISM_BOUNCE`, or `RADAR_SWEEP`) inside its clipped floating bounding box,
 * displaying its real-time Z-index, logical group, and stack rank in its header bar.
 */
export class AnimatedBackdropNode extends ControlNode<AnimatedBackdropNodeProps> {
  constructor(id: string, props: AnimatedBackdropNodeProps) {
    super(id, props);
    this.interactive = true;
    this.cursor = 'pointer';
  }

  protected override onClick(): void {
    this.props.onLayerClicked(this.props.entityId);
  }

  protected override onRender(
    surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    if (bounds.width <= 12 || bounds.height <= 12) return;
    const entity = this.props.getEntity();
    if (!entity) return;

    const pixelated = surface.getPalette().pixelated;
    const isPinned = this.props.isPinned();
    const isSelected = this.props.isSelected();
    const zIndex = this.props.getZIndex();
    const rank = this.props.getRank();

    // Clip all drawing of this backdrop node strictly to its floating window bounds
    surface.setClipRect(bounds);

    const bgToken: PaletteColorToken =
      entity.groupKey === 'COSMIC' ? 'boardBgEven' : 'boardBgOdd';
    surface.fillRect(bounds.x, bounds.y, bounds.width, bounds.height, bgToken);

    const headerH = 12;
    const contentRect: VirtualRect = {
      x: bounds.x + 1,
      y: bounds.y + headerH,
      width: Math.max(1, bounds.width - 2),
      height: Math.max(1, bounds.height - headerH - 1),
    };

    // Draw procedural animated background inside content area
    surface.setClipRect(contentRect);
    switch (entity.pattern) {
      case 'STARFIELD':
        this.renderStarfield(surface, contentRect, entity.animTime, pixelated);
        break;
      case 'PLASMA_WAVE':
        this.renderPlasmaWave(surface, contentRect, entity.animTime, pixelated);
        break;
      case 'MATRIX_GRID':
        this.renderMatrixGrid(surface, contentRect, entity.animTime, pixelated);
        break;
      case 'PRISM_BOUNCE':
        this.renderPrismBounce(
          surface,
          contentRect,
          entity.animTime,
          pixelated
        );
        break;
      case 'RADAR_SWEEP':
        this.renderRadarSweep(surface, contentRect, entity.animTime, pixelated);
        break;
    }

    // Restore full node clip for window chrome & header
    surface.setClipRect(bounds);

    const headerBg: PaletteColorToken = isPinned
      ? 'accent'
      : isSelected || this.hovered
        ? 'panelBg'
        : 'panelAlt';
    surface.fillRect(bounds.x, bounds.y, bounds.width, headerH, headerBg);

    const borderToken: PaletteColorToken = isPinned
      ? 'accentBright'
      : isSelected || this.hovered
        ? 'borderHighlight'
        : pixelated
          ? 'textMain'
          : entity.accentToken;

    surface.strokeRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      borderToken,
      isPinned || isSelected ? 2 : 1
    );
    surface.drawLine(
      bounds.x,
      bounds.y + headerH,
      bounds.x + bounds.width - 1,
      bounds.y + headerH,
      borderToken
    );

    const headerTextToken: PaletteColorToken = isPinned
      ? 'textInverse'
      : 'textMain';
    const pinPrefix = isPinned ? '★' : `#${rank}`;
    const leftLabel = `${pinPrefix} ${entity.shortName}`;
    const rightLabel = `Z:${zIndex}`;

    surface.drawText(leftLabel, bounds.x + 3, bounds.y + 2, {
      color: headerTextToken,
      scale: 1,
    });

    surface.drawText(rightLabel, bounds.x + bounds.width - 3, bounds.y + 2, {
      color: isPinned ? 'textInverse' : 'accentBright',
      scale: 1,
      align: 'right',
    });

    surface.setClipRect(null);
  }

  private renderStarfield(
    surface: IVirtualSurface,
    rect: VirtualRect,
    t: number,
    pixelated: boolean
  ): void {
    const w = Math.max(1, rect.width - 4);
    const h = Math.max(1, rect.height - 4);
    const cx = rect.x + Math.floor(rect.width / 2);
    const cy = rect.y + Math.floor(rect.height / 2);
    const pulseR = 6 + Math.round((Math.sin(t * 1.6) + 1) * 4);
    surface.fillCircle(
      cx,
      cy,
      pulseR,
      pixelated ? 'border' : 'panelBg'
    );

    const count = 28;
    for (let i = 0; i < count; i++) {
      const layerSpeed = 6 + (i % 5) * 5;
      const hashX = (i * 53 + i * i * 17) % 997;
      const hashY = (i * 97 + i * i * 31 + 41) % 991;
      const sx = rect.x + 2 + Math.floor((hashX + t * layerSpeed) % w);
      const sy =
        rect.y +
        2 +
        Math.floor((hashY + Math.sin(t * 0.8 + i) * 4 + h) % h);
      const token: PaletteColorToken =
        i % 4 === 0
          ? 'textMain'
          : i % 2 === 0
            ? 'primaryEntityHead'
            : 'textMuted';
      if (i % 6 === 0 && !pixelated) {
        surface.fillRect(sx, sy, 2, 2, token);
      } else {
        surface.setPixel(sx, sy, token);
      }
    }
  }

  private renderPlasmaWave(
    surface: IVirtualSurface,
    rect: VirtualRect,
    t: number,
    pixelated: boolean
  ): void {
    const midY = rect.y + Math.floor(rect.height / 2);
    const amp = Math.max(4, Math.floor(rect.height * 0.34));
    for (let dx = 0; dx < rect.width; dx += 2) {
      const x = rect.x + dx;
      const y1 =
        midY + Math.round(Math.sin(dx * 0.09 + t * 2.2) * amp * 0.75);
      const y2 =
        midY + Math.round(Math.cos(dx * 0.06 - t * 1.7) * amp * 0.55);
      surface.drawLine(
        x,
        y1,
        x,
        midY,
        pixelated ? 'primaryEntityBody' : 'targetHighlight'
      );
      surface.setPixel(x, y1, 'textMain');
      surface.setPixel(x, y2, 'primaryEntityHead');
    }
  }

  private renderMatrixGrid(
    surface: IVirtualSurface,
    rect: VirtualRect,
    t: number,
    pixelated: boolean
  ): void {
    const colStep = 8;
    const cols = Math.max(1, Math.floor(rect.width / colStep));
    for (let c = 0; c < cols; c++) {
      const x = rect.x + 3 + c * colStep;
      const dropSpeed = 16 + (c % 5) * 7;
      const headY =
        rect.y +
        Math.floor(((c * 19 + t * dropSpeed) % Math.max(1, rect.height)));
      for (let tail = 0; tail < 6; tail++) {
        const py = headY - tail * 3;
        if (py >= rect.y && py < rect.y + rect.height) {
          const token: PaletteColorToken =
            tail === 0
              ? 'textMain'
              : tail < 3
                ? 'primaryEntityBody'
                : pixelated
                  ? 'border'
                  : 'textMuted';
          surface.fillRect(x, py, 2, 2, token);
        }
      }
    }
  }

  private renderPrismBounce(
    surface: IVirtualSurface,
    rect: VirtualRect,
    t: number,
    pixelated: boolean
  ): void {
    // Subtle retro grid inside prism backdrop
    for (let gx = rect.x + 8; gx < rect.x + rect.width - 2; gx += 12) {
      surface.drawLine(gx, rect.y, gx, rect.y + rect.height - 1, 'panelBg');
    }
    for (let gy = rect.y + 8; gy < rect.y + rect.height - 2; gy += 12) {
      surface.drawLine(rect.x, gy, rect.x + rect.width - 1, gy, 'panelBg');
    }

    const centers: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 4; i++) {
      const size = 8 + (i % 2) * 4;
      const maxW = Math.max(1, rect.width - size - 6);
      const maxH = Math.max(1, rect.height - size - 6);
      const normX = 0.5 + 0.44 * Math.sin(t * (1.1 + i * 0.25) + i * 1.7);
      const normY = 0.5 + 0.44 * Math.cos(t * (1.3 + i * 0.2) + i * 2.1);
      const px = rect.x + 3 + Math.round(normX * maxW);
      const py = rect.y + 3 + Math.round(normY * maxH);
      centers.push({
        x: px + Math.floor(size / 2),
        y: py + Math.floor(size / 2),
      });
    }

    // Connect vertices into a dynamic rotating retro wireframe polygon
    for (let i = 0; i < centers.length; i++) {
      const a = centers[i];
      const b = centers[(i + 1) % centers.length];
      surface.drawLine(
        a.x,
        a.y,
        b.x,
        b.y,
        pixelated ? 'textMain' : 'targetFill'
      );
    }
    surface.drawLine(
      centers[0].x,
      centers[0].y,
      centers[2].x,
      centers[2].y,
      pixelated ? 'border' : 'primaryEntityHead'
    );
    surface.drawLine(
      centers[1].x,
      centers[1].y,
      centers[3].x,
      centers[3].y,
      pixelated ? 'border' : 'primaryEntityHead'
    );

    // Draw prism vertex blocks on top of wireframe lines
    for (let i = 0; i < centers.length; i++) {
      const size = 8 + (i % 2) * 4;
      const px = centers[i].x - Math.floor(size / 2);
      const py = centers[i].y - Math.floor(size / 2);
      const fillToken: PaletteColorToken =
        i % 2 === 0 ? 'targetFill' : 'primaryEntityHead';
      surface.fillRect(px, py, size, size, fillToken);
      if (!pixelated) {
        surface.strokeRect(px, py, size, size, 'textMain', 1);
      }
    }
  }

  private renderRadarSweep(
    surface: IVirtualSurface,
    rect: VirtualRect,
    t: number,
    pixelated: boolean
  ): void {
    const cx = rect.x + Math.floor(rect.width / 2);
    const cy = rect.y + Math.floor(rect.height / 2);
    const maxR = Math.max(6, Math.floor(Math.min(rect.width, rect.height) * 0.42));

    surface.drawLine(rect.x + 2, cy, rect.x + rect.width - 3, cy, 'border');
    surface.drawLine(cx, rect.y + 2, cx, rect.y + rect.height - 3, 'border');
    surface.strokeRect(
      cx - maxR,
      cy - maxR,
      maxR * 2,
      maxR * 2,
      'border',
      1
    );

    const angle = t * 1.9;
    const tipX = cx + Math.round(Math.cos(angle) * maxR);
    const tipY = cy + Math.round(Math.sin(angle) * maxR);
    surface.drawLine(
      cx,
      cy,
      tipX,
      tipY,
      pixelated ? 'textMain' : 'primaryEntityEye'
    );
    surface.fillCircle(tipX, tipY, 2, 'targetFill');
  }
}
