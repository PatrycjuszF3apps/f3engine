import { PaletteColorToken } from '../../../engine';
import {
  Point,
  SnakeBoardNode,
  SnakeBoardProps,
} from '../snake';

const ARENA_OBSTACLE_PILLARS: readonly Point[] = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 5, y: 6 },
  { x: 14, y: 5 },
  { x: 13, y: 5 },
  { x: 14, y: 6 },
  { x: 5, y: 14 },
  { x: 6, y: 14 },
  { x: 5, y: 13 },
  { x: 14, y: 14 },
  { x: 13, y: 14 },
  { x: 14, y: 13 },
];

/**
 * OOP extension of `SnakeBoardNode` for "Snake 2: Arena".
 * Demonstrates how an application variant extends a base board node to introduce
 * obstacle pillars, dual simultaneous targets, custom scoring, and distinct border styling.
 */
export class Snake2ArenaBoardNode extends SnakeBoardNode {
  constructor(id: string, props: SnakeBoardProps) {
    super(id, props);
  }

  protected override getPointsPerFood(): number {
    return 15;
  }

  protected override getTargetFoodCount(): number {
    return 2;
  }

  protected override createObstacles(): Point[] {
    return ARENA_OBSTACLE_PILLARS.map((p) => ({ ...p }));
  }

  protected override getOuterBorderToken(
    pixelated: boolean
  ): PaletteColorToken {
    return pixelated ? 'primaryEntityHead' : 'borderHighlight';
  }

  protected override shouldDrawSnakeEyes(): boolean {
    return false;
  }
}
