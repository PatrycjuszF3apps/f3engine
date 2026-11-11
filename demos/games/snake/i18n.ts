import { I18nManager } from '../../../engine';
import pl from './locales/pl.json';
import en from './locales/en.json';

export type SupportedLocale = 'pl' | 'en';
export type StringId = keyof typeof pl;

export const LOCALE_ASSETS: Record<SupportedLocale, Record<StringId, string>> = {
  pl,
  en,
};

export function createGameI18n(
  initialLocale: SupportedLocale = 'en'
): I18nManager<SupportedLocale, StringId> {
  return new I18nManager<SupportedLocale, StringId>(LOCALE_ASSETS, initialLocale);
}
