import { I18nManager, L3InteractionServiceRegistrar } from '../../../../engine';
import {
  ILayersI18nService,
  LAYERS_L3_I18N_TOKEN,
  LayersI18nService,
  LayersStringId,
  SupportedLocale,
} from './LayersI18nService';

/**
 * Shadow Service Registrar (`*.registrar.ts`) for `LayersI18nService` in L3 (Interaction).
 */
export class LayersI18nServiceRegistrar extends L3InteractionServiceRegistrar<ILayersI18nService> {
  public readonly provides = LAYERS_L3_I18N_TOKEN;
  public readonly inject = [] as const;

  constructor(
    private readonly preboundI18n?: I18nManager<SupportedLocale, LayersStringId>
  ) {
    super();
  }

  public createInstance(): ILayersI18nService {
    return new LayersI18nService(this.preboundI18n);
  }
}
