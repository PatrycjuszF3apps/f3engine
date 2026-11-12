import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  compileBdfFont,
  compileSfntBitmapFont,
  validateFontLocaleCoverage,
} from '../engine/VirtualFontCompiler.ts';
import type { VirtualFontSpec } from '../engine/VirtualFont.ts';

interface CliArgs {
  input: string;
  output: string;
  id: string;
  name: string;
  exportName?: string;
  author?: string;
  license?: string;
  locales: string[];
  scanLocalesDir?: string;
  trimHorizontal: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        map.set(key, next);
        i++;
      } else {
        map.set(key, 'true');
      }
    }
  }

  const input = map.get('input') ?? '';
  const output = map.get('output') ?? '';
  const id = map.get('id') ?? path.basename(input, path.extname(input)).toLowerCase();
  const name = map.get('name') ?? id;

  if (!input || !output) {
    console.error(
      'Usage: npm run compile-font -- --input <path.otb|path.ttf|path.bdf> --output <out.vfont.json|out.ts> --id <font-id> --name "<Font Name>" [--locales en,pl,de,cs,fi] [--scan-locales <dir>] [--export-name <CONST_NAME>] [--import-path <virtual-font-import>]'
    );
    process.exit(1);
  }

  const rawLocales = map.get('locales') ?? 'en,pl,de,cs,fi,ui';
  const locales = rawLocales
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    input,
    output,
    id,
    name,
    exportName: map.get('export-name'),
    author: map.get('author'),
    license: map.get('license'),
    locales,
    scanLocalesDir: map.get('scan-locales'),
    trimHorizontal: map.get('trim-horizontal') !== 'false',
  };
}

function loadLocaleDictionaries(dirPath?: string): Array<Record<string, string>> {
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  const dicts: Array<Record<string, string>> = [];
  for (const entry of fs.readdirSync(dirPath)) {
    if (entry.endsWith('.json')) {
      const fullPath = path.join(dirPath, entry);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Record<
        string,
        string
      >;
      dicts.push(parsed);
    }
  }
  return dicts;
}

function formatAsTypeScriptModule(
  spec: VirtualFontSpec,
  exportName: string,
  importPath: string
): string {
  return `import type { VirtualFontSpec } from '${importPath}';\n\nexport const ${exportName}: VirtualFontSpec = ${JSON.stringify(spec, null, 2)};\n`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const importPathIdx = process.argv.indexOf('--import-path');
  const importPath =
    importPathIdx !== -1 && process.argv[importPathIdx + 1]
      ? process.argv[importPathIdx + 1]
      : '../VirtualFont';

  const dictionaries = loadLocaleDictionaries(args.scanLocalesDir);
  const ext = path.extname(args.input).toLowerCase();

  let spec: VirtualFontSpec;
  if (ext === '.bdf') {
    const content = fs.readFileSync(args.input, 'utf8');
    spec = compileBdfFont(content, {
      id: args.id,
      name: args.name,
      author: args.author,
      license: args.license,
      locales: args.locales,
      localeDictionaries: dictionaries,
      trimHorizontal: args.trimHorizontal,
      synthesizeMissingDiacritics: true,
    });
  } else {
    const buffer = new Uint8Array(fs.readFileSync(args.input));
    spec = compileSfntBitmapFont(buffer, {
      id: args.id,
      name: args.name,
      author: args.author,
      license: args.license,
      locales: args.locales,
      localeDictionaries: dictionaries,
      trimHorizontal: args.trimHorizontal,
      synthesizeMissingDiacritics: true,
    });
  }

  if (dictionaries.length > 0) {
    const coverage = validateFontLocaleCoverage(spec, dictionaries);
    if (!coverage.covered) {
      console.warn(
        `[compile-font] Warning: Font "${spec.id}" is missing ${coverage.missingChars.length} characters from scanned locales: ${JSON.stringify(coverage.missingChars)}`
      );
    } else {
      console.log(
        `[compile-font] Verified 100% locale coverage (${coverage.totalUniqueChars} unique chars) for "${spec.id}".`
      );
    }
  }

  const outDir = path.dirname(args.output);
  fs.mkdirSync(outDir, { recursive: true });

  if (args.output.endsWith('.ts')) {
    const exportName =
      args.exportName ??
      `${args.id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_FONT`;
    fs.writeFileSync(
      args.output,
      formatAsTypeScriptModule(spec, exportName, importPath),
      'utf8'
    );
  } else {
    fs.writeFileSync(args.output, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  }

  console.log(
    `[compile-font] Compiled "${spec.name}" (${spec.id}, ${spec.baseWidth}x${spec.baseHeight}, ${Object.keys(spec.glyphs).length} glyphs) -> ${args.output}`
  );
}

main();
