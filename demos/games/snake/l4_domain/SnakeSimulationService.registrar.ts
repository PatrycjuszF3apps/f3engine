import { L4DomainServiceRegistrar } from '../../../../engine';
import {
  ISnakeSimulationService,
  SNAKE_L4_TOKENS,
  SnakeSimulationService,
} from './SnakeSimulationService';

/**
 * Shadow Service Registrar (`*.registrar.ts`) for `SnakeSimulationService` in L4 (Domain).
 */
export class SnakeSimulationServiceRegistrar extends L4DomainServiceRegistrar<ISnakeSimulationService> {
  public readonly provides = SNAKE_L4_TOKENS.SimulationService;
  public readonly inject = [] as const;

  public createInstance(): ISnakeSimulationService {
    return new SnakeSimulationService();
  }
}
