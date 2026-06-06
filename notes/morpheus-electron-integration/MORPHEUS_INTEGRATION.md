# Adding Morpheus to Athene

How to integrate the Morpheus meta-framework into Athene's electron-vite renderer process. Dev mode only — production builds are out of scope.

---

## What morpheus expects from its host

The framework has four load-bearing assumptions about the project structure:

1. **`morphSrc/` and `morpheus/` are siblings.** `Morpheus.jsx` does `import mainAppDefinition from '../morphSrc/app'`, and `NodeLevelCompiler.createImportFunction` computes `'../../../morphSrc/...'` from `morpheus/core/node/`. These paths are baked into the framework — they aren't configurable.

2. **The Vite dev server's `config.root` resolves to the directory containing both.** `morpheusResourcePlugin` sets `projectRoot = config.root` and then scans `path.join(projectRoot, 'morphSrc')` for SCSS bundling, autoDiscover manifests, and `/__morpheus_state` writes. In athene's `electron.vite.config.js`, renderer root is `src/renderer`, so morpheus + morphSrc need to live under that.

3. **`morpheusResourcePlugin` must be registered in the renderer's Vite plugin list.** Without it, three things break: `/__morpheus_state` (diagnostics 404s and silently disables), `virtual:morpheus-node-styles` (no SCSS bundling), and `virtual:morpheus/discovered` (autoDiscover degrades to empty).

4. **`globalThis` survives HMR.** Electron renderer has globalThis, so the Morpheus and Diagnostics singletons stash on it as they do in the browser. No change needed.

Since prod builds are out of scope, we can ignore `morpheusProdStripPlugin`, `devAppStubPlugin`, the `@morphBuild` alias's runtime use, and `NodeResourceProvider` entirely.

---

## Source layout decision

- **Approach:** copy morpheus in-tree (no symlink).
- **Placement:** under `src/renderer/`, matching the renderer's Vite root.

After setup, the renderer tree should look like:

```
src/renderer/
├── index.html
├── morpheus/              ← framework (copied in)
│   ├── Morpheus.jsx
│   ├── index.js
│   ├── core/
│   ├── vite/
│   ├── primitives/
│   └── ...
├── morphSrc/              ← your morpheus app
│   ├── app.js
│   └── nodes/
│       └── Home/
│           ├── Home.node.jsx
│           └── HelloWorld.jsx
└── src/
    ├── App.jsx
    └── main.jsx
```

---

## Step 1 — Copy morpheus into athene

```bash
cp -R /Users/daniel/Desktop/install-wp/morpheus \
      /Users/daniel/Desktop/singularity-engine/athene/src/renderer/morpheus
```

---

## Step 2 — Install runtime dependencies

From the athene root:

```bash
npm install nanoid lodash axios lucide-react dexie sass
```

Build-time deps for `morpheusProdStripPlugin` (`@babel/parser`, `@babel/traverse`, `@babel/generator`) are not needed since prod builds are out of scope.

Tailwind is optional — the morpheus docs assume it's available because `install-wp` configures it, but the framework itself doesn't require it. If you want it: `npm install -D tailwindcss postcss autoprefixer` and add `tailwind.config.js` / `postcss.config.js`.

---

## Step 3 — Update `electron.vite.config.js`

The renderer section needs two additions: register `morpheusResourcePlugin`, and stub the `@morphBuild` alias so Rollup can resolve the dev-dead `if (IS_PROD)` branch in `Morpheus.jsx`.

```js
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
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        // Dev-only stub. Morpheus.jsx imports this inside `if (IS_PROD)`,
        // which is dead code in dev — but Rollup still resolves the import
        // graph. Pointing it at an empty module keeps it inert.
        '@morphBuild': resolve(
          __dirname,
          'src/renderer/morpheus/vite/devAppEntry.prod.js'
        ),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    plugins: [
      react(),
      morpheusResourcePlugin(),
    ],
  }
})
```

Notes:

- The `@morphBuild` alias points at morpheus's own `devAppEntry.prod.js` (an empty stub already in the framework) just to keep the resolver happy when Rollup walks the conditional import. The `if (IS_PROD)` branch never executes in dev.
- The renderer `root` already points at `src/renderer`, so `morpheusResourcePlugin` picks up `src/renderer/morphSrc/` as expected.

---

## Step 4 — Create a minimal morphSrc

