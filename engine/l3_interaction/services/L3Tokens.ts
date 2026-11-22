import type { IL3BoundaryPort } from '../../di/EngineKernel';
import { createServiceToken } from '../../di/ServiceTypes';
import type { ILayerElevationService } from './LayerElevationService';

export const L3_TOKENS = {
  BoundaryPort: createServiceToken<IL3BoundaryPort, 'L3_INTERACTION'>(
    'L3_INTERACTION',
    'l3.boundary_port',
    'Boundary port bridging L4 domain depth facts into L3 and committing L3 elevation directives to L2.'
  ),
  LayerElevationService: createServiceToken<
    ILayerElevationService,
    'L3_INTERACTION'
  >(
    'L3_INTERACTION',
    'l3.layer_elevation_service',
    'Coordinates logical layer grouping, focus elevation, and depth translation into L2 directives.'
  ),
} as const;
