import { type AppManifest } from '../../engine';
import { LAYERS_MANIFEST, mountLayersDemo } from '../games/layers';
import {
  SNAKE_MANIFEST,
  mountSnakeDemo,
  type DemoSession,
} from '../games/snake';

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
      'Classic 20×20 arcade Snake structured on the 4-layer DDD service architecture.',
    manifest: SNAKE_MANIFEST,
    mount: mountSnakeDemo,
  },
  {
    id: LAYERS_MANIFEST.id,
    label: LAYERS_MANIFEST.name,
    description:
      LAYERS_MANIFEST.description ??
      'Multi-node animated backdrops and real-time Z-Index child sorting via 4-layer DDD service registrars.',
    manifest: LAYERS_MANIFEST,
    mount: mountLayersDemo,
  },
];
