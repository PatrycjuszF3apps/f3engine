import type {
  DomainDepthFactDTO,
  IL4ToL3BoundaryPort,
} from '../../di/EngineKernel';

/**
 * L4 Domain service contract for evaluating entity/backdrop depth in the application universe.
 */
export interface IDomainDepthPolicyService {
  evaluateDomainDepth(
    frameId: number,
    dt: number,
    elapsedMs: number
  ): readonly DomainDepthFactDTO[];
}

/**
 * Default no-op L4 Domain Depth Policy Service provided by the engine.
 * Applications with dynamic world depth / multi-layer sorting override this token
 * via a custom `L4DomainServiceRegistrar`.
 */
export class DefaultDomainDepthPolicyService
  implements IDomainDepthPolicyService
{
  constructor(private readonly boundaryPort: IL4ToL3BoundaryPort) {}

  public evaluateDomainDepth(
    _frameId: number,
    _dt: number,
    _elapsedMs: number
  ): readonly DomainDepthFactDTO[] {
    const empty: readonly DomainDepthFactDTO[] = [];
    this.boundaryPort.publishDomainDepthFacts(empty);
    return empty;
  }
}
