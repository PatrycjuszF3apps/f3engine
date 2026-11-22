import { L2RuntimeServiceRegistrar } from '../../di/ServiceRegistrar';
import { IChildOrderService } from './ChildOrderService';
import { DefaultHitTestService, IHitTestService } from './HitTestService';
import { L2_TOKENS } from './L2Tokens';

/**
 * Shadow Service Registrar for `DefaultHitTestService` in L2 (Runtime).
 * Autowires `L2_TOKENS.ChildOrderService`.
 */
export class DefaultHitTestServiceRegistrar extends L2RuntimeServiceRegistrar<
  IHitTestService,
  readonly [typeof L2_TOKENS.ChildOrderService]
> {
  public readonly provides = L2_TOKENS.HitTestService;
  public readonly inject = [L2_TOKENS.ChildOrderService] as const;

  public createInstance(
    childOrderService: IChildOrderService
  ): IHitTestService {
    return new DefaultHitTestService(childOrderService);
  }
}
