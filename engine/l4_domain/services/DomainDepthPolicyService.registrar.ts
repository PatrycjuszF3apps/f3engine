import { IL4ToL3BoundaryPort } from '../../di/EngineKernel';
import { L4DomainServiceRegistrar } from '../../di/ServiceRegistrar';
import { L4FramePhase, PipelineSlotBinding } from '../../di/ServiceTypes';
import {
  DefaultDomainDepthPolicyService,
  IDomainDepthPolicyService,
} from './DomainDepthPolicyService';
import { L4_TOKENS } from './L4Tokens';

/**
 * Default Engine Shadow Service Registrar for `DefaultDomainDepthPolicyService` in L4 (Domain).
 */
export class DefaultDomainDepthPolicyServiceRegistrar extends L4DomainServiceRegistrar<
  IDomainDepthPolicyService,
  readonly [typeof L4_TOKENS.BoundaryPort]
> {
  public readonly provides = L4_TOKENS.DomainDepthPolicyService;
  public readonly inject = [L4_TOKENS.BoundaryPort] as const;

  public createInstance(
    boundaryPort: IL4ToL3BoundaryPort
  ): IDomainDepthPolicyService {
    return new DefaultDomainDepthPolicyService(boundaryPort);
  }

  public override getPipelineSlots(): readonly PipelineSlotBinding<
    IDomainDepthPolicyService,
    L4FramePhase
  >[] {
    return [
      {
        phase: 'L4_DEPTH_EVALUATION',
        priority: 100,
        execute: (service, frameCtx) => {
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
