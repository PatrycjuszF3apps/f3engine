import { L1InfrastructureServiceRegistrar, StorageStore } from '../../../../engine';
import {
  ILayersSettingsRepository,
  LAYERS_L1_TOKENS,
  LayersPersistedState,
  LayersSettingsRepository,
} from './LayersSettingsRepository';

/**
 * Shadow Service Registrar (`*.registrar.ts`) for `LayersSettingsRepository` in L1 (Infrastructure).
 */
export class LayersSettingsRepositoryRegistrar extends L1InfrastructureServiceRegistrar<ILayersSettingsRepository> {
  public readonly provides = LAYERS_L1_TOKENS.SettingsRepository;
  public readonly inject = [] as const;

  constructor(
    private readonly preboundStore?: StorageStore<LayersPersistedState>
  ) {
    super();
  }

  public createInstance(): ILayersSettingsRepository {
    return new LayersSettingsRepository(this.preboundStore);
  }
}
