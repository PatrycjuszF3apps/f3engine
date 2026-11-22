import {
  IL3BoundaryPort,
  ILayerElevationService,
  L3FramePhase,
  L3InteractionServiceRegistrar,
  L3_TOKENS,
  PipelineSlotBinding,
} from '../../../../engine';
import { StageLayerInteractionService } from './StageLayerInteractionService';

/**
 * Application Shadow Service Registrar (`*.registrar.ts`) overriding `L3_TOKENS.LayerElevationService`
 * in L3 (Interaction) and hooking into the `L3_LAYER_ELEVATION` frame lifecycle phase slot.
 */
export class StageLayerInteractionServiceRegistrar extends L3InteractionServiceRegistrar<
  ILayerElevationService,
  readonly [typeof L3_TOKENS.BoundaryPort]
> {
  public readonly provides = L3_TOKENS.LayerElevationService;
  public readonly inject = [L3_TOKENS.BoundaryPort] as const;

  public createInstance(
    boundaryPort: IL3BoundaryPort
  ): ILayerElevationService {
    return new StageLayerInteractionService(boundaryPort);
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
