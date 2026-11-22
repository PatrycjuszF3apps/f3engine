import { IL2FromL3BoundaryPort } from '../../di/EngineKernel';
import { L2RuntimeServiceRegistrar } from '../../di/ServiceRegistrar';
import { L2FramePhase, PipelineSlotBinding } from '../../di/ServiceTypes';
import { L2_TOKENS } from './L2Tokens';
import {
  DefaultNodeMetadataService,
  INodeMetadataService,
} from './NodeMetadataService';

/**
 * Shadow Service Registrar for `DefaultNodeMetadataService` in L2 (Runtime).
 */
export class DefaultNodeMetadataServiceRegistrar extends L2RuntimeServiceRegistrar<
  INodeMetadataService,
  readonly [typeof L2_TOKENS.BoundaryPort]
> {
  public readonly provides = L2_TOKENS.NodeMetadataService;
  public readonly inject = [L2_TOKENS.BoundaryPort] as const;

  public createInstance(
    boundaryPort: IL2FromL3BoundaryPort
  ): INodeMetadataService {
    return new DefaultNodeMetadataService(boundaryPort);
  }

  public override getPipelineSlots(): readonly PipelineSlotBinding<
    INodeMetadataService,
    L2FramePhase
  >[] {
    return [
      {
        phase: 'L2_ORDER_RESOLVE',
        priority: 200,
        execute: (service, frameCtx) => {
          service.syncFromBoundaryDirectives(frameCtx.frameId);
        },
      },
    ];
  }
}
