import { createServiceToken } from '../../di/ServiceTypes';
import type { IFrameClockTelemetryService } from './FrameClockTelemetryService';

export const L1_TOKENS = {
  FrameClockTelemetryService: createServiceToken<
    IFrameClockTelemetryService,
    'L1_INFRASTRUCTURE'
  >(
    'L1_INFRASTRUCTURE',
    'l1.frame_clock_telemetry_service',
    'Tracks physical frame timing and FPS telemetry at the L1 hardware layer.'
  ),
} as const;
