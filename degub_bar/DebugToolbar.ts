import {
  EngineDebugHooks,
  I18nManager,
  RendererBackendType,
  ViewportAspectRatio,
  VirtualViewportState,
} from '../engine';

export interface DebugToolbarLabels {
  title: string;
  demoSelect?: string;
  demoReset?: string;
  versionInfo?: string;
  versionCompatible?: string;
  versionMismatch?: string;
  versionTooltip?: string;
  aspectRatio: string;
  aspect43Portrait: string;
  aspect43Horizontal: string;
  aspect169Portrait: string;
  aspect169Horizontal: string;
  aspectCustom: string;
  virtualGrid: string;
  windowScale: string;
  lockAspect: string;
  uiScale: string;
  uiScaleAuto: string;
  renderer: string;
  palette: string;
  cursorInspect: string;
  cursorCoords: string;
  cursorOutside: string;
  reset: string;
  physicalInfo: string;
}

export interface DebugToolbarDemoOption {
  id: string;
  label: string;
}

export interface DebugToolbarConfig<
  L extends string = string,
  K extends string = string,
> {
  container: HTMLElement;
  hooks: EngineDebugHooks;
  i18n: I18nManager<L, K>;
  labelKeys: Record<keyof DebugToolbarLabels, K>;
  demos?: DebugToolbarDemoOption[];
  activeDemoId?: string;
  onSelectDemo?: (demoId: string) => void;
  onResetDemo?: () => void;
}

/**
 * Standalone HTML Debug Toolbar module (`degub_bar`).
 * Communicates with the engine exclusively through `EngineDebugHooks`.
 * The engine remains completely unaware of the Debug Bar's HTML or DOM structure.
 * Also supports switching and resetting active demos when mounted inside the HTML5 Launcher.
 */
export class DebugToolbar<
  L extends string = string,
  K extends string = string,
