import type { IL2FromL3BoundaryPort } from '../../di/EngineKernel';
import { createServiceToken } from '../../di/ServiceTypes';
import type { IChildOrderService } from './ChildOrderService';
import type { IHitTestService } from './HitTestService';
import type { INodeMetadataService } from './NodeMetadataService';

export const L2_TOKENS = {
  BoundaryPort: createServiceToken<IL2FromL3BoundaryPort, 'L2_RUNTIME'>(
    'L2_RUNTIME',
    'l2.from_l3_boundary_port',
    'Boundary port receiving normalized layer elevation directives from L3.'
  ),
  NodeMetadataService: createServiceToken<INodeMetadataService, 'L2_RUNTIME'>(
    'L2_RUNTIME',
    'l2.node_metadata_service',
    'Manages external low-level ordering and grouping metadata attached to scene graph nodes.'
  ),
  ChildOrderService: createServiceToken<IChildOrderService, 'L2_RUNTIME'>(
    'L2_RUNTIME',
    'l2.child_order_service',
    'Determines child traversal order for rendering (back-to-front) and interaction (front-to-back).'
  ),
  HitTestService: createServiceToken<IHitTestService, 'L2_RUNTIME'>(
    'L2_RUNTIME',
    'l2.hit_test_service',
    'Performs spatial hit-testing across the node tree using the active ChildOrderService.'
  ),
} as const;
