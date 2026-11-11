export type TranslationDictionary = Record<string, string>;
export type I18nParams = Record<string, string | number>;
export type LocaleChangeListener<L extends string = string> = (locale: L) => void;

/**
 * Universal internationalization manager in the engine layer.
 * Manages locale dictionaries, `{param}` string interpolation, and reactive locale subscriptions.
 */
export class I18nManager<
  L extends string = string,
  K extends string = string,
> {
  private readonly dictionaries: Record<L, Record<K, string>>;
  private currentLocale: L;
  private readonly listeners = new Set<LocaleChangeListener<L>>();

  constructor(
    dictionaries: Record<L, Record<K, string>>,
    initialLocale: L
  ) {
    this.dictionaries = dictionaries;
    this.currentLocale = initialLocale in dictionaries
      ? initialLocale
      : (Object.keys(dictionaries)[0] as L);
    this.syncDocumentLang();
  }

  /**
   * Resolves a translated string by its `id` and optional `{key}` interpolation parameters.
   */
  public t(id: K, params?: I18nParams): string {
    const dict = this.dictionaries[this.currentLocale];
    const template = dict?.[id] ?? String(id);

    if (!params) {
      return template;
    }

    return template.replace(/\{(\w+)\}/g, (_, token: string) => {
      const value = params[token];
      return value !== undefined ? String(value) : `{${token}}`;
    });
  }

  public getLocale(): L {
    return this.currentLocale;
  }

  public setLocale(locale: L): void {
    if (!(locale in this.dictionaries) || locale === this.currentLocale) {
      return;
    }
    this.currentLocale = locale;
    this.syncDocumentLang();
    for (const listener of this.listeners) {
      listener(this.currentLocale);
    }
  }

  public subscribe(listener: LocaleChangeListener<L>): () => void {
    this.listeners.add(listener);
    listener(this.currentLocale);
    return () => this.listeners.delete(listener);
  }

  /**
   * Translates DOM elements bearing `data-i18n`, `data-i18n-title`, or `data-i18n-aria-label` attributes.
   */
  public translateDOM(root: ParentNode = document): void {
    const textElements = root.querySelectorAll<HTMLElement>('[data-i18n]');
    textElements.forEach((el) => {
      const key = el.dataset.i18n as K | undefined;
      if (key) {
        el.textContent = this.t(key);
      }
    });

    const titleElements = root.querySelectorAll<HTMLElement>('[data-i18n-title]');
    titleElements.forEach((el) => {
      const key = el.dataset.i18nTitle as K | undefined;
      if (key) {
        el.title = this.t(key);
      }
    });

    const ariaElements = root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]');
    ariaElements.forEach((el) => {
      const key = el.dataset.i18nAriaLabel as K | undefined;
      if (key) {
        el.setAttribute('aria-label', this.t(key));
      }
    });
  }

  private syncDocumentLang(): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.currentLocale;
    }
  }
}
