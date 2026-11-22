import { I18nManager, createServiceToken } from '../../../../engine';
import en from '../locales/en.json';
import pl from '../locales/pl.json';

export type SupportedLocale = 'pl' | 'en';
export type LayersStringId = keyof typeof pl;

export const LAYERS_LOCALE_ASSETS: Record<
  SupportedLocale,
  Record<LayersStringId, string>
> = {
  pl,
  en,
};

export function createLayersI18n(
  initialLocale: SupportedLocale = 'en'
): I18nManager<SupportedLocale, LayersStringId> {
  return new I18nManager<SupportedLocale, LayersStringId>(
    LAYERS_LOCALE_ASSETS,
    initialLocale
  );
}

export interface ILayersI18nService {
  getI18n(): I18nManager<SupportedLocale, LayersStringId>;
}

export const LAYERS_L3_I18N_TOKEN = createServiceToken<
  ILayersI18nService,
  'L3_INTERACTION'
>(
  'L3_INTERACTION',
  'layers.l3.i18n_service',
  'Provides localized strings for the Layer Compositor demo.'
);

export class LayersI18nService implements ILayersI18nService {
  private readonly i18n: I18nManager<SupportedLocale, LayersStringId>;

  constructor(existing?: I18nManager<SupportedLocale, LayersStringId>) {
    this.i18n = existing ?? createLayersI18n('en');
  }

  public getI18n(): I18nManager<SupportedLocale, LayersStringId> {
    return this.i18n;
  }
}
