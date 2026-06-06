import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import morpheusResourcePlugin from './src/renderer/morpheus/vite/morpheusResourcePlugin.js'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.js') }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.js') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: [
        // @morphBuild — dev-only stub. Morpheus.jsx does
        // `await import('@morphBuild/NodeResourceProvider')` inside `if (IS_PROD)` —
        // dead code in dev, but Vite's import-analysis still resolves it statically.
        // Regex form is required because the import has a subpath after the alias —
        // a bare-string alias would produce 'devAppEntry.prod.js/NodeResourceProvider'
        // (file + subpath = missing). The regex replaces the whole specifier with the
        // empty stub that already ships in the framework.
        //
        // Replace with the real morphBuild-03 path once the prod build pipeline is fixed
        // (see notes/morpheus-electron-integration/implementation-plan.md §3.3).
        {
          find: /^@morphBuild\/.*$/,
          replacement: resolve(__dirname, 'src/renderer/morpheus/vite/devAppEntry.prod.js'),
        },
        // @morpheus — root of the framework source tree. Used by the bundled DevApp
        // (e.g. `import '@morpheus/devApp/assets/styles/index.scss'`) and by any
        // morphSrc node that wants to import directly from the framework.
        { find: '@morpheus', replacement: resolve(__dirname, 'src/renderer/morpheus') },
        // @morphSrc — root of the consumer app's morphSrc tree. Mirrors the web-app
        // pattern; lets nodes reference siblings via a stable prefix instead of
        // brittle relative paths.
        { find: '@morphSrc', replacement: resolve(__dirname, 'src/renderer/morphSrc') },
      ],
      extensions: ['.js', '.jsx', '.json'],
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Sass load paths. morpheusResourcePlugin exposes node styles as a virtual
          // module so `@use` directives can't resolve relative to the source file.
          // With morphSrc on the load path, a node that splits its styles into
          // partials references them via a qualified path:
          //   @use 'nodes/SomeNode/styles/tokens';
          loadPaths: [resolve(__dirname, 'src/renderer/morphSrc')],
        },
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    server: {
      watch: {
        // The diagnostics directory lives inside the Vite root (`src/renderer/`)
        // because morpheusResourcePlugin writes there via `POST /__morpheus_state`.
        // Every node mount writes ~5 JSON snapshot files; mounting a deeper subtree
        // (e.g. clicking the DevApp's App Inspector tab) writes dozens in a burst.
        // Without this ignore, chokidar fires file-add events that cascade into
        // HMR processing and ultimately a full reload, which closes the DevApp panel
        // (its `showUI` signal resets to default false on reload).
        ignored: ['**/diagnostics/**'],
      },
    },
    plugins: [react(), morpheusResourcePlugin()]
  }
})
