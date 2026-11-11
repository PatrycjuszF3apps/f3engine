import { mountSnakeDemo, type DemoSession } from '../games/snake';
import { mountSnake2Demo } from '../games/snake2';

export interface DemoDefinition {
  id: string;
  label: string;
  description: string;
  mount: (container: HTMLElement) => DemoSession;
}

/**
 * Registry of playable demos available inside the HTML5 Launcher.
 */
export const DEMO_CATALOG: readonly DemoDefinition[] = [
  {
    id: 'snake',
    label: 'Snake (Classic)',
    description: 'Classic 20×20 arcade Snake with CRT & Nokia 3310 filters.',
    mount: mountSnakeDemo,
  },
  {
    id: 'snake2',
    label: 'Snake 2: Arena',
    description: 'Arena variant with obstacle pillars and dual targets.',
    mount: mountSnake2Demo,
  },
];
