import {
  IDomainDepthPolicyService,
  IL4ToL3BoundaryPort,
  L4DomainServiceRegistrar,
  L4FramePhase,
  L4_TOKENS,
  PipelineSlotBinding,
} from '../../../../engine';
import { BackdropUniverseService } from './BackdropUniverseService';

/**
 * Application Shadow Service Registrar (`*.registrar.ts`) overriding `L4_TOKENS.DomainDepthPolicyService`
 * in L4 (Domain) and binding `BackdropUniverseService` to both `L4_DOMAIN_UPDATE` and `L4_DEPTH_EVALUATION`.
 */
export class BackdropUniverseServiceRegistrar extends L4DomainServiceRegistrar<
  IDomainDepthPolicyService,
  readonly [typeof L4_TOKENS.BoundaryPort]
> {
  public readonly provides = L4_TOKENS.DomainDepthPolicyService;
  public readonly inject = [L4_TOKENS.BoundaryPort] as const;

  private paused = false;

  public setSimulationPaused(paused: boolean): void {
    this.paused = paused;
  }

  public createInstance(
    boundaryPort: IL4ToL3BoundaryPort
  ): IDomainDepthPolicyService {
    return new BackdropUniverseService(boundaryPort);
  }

  public override getPipelineSlots(): readonly PipelineSlotBinding<
    IDomainDepthPolicyService,
    L4FramePhase
  >[] {
    return [
      {
        phase: 'L4_DOMAIN_UPDATE',
        priority: 100,
        execute: (service, frameCtx) => {
          if (this.paused) return;
          if (service instanceof BackdropUniverseService) {
            service.stepUniverseSimulation(frameCtx.dt);
          }
        },
      },
      {
        phase: 'L4_DEPTH_EVALUATION',
        priority: 100,
        execute: (service, frameCtx) => {
          if (this.paused) return;
          service.evaluateDomainDepth(
            frameCtx.frameId,
            frameCtx.dt,
            frameCtx.elapsedMs
          );
        },
      },
    ];
  }
}
