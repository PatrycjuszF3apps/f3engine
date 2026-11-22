import * as ClassicV1Module from './classic_v1';

/**
 * Versioned out-of-the-box UI Control Kits provided by f3engine.
 *
 * Applications import controls via explicit namespaces (`UIKit.ClassicV1`) so future
 * control collections (e.g., `UIKit.ArcadeV2`, `UIKit.WindowedRpgV1`) can coexist
 * alongside legacy collections without breaking existing applications.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace UIKit {
  export import ClassicV1 = ClassicV1Module;
}

export { ClassicV1Module as ClassicV1 };
export * from './classic_v1';