> {
  private readonly container: HTMLElement;
  private hooks: EngineDebugHooks;
  private i18n: I18nManager<L, K>;
  private readonly labelKeys: Record<keyof DebugToolbarLabels, K>;
  private demos: DebugToolbarDemoOption[];
  private activeDemoId: string;
  private readonly onSelectDemo?: (demoId: string) => void;
  private readonly onResetDemo?: () => void;

  private unsubscribeHooks: (() => void) | null = null;
  private unsubscribeI18n: (() => void) | null = null;

  private demoSelectEl: HTMLSelectElement | null = null;
  private demoResetBtnEl: HTMLButtonElement | null = null;
  private aspectSelect!: HTMLSelectElement;
  private widthInput!: HTMLInputElement;
  private heightInput!: HTMLInputElement;
  private scaleRange!: HTMLInputElement;
  private scaleValueEl!: HTMLElement;
  private lockCheckbox!: HTMLInputElement;
  private uiScaleSelect!: HTMLSelectElement;
  private rendererSelect!: HTMLSelectElement;
  private cursorInspectCheckbox!: HTMLInputElement;
  private cursorCoordsEl!: HTMLElement;
  private versionInfoEl!: HTMLElement;
  private physicalInfoEl!: HTMLElement;
  private paletteSwatchesEl!: HTMLElement;

  constructor(config: DebugToolbarConfig<L, K>) {
    this.container = config.container;
    this.hooks = config.hooks;
    this.i18n = config.i18n;
    this.labelKeys = config.labelKeys;
    this.demos = config.demos ?? [];
    this.activeDemoId = config.activeDemoId ?? (this.demos[0]?.id ?? '');
    this.onSelectDemo = config.onSelectDemo;
    this.onResetDemo = config.onResetDemo;

    this.buildDOM();
    this.bindSubscriptions();
  }

  /**
   * Rebinds the Debug Toolbar to a newly initialized engine instance (e.g., when switching or resetting demos).
   */
  public bindEngine(
    hooks: EngineDebugHooks,
    i18n?: I18nManager<L, K>,
    activeDemoId?: string,
    demos?: DebugToolbarDemoOption[]
  ): void {
    this.unsubscribeHooks?.();
    this.unsubscribeI18n?.();

    this.hooks = hooks;
    if (i18n) {
      this.i18n = i18n;
    }
    if (activeDemoId !== undefined) {
      this.activeDemoId = activeDemoId;
    }
    if (demos !== undefined) {
      this.demos = demos;
    }

    this.buildDOM();
    this.bindSubscriptions();
  }

  public dispose(): void {
    this.unsubscribeHooks?.();
    this.unsubscribeI18n?.();
    this.unsubscribeHooks = null;
    this.unsubscribeI18n = null;
    this.container.innerHTML = '';
  }

  private bindSubscriptions(): void {
    this.unsubscribeHooks = this.hooks.subscribe((state) =>
      this.syncFromEngine(state)
    );
    this.unsubscribeI18n = this.i18n.subscribe(() => {
      this.buildDOM();
      this.syncFromEngine(this.hooks.getState());
    });
  }

  private t(
    key: keyof DebugToolbarLabels,
    params?: Record<string, string | number>
  ): string {
    const id = this.labelKeys[key];
    if (!id) return String(key);
    return this.i18n.t(id, params);
  }

  private buildDOM(): void {
    const state = this.hooks.getState();

    const demoSelectorMarkup =
      this.demos.length > 0
        ? `
          <div class="debug-field debug-demo-switcher">
            <span class="debug-label">${this.t('demoSelect')}</span>
            <div class="debug-inline-group">
              <select id="debug-demo-select" class="debug-select debug-demo-select" aria-label="Select Demo">
                ${this.demos
                  .map(
                    (d) =>
                      `<option value="${d.id}" ${d.id === this.activeDemoId ? 'selected' : ''}>${d.label}</option>`
                  )
                  .join('')}
              </select>
              <button id="debug-demo-reset-btn" type="button" class="debug-mini-btn debug-demo-reset-btn">
                ${this.t('demoReset')}
              </button>
            </div>
          </div>
        `
        : '';

    this.container.innerHTML = `
      <div class="debug-toolbar-inner">
        <div class="debug-brand">
          <span class="debug-led"></span>
          <span class="debug-title">${this.t('title')}</span>
          <span id="debug-version-info" class="debug-readout debug-version-readout"></span>
          <span id="debug-physical-info" class="debug-readout"></span>
        </div>

        <div class="debug-controls">
          ${demoSelectorMarkup}

          <label class="debug-field">
            <span class="debug-label">${this.t('aspectRatio')}</span>
            <select id="debug-aspect" class="debug-select">
              <option value="4:3-portrait">${this.t('aspect43Portrait')}</option>
              <option value="4:3-horizontal">${this.t('aspect43Horizontal')}</option>
              <option value="16:9-portrait">${this.t('aspect169Portrait')}</option>
              <option value="16:9-horizontal">${this.t('aspect169Horizontal')}</option>
              <option value="custom">${this.t('aspectCustom')}</option>
            </select>
          </label>

          <div class="debug-field">
            <span class="debug-label">${this.t('virtualGrid')}</span>
            <div class="debug-inline-group">
              <input
                id="debug-virtual-width"
                type="number"
                class="debug-number"
                min="160"
                max="1280"
                step="10"
                value="${state.virtualWidth}"
                aria-label="Virtual Width"
              />
              <span class="debug-sep">×</span>
              <input
                id="debug-virtual-height"
                type="number"
                class="debug-number"
                min="160"
                max="1280"
                step="10"
                value="${state.virtualHeight}"
                aria-label="Virtual Height"
              />
              <div class="debug-presets">
                <button type="button" class="debug-mini-btn" data-vwidth="240">240w</button>
                <button type="button" class="debug-mini-btn" data-vwidth="300">300w</button>
                <button type="button" class="debug-mini-btn" data-vwidth="360">360w</button>
                <button type="button" class="debug-mini-btn" data-vwidth="480">480w</button>
              </div>
            </div>
          </div>

          <div class="debug-field">
            <span class="debug-label">
              ${this.t('windowScale')}: <strong id="debug-scale-val">${state.windowScalePercent}%</strong>
            </span>
            <div class="debug-inline-group">
              <input
                id="debug-window-scale"
                type="range"
                class="debug-range"
                min="25"
                max="100"
                step="5"
                value="${state.windowScalePercent}"
              />
              <label class="debug-checkbox-label">
                <input
                  id="debug-lock-aspect"
                  type="checkbox"
                  ${state.lockAspectRatio ? 'checked' : ''}
                />
                <span>${this.t('lockAspect')}</span>
              </label>
            </div>
          </div>

          <label class="debug-field">
            <span class="debug-label">${this.t('uiScale')}</span>
            <select id="debug-ui-scale" class="debug-select">
              <option value="auto">${this.t('uiScaleAuto')}</option>
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>
          </label>

          <label class="debug-field">
            <span class="debug-label">${this.t('renderer')}</span>
            <select id="debug-renderer" class="debug-select">
              <option value="canvas2d">Canvas 2D</option>
              <option value="webgl">WebGL</option>
            </select>
          </label>

          <div class="debug-field">
            <span class="debug-label">${this.t('palette')}</span>
            <div id="debug-palette-swatches" class="debug-swatches"></div>
          </div>

          <div class="debug-field">
            <label class="debug-checkbox-label">
              <input
                id="debug-cursor-inspect"
                type="checkbox"
                ${state.cursorInspectorEnabled ? 'checked' : ''}
              />
              <span>${this.t('cursorInspect')}</span>
            </label>
            <span
              id="debug-cursor-coords"
              class="debug-readout debug-cursor-readout${state.cursorInspectorEnabled ? ' active' : ''}"
            >${
              state.cursorPosition
                ? this.t('cursorCoords', {
                    x: state.cursorPosition.vx,
                    y: state.cursorPosition.vy,
                  })
                : this.t('cursorOutside')
            }</span>
          </div>

          <button id="debug-reset-btn" type="button" class="debug-reset-btn">
            ${this.t('reset')}
          </button>
        </div>
      </div>
    `;

    this.demoSelectEl =
      this.container.querySelector<HTMLSelectElement>('#debug-demo-select');
    this.demoResetBtnEl = this.container.querySelector<HTMLButtonElement>(
      '#debug-demo-reset-btn'
    );
    this.aspectSelect =
      this.container.querySelector<HTMLSelectElement>('#debug-aspect')!;
    this.widthInput = this.container.querySelector<HTMLInputElement>(
      '#debug-virtual-width'
    )!;
    this.heightInput = this.container.querySelector<HTMLInputElement>(
      '#debug-virtual-height'
    )!;
    this.scaleRange = this.container.querySelector<HTMLInputElement>(
      '#debug-window-scale'
    )!;
    this.scaleValueEl =
      this.container.querySelector<HTMLElement>('#debug-scale-val')!;
    this.lockCheckbox =
      this.container.querySelector<HTMLInputElement>('#debug-lock-aspect')!;
    this.uiScaleSelect =
      this.container.querySelector<HTMLSelectElement>('#debug-ui-scale')!;
    this.rendererSelect =
      this.container.querySelector<HTMLSelectElement>('#debug-renderer')!;
    this.cursorInspectCheckbox = this.container.querySelector<HTMLInputElement>(
      '#debug-cursor-inspect'
    )!;
    this.cursorCoordsEl = this.container.querySelector<HTMLElement>(
      '#debug-cursor-coords'
    )!;
    this.versionInfoEl = this.container.querySelector<HTMLElement>(
      '#debug-version-info'
    )!;
    this.physicalInfoEl = this.container.querySelector<HTMLElement>(
      '#debug-physical-info'
    )!;
    this.paletteSwatchesEl = this.container.querySelector<HTMLElement>(
      '#debug-palette-swatches'
    )!;

    if (this.demoSelectEl) {
      this.demoSelectEl.addEventListener('change', () => {
        const nextDemoId = this.demoSelectEl!.value;
        this.activeDemoId = nextDemoId;
        this.onSelectDemo?.(nextDemoId);
      });
    }

    if (this.demoResetBtnEl) {
      this.demoResetBtnEl.addEventListener('click', () => {
        this.onResetDemo?.();
      });
    }

    this.aspectSelect.addEventListener('change', () => {
      const nextAspect = this.aspectSelect.value as ViewportAspectRatio;
      this.hooks.setVirtualGrid(
        Number(this.widthInput.value) || 300,
        nextAspect,
        Number(this.heightInput.value) || 400
      );
    });

    this.widthInput.addEventListener('change', () => {
      const nextW = Number(this.widthInput.value) || 300;
      const currentAspect = this.aspectSelect.value as ViewportAspectRatio;
      this.hooks.setVirtualGrid(
        nextW,
        currentAspect,
        Number(this.heightInput.value) || 400
      );
    });

    this.heightInput.addEventListener('change', () => {
      const nextW = Number(this.widthInput.value) || 300;
      const nextH = Number(this.heightInput.value) || 400;
      this.hooks.setVirtualGrid(nextW, 'custom', nextH);
    });

    const presetButtons =
      this.container.querySelectorAll<HTMLButtonElement>('[data-vwidth]');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = Number(btn.dataset.vwidth);
        if (!w) return;
        const currentState = this.hooks.getState();
        const aspect =
          currentState.aspectRatio === 'custom'
            ? '4:3-portrait'
            : currentState.aspectRatio;
        this.hooks.setVirtualGrid(w, aspect);
      });
    });

    this.scaleRange.addEventListener('input', () => {
      const val = Number(this.scaleRange.value) || 50;
      this.hooks.setPhysicalScaling(val, this.lockCheckbox.checked);
    });

    this.lockCheckbox.addEventListener('change', () => {
      const val = Number(this.scaleRange.value) || 50;
      this.hooks.setPhysicalScaling(val, this.lockCheckbox.checked);
    });

    this.uiScaleSelect.addEventListener('change', () => {
      const raw = this.uiScaleSelect.value;
      this.hooks.setUIScaleOverride(raw === 'auto' ? null : Number(raw));
    });

    this.rendererSelect.addEventListener('change', () => {
      const backendType = this.rendererSelect.value as RendererBackendType;
      this.hooks.setRendererBackend(backendType);
    });

    this.cursorInspectCheckbox.addEventListener('change', () => {
      this.hooks.setCursorInspectorEnabled(this.cursorInspectCheckbox.checked);
    });

    const resetBtn =
      this.container.querySelector<HTMLButtonElement>('#debug-reset-btn')!;
    resetBtn.addEventListener('click', () => {
      this.hooks.resetToDefaults();
    });

    // Trigger physical layout recalculation after toolbar DOM is mounted
    this.hooks.updatePhysicalSize();
  }

  private syncFromEngine(state: VirtualViewportState): void {
    if (!this.aspectSelect) return;

    if (this.demoSelectEl && this.demoSelectEl.value !== this.activeDemoId) {
      this.demoSelectEl.value = this.activeDemoId;
    }

    this.aspectSelect.value = state.aspectRatio;
    this.widthInput.value = String(state.virtualWidth);
    this.heightInput.value = String(state.virtualHeight);
    this.scaleRange.value = String(state.windowScalePercent);
    this.scaleValueEl.textContent = `${state.windowScalePercent}%`;
    this.lockCheckbox.checked = state.lockAspectRatio;
    this.uiScaleSelect.value =
      state.uiScaleOverride === null ? 'auto' : String(state.uiScaleOverride);
    this.rendererSelect.value = state.backendType;
    this.cursorInspectCheckbox.checked = state.cursorInspectorEnabled;
    this.cursorCoordsEl.classList.toggle('active', state.cursorInspectorEnabled);
    this.cursorCoordsEl.textContent = state.cursorPosition
      ? this.t('cursorCoords', {
          x: state.cursorPosition.vx,
          y: state.cursorPosition.vy,
        })
      : this.t('cursorOutside');

    const statusLabel = state.versionCheck.compatible
      ? this.t('versionCompatible')
      : this.t('versionMismatch');
    this.versionInfoEl.textContent = this.t('versionInfo', {
      engine: state.versionCheck.engineVersion,
      manifest: state.versionCheck.manifestEngineVersion,
      status: statusLabel,
    });
    this.versionInfoEl.classList.toggle(
      'compatible',
      state.versionCheck.compatible
    );
    this.versionInfoEl.classList.toggle(
      'mismatch',
      !state.versionCheck.compatible
    );
    if (this.labelKeys.versionTooltip) {
      this.versionInfoEl.title = this.t('versionTooltip', {
        app: state.appManifest?.name ?? 'Unknown',
        appVersion: state.appManifest?.version ?? 'n/a',
        engine: state.versionCheck.engineVersion,
        manifest: state.versionCheck.manifestEngineVersion,
      });
    }

    this.physicalInfoEl.textContent = this.t('physicalInfo', {
      vw: state.virtualWidth,
      vh: state.virtualHeight,
      pw: state.physicalWidth,
      ph: state.physicalHeight,
    });

    // Refresh color swatches from the declared palette exposed in EngineDebugHooks state
    this.paletteSwatchesEl.innerHTML = state.paletteEntries
      .map(
        (entry) =>
          `<span class="debug-swatch" style="background:${entry.hex}" title="#${entry.index} ${entry.token}: ${entry.hex}"></span>`
      )
      .join('');
  }
}
