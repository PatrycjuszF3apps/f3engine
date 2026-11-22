import { IL3BoundaryPort } from '../../di/EngineKernel';
import { L3InteractionServiceRegistrar } from '../../di/ServiceRegistrar';
import { L3FramePhase, PipelineSlotBinding } from '../../di/ServiceTypes';
import { L3_TOKENS } from './L3Tokens';
import {
  DefaultLayerElevationService,
  ILayerElevationService,
} from './LayerElevationService';

/**
 * Shadow Service Registrar for `DefaultLayerElevationService` in L3 (Interaction).
 */
export class DefaultLayerElevationServiceRegistrar extends L3InteractionServiceRegistrar<
  ILayerElevationService,
  readonly [typeof L3_TOKENS.BoundaryPort]
> {
  public readonly provides = L3_TOKENS.LayerElevationService;
  public readonly inject = [L3_TOKENS.BoundaryPort] as const;

  public createInstance(
    boundaryPort: IL3BoundaryPort
  ): ILayerElevationService {
    return new DefaultLayerElevationService(boundaryPort);
  }

  public override getPipelineSlots(): readonly PipelineSlotBinding<
    ILayerElevationService,
    L3FramePhase
  >[] {
    return [
      {
        phase: 'L3_LAYER_ELEVATION',
        priority: 100,
        execute: (service, frameCtx) => {
          service.resolveFrameElevations(frameCtx.frameId);
        },
      },
    ];
  }
}
