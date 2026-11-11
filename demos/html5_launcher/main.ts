import './style.css';
import { DebugToolbar } from '../../degub_bar';
import { DEMO_CATALOG, type DemoDefinition } from './demoRegistry';
import { type DemoSession, type StringId, type SupportedLocale } from '../games/snake';

const appEl = document.querySelector<HTMLElement>('#app')!;
const debugToolbarEl = document.querySelector<HTMLElement>('#debug-toolbar')!;

let activeSession: DemoSession | null = null;
let debugToolbar: DebugToolbar<SupportedLocale, StringId> | null = null;

function getDemoById(id: string): DemoDefinition {
  return DEMO_CATALOG.find((d) => d.id === id) ?? DEMO_CATALOG[0];
}

/**
 * Mounts or resets the engine with the selected demo game and binds its hooks to the Debug Toolbar.
 */
function launchDemo(demoId: string): void {
  if (activeSession) {
    activeSession.dispose();
    activeSession = null;
  }

  appEl.innerHTML = '';
  const definition = getDemoById(demoId);
  activeSession = definition.mount(appEl);

  const demoOptions = DEMO_CATALOG.map((d) => ({
    id: d.id,
    label: d.label,
  }));

  if (!debugToolbar) {
    debugToolbar = new DebugToolbar<SupportedLocale, StringId>({
      container: debugToolbarEl,
      hooks: activeSession.hooks,
      i18n: activeSession.i18n,
      demos: demoOptions,
      activeDemoId: definition.id,
      onSelectDemo: (nextId) => {
        launchDemo(nextId);
      },
      onResetDemo: () => {
        if (activeSession) {
          launchDemo(activeSession.id);
        }
      },
      labelKeys: {
        title: 'debug.title',
        demoSelect: 'debug.demo_select',
        demoReset: 'debug.demo_reset',
        aspectRatio: 'debug.aspect_ratio',
        aspect43Portrait: 'debug.aspect_43_portrait',
        aspect43Horizontal: 'debug.aspect_43_horizontal',
        aspect169Portrait: 'debug.aspect_169_portrait',
        aspect169Horizontal: 'debug.aspect_169_horizontal',
        aspectCustom: 'debug.aspect_custom',
        virtualGrid: 'debug.virtual_grid',
        windowScale: 'debug.window_scale',
        lockAspect: 'debug.lock_aspect',
        uiScale: 'debug.ui_scale',
        uiScaleAuto: 'debug.ui_scale_auto',
        renderer: 'debug.renderer',
        palette: 'debug.palette',
        cursorInspect: 'debug.cursor_inspect',
        cursorCoords: 'debug.cursor_coords',
        cursorOutside: 'debug.cursor_outside',
        reset: 'debug.reset',
        physicalInfo: 'debug.physical_info',
      },
    });
  } else {
    debugToolbar.bindEngine(
      activeSession.hooks,
      activeSession.i18n,
      definition.id,
      demoOptions
    );
  }
}

// Start with the default demo from the catalog
launchDemo(DEMO_CATALOG[0].id);
