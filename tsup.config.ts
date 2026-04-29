import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/mini-app/index.ts',
    'src/official-account/index.ts',
    'src/pay/index.ts',
    'src/work/index.ts',
    'src/open-platform/index.ts',
    'src/open-work/index.ts',
    'src/channel/index.ts',
    'src/adapters/node/index.ts',
    'src/adapters/astro/index.ts',
    'src/adapters/deno/index.ts'
  ],
  external: ['fast-xml-parser', 'zod'],
  format: ['esm'],
  minify: false,
  outDir: 'dist',
  platform: 'neutral',
  sourcemap: true,
  splitting: true,
  target: 'es2022',
  treeshake: true
});
