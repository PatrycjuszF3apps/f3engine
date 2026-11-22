import { L2RuntimeServiceRegistrar } from '../../di/ServiceRegistrar';
import { L2FramePhase, PipelineSlotBinding } from '../../di/ServiceTypes';
import {
  DefaultInsertionChildOrderService,
  IChildOrderService,
} from './ChildOrderService';
import { L2_TOKENS } from './L2Tokens';

/**
 * Default Engine Shadow Service Registrar for `DefaultInsertionChildOrderService` in L2 (Runtime).
 * Automatically yields when an application registers its own `IChildOrderService` registrar.
 */
export class DefaultChildOrderServiceRegistrar extends L2RuntimeServiceRegistrar<IChildOrderService> {
  public readonly provides = L2_TOKENS.ChildOrderService;
  public readonly inject = [] as const;

  public createInstance(): IChildOrderService {
    return new DefaultInsertionChildOrderService();
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
