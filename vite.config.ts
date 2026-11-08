import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __MODULE_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/main.ts',
      formats: ['es'],
      fileName: () => 'scripts/main.js',
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'module.json',
          dest: '.',
          transform: (content) => {
            const manifest = JSON.parse(content) as Record<string, unknown>;
            manifest.version = pkg.version;
            return JSON.stringify(manifest, null, 2);
          },
        },
        { src: 'lang/*', dest: 'lang', rename: { stripBase: true } },
        { src: 'src/styles/atlas-foundry.css', dest: 'styles', rename: { stripBase: true } },
      ],
    }),
  ],
});
