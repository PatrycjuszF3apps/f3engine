import {
  DomainDepthFactDTO,
  IDomainDepthPolicyService,
  IL4ToL3BoundaryPort,
  PaletteColorToken,
} from '../../../../engine';

export type DepthSortStrategyMode = 'wave' | 'random' | 'groups';

export type BackdropPatternKind =
  | 'STARFIELD'
  | 'PLASMA_WAVE'
  | 'MATRIX_GRID'
  | 'PRISM_BOUNCE'
  | 'RADAR_SWEEP';

export interface AnimatedBackdropEntity {
  readonly id: string;
  readonly shortName: string;
  readonly groupKey: 'COSMIC' | 'SYNTH';
  readonly pattern: BackdropPatternKind;
  readonly accentToken: PaletteColorToken;
  /** Normalized floating window coordinates [0..1] inside the stage container */
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  velX: number;
  velY: number;
  /** Independent internal animation phase & frequency */
  animTime: number;
  animSpeed: number;
  wavePhaseOffset: number;
  waveFrequency: number;
  /** Current & target domain depth score */
  currentDepthScore: number;
  targetRandomDepth: number;
}

/**
 * Application-custom L4 Domain Service managing 5 independent animated backdrop entities
 * and evaluating their real-time domain depth scores in the universe.
 *
 * Implements `IDomainDepthPolicyService` so it overrides `L4_TOKENS.DomainDepthPolicyService`
 * and publishes `DomainDepthFactDTO[]` downwards through `IL4ToL3BoundaryPort` every frame.
 */
export class BackdropUniverseService implements IDomainDepthPolicyService {
  private readonly backdrops: AnimatedBackdropEntity[];
  private sortMode: DepthSortStrategyMode = 'wave';
  private randomShuffleTimer = 0;

  constructor(private readonly boundaryPort: IL4ToL3BoundaryPort) {
    this.backdrops = this.createInitialBackdrops();
  }

  public getBackdrops(): readonly AnimatedBackdropEntity[] {
    return this.backdrops;
  }

  public getBackdropById(id: string): AnimatedBackdropEntity | undefined {
    return this.backdrops.find((b) => b.id === id);
  }

  public setSortMode(mode: DepthSortStrategyMode): void {
    this.sortMode = mode;
  }

  public getSortMode(): DepthSortStrategyMode {
    return this.sortMode;
  }

  /**
   * Randomizes positions, drift velocities, and depth targets for all 5 animated backdrops.
   */
  public randomizeUniverse(): void {
    for (let i = 0; i < this.backdrops.length; i++) {
      const b = this.backdrops[i];
      const maxX = Math.max(0.05, 0.96 - b.normW);
      const maxY = Math.max(0.05, 0.84 - b.normH);
      b.normX = 0.02 + Math.random() * maxX;
      b.normY = 0.02 + Math.random() * maxY;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.055 + Math.random() * 0.055;
      b.velX = Math.cos(angle) * speed;
      b.velY = Math.sin(angle) * speed;
      b.targetRandomDepth = Math.round((Math.random() - 0.5) * 160);
      b.wavePhaseOffset = Math.random() * Math.PI * 2;
    }
  }

  /**
   * Advances autonomous backdrop drift and internal procedural animation clocks in `L4_DOMAIN_UPDATE`.
   */
  public stepUniverseSimulation(dt: number): void {
    this.randomShuffleTimer += dt;
    if (this.randomShuffleTimer >= 1.8) {
      this.randomShuffleTimer = 0;
      for (const b of this.backdrops) {
        b.targetRandomDepth = Math.round((Math.random() - 0.5) * 180);
      }
    }

    for (const b of this.backdrops) {
      b.animTime += dt * b.animSpeed;
      b.normX += b.velX * dt;
      b.normY += b.velY * dt;

      const minX = 0.02;
      const maxX = Math.max(minX, 0.98 - b.normW);
      const minY = 0.02;
      const maxY = Math.max(minY, 0.96 - b.normH);

      if (b.normX <= minX) {
        b.normX = minX;
        b.velX = Math.abs(b.velX);
      } else if (b.normX >= maxX) {
        b.normX = maxX;
        b.velX = -Math.abs(b.velX);
      }

      if (b.normY <= minY) {
        b.normY = minY;
        b.velY = Math.abs(b.velY);
      } else if (b.normY >= maxY) {
        b.normY = maxY;
        b.velY = -Math.abs(b.velY);
      }
    }
  }

