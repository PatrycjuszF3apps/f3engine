import { I18nManager, L3InteractionServiceRegistrar } from '../../../../engine';
import {
  ISnakeI18nService,
  SNAKE_L3_TOKENS,
  SnakeI18nService,
  StringId,
  SupportedLocale,
} from './SnakeI18nService';

/**
 * Shadow Service Registrar (`*.registrar.ts`) for `SnakeI18nService` in L3 (Interaction).
 */
export class SnakeI18nServiceRegistrar extends L3InteractionServiceRegistrar<ISnakeI18nService> {
  public readonly provides = SNAKE_L3_TOKENS.I18nService;
  public readonly inject = [] as const;

  constructor(
    private readonly preboundI18n?: I18nManager<SupportedLocale, StringId>
  ) {
    super();
  }

  public createInstance(): ISnakeI18nService {
    return new SnakeI18nService(this.preboundI18n);
  }
}
