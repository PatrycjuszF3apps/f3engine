import { L1InfrastructureServiceRegistrar, StorageStore } from '../../../../engine';
import {
  ISnakeSettingsRepository,
  SNAKE_L1_TOKENS,
  SnakePersistedState,
  SnakeSettingsRepository,
} from './SnakeSettingsRepository';

/**
 * Shadow Service Registrar (`*.registrar.ts`) for `SnakeSettingsRepository` in L1 (Infrastructure).
 */
export class SnakeSettingsRepositoryRegistrar extends L1InfrastructureServiceRegistrar<ISnakeSettingsRepository> {
  public readonly provides = SNAKE_L1_TOKENS.SettingsRepository;
  public readonly inject = [] as const;

  constructor(
    private readonly preboundStore?: StorageStore<SnakePersistedState>
  ) {
    super();
  }

  public createInstance(): ISnakeSettingsRepository {
    return new SnakeSettingsRepository(this.preboundStore);
  }
}
