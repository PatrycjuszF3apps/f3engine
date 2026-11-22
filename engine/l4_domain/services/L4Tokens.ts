import type { IL4ToL3BoundaryPort } from '../../di/EngineKernel';
import { createServiceToken } from '../../di/ServiceTypes';
import type { IDomainDepthPolicyService } from './DomainDepthPolicyService';

export const L4_TOKENS = {
  BoundaryPort: createServiceToken<IL4ToL3BoundaryPort, 'L4_DOMAIN'>(
    'L4_DOMAIN',
    'l4.to_l3_boundary_port',
    'Boundary port publishing pure domain depth facts from L4 downwards to L3.'
  ),
  DomainDepthPolicyService: createServiceToken<
    IDomainDepthPolicyService,
    'L4_DOMAIN'
  >(
    'L4_DOMAIN',
    'l4.domain_depth_policy_service',
    'Evaluates universe-level depth and layer priority facts in the domain layer.'
  ),
} as const;
