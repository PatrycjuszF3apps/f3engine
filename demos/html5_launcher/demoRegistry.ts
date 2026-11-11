import { type AppManifest } from '../../engine';
import {
  SNAKE_MANIFEST,
  mountSnakeDemo,
  type DemoSession,
} from '../games/snake';
import { SNAKE2_MANIFEST, mountSnake2Demo } from '../games/snake2';

export interface DemoDefinition {
  id: string;
  label: string;
  description: string;
  manifest: AppManifest;
  mount: (container: HTMLElement) => DemoSession;
}

/**
 * Registry of playable demos available inside the HTML5 Launcher.
 */
export const DEMO_CATALOG: readonly DemoDefinition[] = [
  {
    id: SNAKE_MANIFEST.id,
    label: SNAKE_MANIFEST.name,
    description:
      SNAKE_MANIFEST.description ??
      'Classic 20×20 arcade Snake with CRT & Nokia 3310 filters.',
    manifest: SNAKE_MANIFEST,
    mount: mountSnakeDemo,
  },
  {
    id: SNAKE2_MANIFEST.id,
    label: SNAKE2_MANIFEST.name,
    description:
      SNAKE2_MANIFEST.description ??
      'Arena variant with obstacle pillars and dual targets.',
    manifest: SNAKE2_MANIFEST,
    mount: mountSnake2Demo,
  },
];
