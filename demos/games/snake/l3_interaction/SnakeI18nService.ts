import { I18nManager, createServiceToken } from '../../../../engine';
import en from '../locales/en.json';
import pl from '../locales/pl.json';

export type SupportedLocale = 'pl' | 'en';
export type StringId = keyof typeof pl;

export const LOCALE_ASSETS: Record<SupportedLocale, Record<StringId, string>> = {
  pl,
  en,
};

export function createGameI18n(
  initialLocale: SupportedLocale = 'en'
): I18nManager<SupportedLocale, StringId> {
  return new I18nManager<SupportedLocale, StringId>(
    LOCALE_ASSETS,
    initialLocale
  );
}

export interface ISnakeI18nService {
  getI18n(): I18nManager<SupportedLocale, StringId>;
}

export const SNAKE_L3_TOKENS = {
  I18nService: createServiceToken<ISnakeI18nService, 'L3_INTERACTION'>(
    'L3_INTERACTION',
    'snake.l3.i18n_service',
    'Provides localized strings and locale switching for Snake UI interactions.'
  ),
} as const;

export class SnakeI18nService implements ISnakeI18nService {
  private readonly i18n: I18nManager<SupportedLocale, StringId>;

  constructor(existingI18n?: I18nManager<SupportedLocale, StringId>) {
    this.i18n = existingI18n ?? createGameI18n('en');
  }

  public getI18n(): I18nManager<SupportedLocale, StringId> {
    return this.i18n;
  }
}
