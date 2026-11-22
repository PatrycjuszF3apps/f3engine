import { L1InfrastructureServiceRegistrar } from '../../di/ServiceRegistrar';
import { L1FramePhase, PipelineSlotBinding } from '../../di/ServiceTypes';
import {
  DefaultFrameClockTelemetryService,
  IFrameClockTelemetryService,
} from './FrameClockTelemetryService';
import { L1_TOKENS } from './L1Tokens';

/**
 * Shadow Service Registrar for `DefaultFrameClockTelemetryService` in L1 (Infrastructure).
 */
export class DefaultFrameClockTelemetryServiceRegistrar extends L1InfrastructureServiceRegistrar<IFrameClockTelemetryService> {
  public readonly provides = L1_TOKENS.FrameClockTelemetryService;
  public readonly inject = [] as const;

  public createInstance(): IFrameClockTelemetryService {
    return new DefaultFrameClockTelemetryService();
  }

  public override getPipelineSlots(): readonly PipelineSlotBinding<
    IFrameClockTelemetryService,
    L1FramePhase
  >[] {
    return [
      {
        phase: 'L1_INPUT_POLL',
        priority: 100,
        execute: (service, frameCtx) => {
          service.recordFrameSample(
            frameCtx.frameId,
            frameCtx.dt,
            frameCtx.elapsedMs
          );
        },
      },
    ];
  }
}