### `src/renderer/morphSrc/app.js`

```js
export default {
  metaData: {
    appName: 'Athene',
    appDescription: 'Singularity Engine control plane',
  },
  coreData: {
    clientStorageSchemaVersion: '1',
  },
  nodes: {
    Home: { isRoot: true },
  },
}
```

### `src/renderer/morphSrc/nodes/Home/Home.node.jsx`

```jsx
export default {
  modules: {
    HelloWorld: { isRoot: true },
  },
}
```

### `src/renderer/morphSrc/nodes/Home/HelloWorld.jsx`

```jsx
export default function HelloWorld({ _ }) {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Athene + Morpheus</h1>
      <p>App: {_.app.getMetaData('appName')}</p>
    </div>
  )
}
```

---

## Step 5 — Render Morpheus from `main.jsx`

Replace `src/renderer/src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MorpheusGraph } from '../morpheus/index.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MorpheusGraph />
  </StrictMode>
)
```

`src/renderer/src/App.jsx` becomes unused once the morpheus root takes over — delete it or repurpose its IPC ping as a morpheus module under `morphSrc`.

---

## Step 6 — Relax the CSP (dev only)

The current `src/renderer/index.html` CSP is:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

Two things will trip on it the moment you do more than a static render:

- **Vite HMR uses `ws://`.** electron-vite serves the renderer over `http://localhost:5173` in dev, and Vite's client opens a WebSocket back. You need `connect-src 'self' ws: http://localhost:*`.
- **`unsafe-inline` / `unsafe-eval` for scripts** is needed in dev for Vite-injected HMR snippets. CSP violations show up in the console.

A workable dev-mode CSP for `src/renderer/index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*" />
```

Tighten this back when you don't need HMR.

---

## Electron-specific things to know

- **`Router.isHome()` quirk.** Morpheus's router reads `window.location.pathname`. When Electron loads via `loadURL(ELECTRON_RENDERER_URL)` in dev, the path is `/` — so `isHome()` works correctly. If you ever switch to `loadFile`, the path becomes `/index.html` (one segment), and `isHome()` returns false. Not a problem in dev.

- **`sandbox: true` is fine.** Morpheus runs entirely in the renderer with no Node APIs. Your preload's `window.athene.ping()` IPC bridge is orthogonal — morpheus modules can call `window.athene.ping()` directly just like the original `App.jsx`. A cleaner pattern is to expose your IPC surface as an app-kernel trait so modules call `_.app.ipc.ping()` instead, but that's a refactor for later.

- **DevApp loads automatically in dev.** Morpheus's `initializeDevApp()` runs in dev and dynamically imports `./devApp/app` from the framework. It mounts inside `<MorpheusGraph />` next to your app root — visible in DevTools. If you don't want it, either delete `morpheus/devApp/` or add a build flag (not currently exposed; needs a small framework patch).

- **DevTools survives across HMR.** `window.morpheus` and `window.appKernel` are stashed for inspection. After the first run, type those into the DevTools console.

- **`/diagnostics/` directory.** The dev server writes JSON files to `src/renderer/diagnostics/` (because that's the resolved `projectRoot`). Add it to `.gitignore`.

---

## Verification

After `npm run dev`, you should see:

1. Athene window opens, DevTools open.
2. Console shows no morpheus errors.
3. `window.morpheus` and `window.appKernel` are objects.
4. `<h1>Athene + Morpheus</h1>` renders.
5. A `diagnostics/` directory appears at `src/renderer/diagnostics/` with `timeline.json`, `app/compiledAppKernel.json`, `app/nodes/Home/compiledNodeResources.json`, etc.
6. Hot-edit `HelloWorld.jsx` — HMR updates without a full reload, and `timeline.json` grows.

---

## What's deliberately omitted

- **Production build wiring** — `morpheusProdStripPlugin`, `devAppStubPlugin`, the live `@morphBuild` alias, and `NodeResourceProvider`. The current `@morphBuild` alias here points at an empty stub purely to satisfy Rollup's resolver for the dev-dead `if (IS_PROD)` branch in `Morpheus.jsx`.
- **The triple-build CLI** (`cli/v1`, `cli/v2`, `cli/v3`). These produce `morphBuild-XX/` artifacts that only the prod runtime consumes.
- **Tailwind** — optional, not installed by default.