  /**
   * Evaluates domain depth scores in `L4_DEPTH_EVALUATION` and publishes `DomainDepthFactDTO[]`
   * through the L4->L3 boundary port.
   */
  public evaluateDomainDepth(
    _frameId: number,
    dt: number,
    elapsedMs: number
  ): readonly DomainDepthFactDTO[] {
    const tSec = elapsedMs / 1000;

    for (let i = 0; i < this.backdrops.length; i++) {
      const b = this.backdrops[i];
      if (this.sortMode === 'wave') {
        b.currentDepthScore = Math.round(
          Math.sin(tSec * b.waveFrequency + b.wavePhaseOffset) * 80
        );
      } else if (this.sortMode === 'random') {
        const diff = b.targetRandomDepth - b.currentDepthScore;
        b.currentDepthScore += diff * Math.min(1, dt * 3.5);
      } else {
        // 'groups': alternate foreground dominance between COSMIC and SYNTH groups every 3.5s
        const cosmicDominant = Math.sin(tSec * 0.9) >= 0;
        const groupBase =
          b.groupKey === 'COSMIC'
            ? cosmicDominant
              ? 50
              : -50
            : cosmicDominant
              ? -50
              : 50;
        const localCycle = Math.round(
          Math.cos(tSec * 1.4 + b.wavePhaseOffset) * 28
        );
        b.currentDepthScore = groupBase + localCycle;
      }
    }

    const facts: DomainDepthFactDTO[] = this.backdrops.map((b) => ({
      entityKey: b.id,
      groupKey: b.groupKey,
      domainDepthScore: Math.round(b.currentDepthScore),
      label: b.shortName,
    }));

    this.boundaryPort.publishDomainDepthFacts(facts);
    return facts;
  }

  private createInitialBackdrops(): AnimatedBackdropEntity[] {
    return [
      {
        id: 'layer-starfield',
        shortName: 'NEBULA',
        groupKey: 'COSMIC',
        pattern: 'STARFIELD',
        accentToken: 'primaryEntityHead',
        normX: 0.03,
        normY: 0.03,
        normW: 0.54,
        normH: 0.42,
        velX: 0.048,
        velY: 0.038,
        animTime: 0,
        animSpeed: 1.2,
        wavePhaseOffset: 0.0,
        waveFrequency: 1.15,
        currentDepthScore: 10,
        targetRandomDepth: 40,
      },
      {
        id: 'layer-plasma',
        shortName: 'PLASMA',
        groupKey: 'SYNTH',
        pattern: 'PLASMA_WAVE',
        accentToken: 'targetHighlight',
        normX: 0.41,
        normY: 0.06,
        normW: 0.55,
        normH: 0.42,
        velX: -0.054,
        velY: 0.044,
        animTime: 2.1,
        animSpeed: 1.5,
        wavePhaseOffset: 1.25,
        waveFrequency: 1.35,
        currentDepthScore: 30,
        targetRandomDepth: -25,
      },
      {
        id: 'layer-matrix',
        shortName: 'MATRIX',
        groupKey: 'SYNTH',
        pattern: 'MATRIX_GRID',
        accentToken: 'primaryEntityBody',
        normX: 0.05,
        normY: 0.48,
        normW: 0.54,
        normH: 0.44,
        velX: 0.045,
        velY: -0.05,
        animTime: 4.4,
        animSpeed: 1.35,
        wavePhaseOffset: 2.5,
        waveFrequency: 1.05,
        currentDepthScore: -20,
        targetRandomDepth: 75,
      },
      {
        id: 'layer-prisms',
        shortName: 'PRISMS',
        groupKey: 'COSMIC',
        pattern: 'PRISM_BOUNCE',
        accentToken: 'targetFill',
        normX: 0.39,
        normY: 0.46,
        normW: 0.54,
        normH: 0.43,
        velX: -0.048,
        velY: -0.042,
        animTime: 1.3,
        animSpeed: 1.1,
        wavePhaseOffset: 3.75,
        waveFrequency: 1.45,
        currentDepthScore: -45,
        targetRandomDepth: -60,
      },
      {
        id: 'layer-radar',
        shortName: 'RADAR',
        groupKey: 'COSMIC',
        pattern: 'RADAR_SWEEP',
        accentToken: 'primaryEntityEye',
        normX: 0.22,
        normY: 0.25,
        normW: 0.54,
        normH: 0.44,
        velX: 0.056,
        velY: 0.046,
        animTime: 3.0,
        animSpeed: 1.4,
        wavePhaseOffset: 5.0,
        waveFrequency: 1.25,
        currentDepthScore: 55,
        targetRandomDepth: 15,
      },
    ];
  }
}
