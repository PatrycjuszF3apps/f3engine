import {
  IChildOrderService,
  INodeMetadataService,
  L2FramePhase,
  L2RuntimeServiceRegistrar,
  L2_TOKENS,
  PipelineSlotBinding,
} from '../../../../engine';
import { RealtimeZIndexChildOrderService } from './RealtimeZIndexChildOrderService';

/**
 * Application Shadow Service Registrar (`*.registrar.ts`) overriding `L2_TOKENS.ChildOrderService`
 * in L2 (Runtime) with `RealtimeZIndexChildOrderService`.
 *
 * Autowires `L2_TOKENS.NodeMetadataService` and binds to the `L2_ORDER_RESOLVE` frame phase slot.
 */
export class RealtimeZIndexChildOrderServiceRegistrar extends L2RuntimeServiceRegistrar<
  IChildOrderService,
  readonly [typeof L2_TOKENS.NodeMetadataService]
> {
  public readonly provides = L2_TOKENS.ChildOrderService;
  public readonly inject = [L2_TOKENS.NodeMetadataService] as const;

  public createInstance(
    nodeMetadata: INodeMetadataService
  ): IChildOrderService {
    return new RealtimeZIndexChildOrderService(nodeMetadata);
  }

  public override getPipelineSlots(): readonly PipelineSlotBinding<
    IChildOrderService,
    L2FramePhase
  >[] {
    return [
      {
        phase: 'L2_ORDER_RESOLVE',
        priority: 100,
        execute: (service, frameCtx) => {
          service.prepareFrameOrder(frameCtx.frameId);
        },
      },
    ];
  }
}
