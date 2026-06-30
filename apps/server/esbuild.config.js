import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

/**
 * Bundle the server to a single ESM file. Workspace code (@tabletop/shared) is
 * bundled in so it resolves at runtime without TS sources; real npm dependencies
 * (incl. native ones like argon2 and @prisma/client) stay external and are
 * provided by node_modules in the runtime image.
 */
const external = Object.keys(pkg.dependencies ?? {}).filter((d) => d !== '@tabletop/shared');

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/server.js',
  sourcemap: true,
  external,
  banner: {
    // Allow `createRequire`-based CJS interop inside the ESM bundle if needed.
    js: "import { createRequire as _cr } from 'node:module'; const require = _cr(import.meta.url);",
  },
});
