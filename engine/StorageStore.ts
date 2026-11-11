export type StoreListener<T> = (state: T) => void;

/**
 * Generic typed state manager backed by localStorage.
 * Can be used by any demo or game to persist settings, high scores, or session state.
 */
export class StorageStore<T extends Record<string, unknown>> {
  private readonly storageKey: string;
  private state: T;
  private readonly listeners = new Set<StoreListener<T>>();

  constructor(storageKey: string, defaultState: T) {
    this.storageKey = storageKey;
    this.state = this.load(defaultState);
  }

  public get(): Readonly<T> {
    return this.state;
  }

  public set(partial: Partial<T>): void {
    this.state = { ...this.state, ...partial };
    this.save();
    this.notify();
  }

  public subscribe(listener: StoreListener<T>): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private load(defaultState: T): T {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw) as Partial<T>;
      return { ...defaultState, ...parsed };
    } catch {
      return { ...defaultState };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      // Ignore storage access errors (e.g. private browsing mode or quota limits)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
