/**
 * Core Engine Version & Application Manifest Contract.
 * Every application/game built on f3engine declares an `AppManifest` specifying
 * the engine version it targets.
 */

export const ENGINE_NAME = 'f3engine';
export const ENGINE_VERSION = '1.1.0';

export interface SemVerParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * Manifest required for every application (game) running on f3engine.
 */
export interface AppManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /**
   * Target engine version that this application is compatible with (e.g. "1.0.0" or "^1.0.0").
   */
  readonly engineVersion: string;
  readonly description?: string;
}

export interface EngineVersionCheckResult {
  readonly engineVersion: string;
  readonly manifestEngineVersion: string;
  readonly compatible: boolean;
}

/**
 * Parses a semantic version string (e.g., "1.0.0", "v1.2.3") into numeric components.
 */
export function parseSemVer(version: string): SemVerParts | null {
  const cleaned = version.trim().replace(/^[vV^~]/, '');
  const match = /^(\d+)\.(\d+)(?:\.(\d+|x|\*))?$/i.exec(cleaned);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const rawPatch = match[3];
  const patch =
    rawPatch === undefined || rawPatch === 'x' || rawPatch === '*'
      ? 0
      : Number(rawPatch);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  return { major, minor, patch };
}

/**
 * Checks whether the runtime engine version satisfies the application's manifest engine version.
 * Supports exact versions ("1.0.0"), caret ranges ("^1.0.0"), tilde ranges ("~1.0.0"), and wildcards ("1.0.x").
 */
export function isEngineVersionCompatible(
  manifestEngineVersion: string,
  runtimeEngineVersion: string = ENGINE_VERSION
): boolean {
  const rawConstraint = manifestEngineVersion.trim();
  if (!rawConstraint) {
    return false;
  }

  const runtime = parseSemVer(runtimeEngineVersion);
  const target = parseSemVer(rawConstraint);

  if (!runtime || !target) {
    return rawConstraint.replace(/^[vV]/, '') === runtimeEngineVersion.replace(/^[vV]/, '');
  }

  if (rawConstraint.startsWith('^')) {
    if (runtime.major !== target.major) return false;
    if (runtime.minor !== target.minor) return runtime.minor > target.minor;
    return runtime.patch >= target.patch;
  }

  if (rawConstraint.startsWith('~')) {
    return (
      runtime.major === target.major &&
      runtime.minor === target.minor &&
      runtime.patch >= target.patch
    );
  }

  if (/\.x$|\.\*$/i.test(rawConstraint)) {
    return runtime.major === target.major && runtime.minor === target.minor;
  }

  return (
    runtime.major === target.major &&
    runtime.minor === target.minor &&
    runtime.patch === target.patch
  );
}

/**
 * Evaluates engine version compatibility against an application manifest.
 */
export function checkEngineVersion(
  manifest: AppManifest | null | undefined,
  runtimeEngineVersion: string = ENGINE_VERSION
): EngineVersionCheckResult {
  const manifestEngineVersion = manifest?.engineVersion?.trim() || 'n/a';
  const compatible = manifest
    ? isEngineVersionCompatible(manifest.engineVersion, runtimeEngineVersion)
    : false;

  return {
    engineVersion: runtimeEngineVersion,
    manifestEngineVersion,
    compatible,
  };
}
