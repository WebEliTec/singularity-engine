# Morpheus + Electron Integration — Implementation Plan

**Goal:** Run morpheus inside the Athene electron-vite renderer **from the same morpheus source tree the web app uses** — so that future framework work happens in one place, not two.

**Workspace state as of 2026-05-27:**
- **Canonical morpheus source:** `singularity-engine/athene/src/renderer/morpheus/`. This is the up-to-date version going forward.
- `singularity-engine/some-morpheus-based-app/` is demo content only. Its bundled morpheus copy is not a source of truth; it can drift, be deleted, or be re-symlinked at will — no merge work required.
- Existing reference doc: [`MORPHEUS_INTEGRATION.md`](./MORPHEUS_INTEGRATION.md) (dev-only integration walkthrough, written before the canonical-source decision).

---

## 1. Feasibility verdict

**Yes — one shared morpheus source for both web and electron is feasible, with one structural constraint to honor.**

Why it works:
- Morpheus runs entirely in the renderer process. Electron's renderer is Chromium with the same DOM, `fetch`, dynamic-import, IndexedDB, Web Audio, and Web APIs a browser has.
- The framework has zero Electron-specific code, and zero Node-runtime dependencies from the renderer side. All Node-side code (`fs`, `path`, `@babel/*`) lives in the build CLI and the Vite plugin — those run in the dev-server / build-tool process, not in the renderer.
- The Vite plugin architecture is identical across environments. `morpheusResourcePlugin` works the same inside a vanilla `vite.config.js` or an `electron-vite` renderer config — both produce a standard Vite dev server.
- HMR via WebSocket, `globalThis` singletons, `import.meta.env.DEV` — all work in Electron's renderer.

The one structural constraint:
- **`morphSrc/` and `morpheus/` must be siblings of the Vite root.** Baked into two places in the source: `Morpheus.jsx` imports `'../morphSrc/app.js'`, and `NodeLevelCompiler` builds relative paths like `'../../../morphSrc/...'`. Honor this with the directory layout, or patch the framework to accept a configurable path (§6).

What *cannot* be shared:
- The dev-server / build config (`vite.config.js` for a web app, `electron.vite.config.js` for Athene). Each consumer app needs its own — but they consume the same plugin and the same morpheus source.

---

## 2. Strategy: one morpheus, many consumers

### 2.1 Recommended layout

Keep the canonical morpheus tree where it already is (`athene/src/renderer/morpheus/`) and let other apps reference it via symlink. This avoids any move/relocate work for the active Electron integration and lets future consumers point at the same source.

```
singularity-engine/
├── athene/                                        ← canonical home for morpheus
│   └── src/renderer/
│       ├── morpheus/                              ← canonical source, edit here
│       ├── morphSrc/                              ← Athene's app definition
│       ├── src/main.jsx, index.html, ...
│       └── ...
│   └── electron.vite.config.js
│
├── some-morpheus-based-app/                       ← demo content; tolerates its own copy or symlink
│   ├── morpheus → ../athene/src/renderer/morpheus ← symlink (optional, only if you actually use the demo)
│   ├── morphSrc/
│   ├── vite.config.js
│   └── ...
│
└── notes/morpheus-electron-integration/
```

Notes on the layout:
- **From the Vite root's perspective in Athene** (`src/renderer/`), `morpheus/` and `morphSrc/` are siblings — sibling-path constraint satisfied directly, no symlink needed.
- **For any future web app** (or for the demo if you decide to keep it functional), a symlink to `athene/src/renderer/morpheus` makes that app see the same source. Vite handles symlinks correctly out of the box.
- **The demo can also be left in drift mode** — it's marked demo content; nothing breaks if its bundled morpheus copy diverges or stales.

### 2.2 What lives per-consumer-app

Each app owns its own:
- `morphSrc/` (app definition + nodes — different per app by nature).
- Vite config (`electron.vite.config.js` for Athene, `vite.config.js` for any web app).
- `package.json`, `index.html`, `main.jsx`, `.gitignore`, CSP.
- npm dep set (morpheus's renderer runtime needs: `nanoid`, `lodash`, `axios`, `lucide-react`, `dexie`, `sass`; build-pipeline needs are only required by apps that actually run the prod build).

### 2.3 Alternatives considered

- **Move morpheus to `singularity-engine/morpheus/` (workspace root) + symlink both consumers.** Cleaner symmetry, but the Electron integration is the active consumer; the move costs work without paying back until a second real consumer appears. Defer.
- **Convert morpheus into a proper workspace package** (`import { Morpheus } from 'morpheus'`). Requires the small framework PR in §6 to drop the sibling-path assumption. Good long-term move, but not needed for either app to run.

---

## 3. Known issue — `@morphBuild` resolution in dev (affects both web and electron)

**Status:** active blocker for `npm run dev` until mitigated. Already present in the demo web app too — this is a framework-level concern, not an Electron-specific one.

### 3.1 What happens

`Morpheus.jsx` contains a top-level conditional import:

```js
let NodeResourceProvider = null;
if (IS_PROD) {
  try {
    const module = await import('@morphBuild/NodeResourceProvider');
    NodeResourceProvider = module.default;
  } catch (e) {
    console.warn('[Morpheus] NodeResourceProvider not found - run build first for production mode');
  }
}
```

The `IS_PROD` branch is dead in dev — the `try` body never executes. **But Vite's import-analysis pass walks every import statically before runtime constant-folding decides what's reachable.** It tries to resolve `@morphBuild/NodeResourceProvider`, fails, and aborts with:

```
[plugin:vite:import-analysis] Failed to resolve import "@morphBuild/NodeResourceProvider"
from "src/renderer/morpheus/Morpheus.jsx".
```

### 3.2 Dev-time mitigation (per app)

Consumers must register **a full set of aliases plus extensions plus SCSS load paths** in their Vite config. The `MORPHEUS_INTEGRATION.md` doc only mentioned `@morphBuild` and that was undercounted — without `@morpheus` the framework's bundled DevApp crashes on its own SCSS import, with no `extensions` Vite stops probing `.jsx`, and without SCSS `loadPaths` node-style partials don't resolve. The web app's `vite.config.js` is the reference; copy its pattern.

**Required for Athene** (`electron.vite.config.js`, renderer section):

```js
import { resolve } from 'path'
import morpheusResourcePlugin from './src/renderer/morpheus/vite/morpheusResourcePlugin.js'

renderer: {
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: [
      // @morphBuild — dev-only stub. Regex form is required because the import has
      // a subpath after the alias ('@morphBuild/NodeResourceProvider'); a bare-string
      // alias would produce 'devAppEntry.prod.js/NodeResourceProvider' (file + subpath
      // = missing). Replace with the real morphBuild-03 path once §3.3 is fixed.
      {
        find: /^@morphBuild\/.*$/,
        replacement: resolve(__dirname, 'src/renderer/morpheus/vite/devAppEntry.prod.js'),
      },
      // @morpheus — root of the framework source tree. Used by the bundled DevApp
      // (e.g. `import '@morpheus/devApp/assets/styles/index.scss'`).
      { find: '@morpheus', replacement: resolve(__dirname, 'src/renderer/morpheus') },
      // @morphSrc — root of the consumer app's morphSrc tree.
      { find: '@morphSrc', replacement: resolve(__dirname, 'src/renderer/morphSrc') },
    ],
    extensions: ['.js', '.jsx', '.json'],
  },
  css: {
    preprocessorOptions: {
      scss: {
        // morpheusResourcePlugin exposes node styles as a virtual module, so `@use`
        // directives can't resolve relative to source. With morphSrc on the load path,
        // a node references partials by qualified path: `@use 'nodes/X/styles/tokens'`.
        loadPaths: [resolve(__dirname, 'src/renderer/morphSrc')],
      },
    },
  },
  plugins: [react(), morpheusResourcePlugin()],
  // ...
}
```

**Why the regex form for `@morphBuild`** (vs the object form everywhere else):
- `@morphBuild/NodeResourceProvider` has a subpath after the alias prefix.
- The web app points `@morphBuild` at a **directory** (`./morphBuild-03/`), so Vite's extension-probing finds `<dir>/NodeResourceProvider.js` correctly.
- Athene doesn't have `morphBuild-03/` yet (build pipeline issue), so we point at a **file** stub. Object-form alias on a file + subpath in the specifier produces a broken path (`file.js/NodeResourceProvider`). Regex form replaces the whole specifier and dodges the issue.
- Once §3.3 is unblocked and `morphBuild-03/` exists, switch to the object form pointing at the directory — matches the web app exactly.

**After applying this**: `npm run dev` should start cleanly (deps permitting — see Phase 1 step 1). Confirm in DevTools: `window.morpheus` is exposed; `window.appKernel.getMetaData('appName')` returns the right value.

### 3.2.1 What the integration doc missed (errata)

`MORPHEUS_INTEGRATION.md` should be updated. Specifically:
- Object-form `@morphBuild` alias → must be regex-form while pointing at a file stub.
- Only mentioned `@morphBuild` → must also register `@morpheus`, `@morphSrc`.
- Didn't mention `extensions: ['.js', '.jsx', '.json']` → needed for Vite to probe `.jsx` files morpheus imports without extensions.
- Didn't mention SCSS `loadPaths` → required for node-style partial resolution.
- Didn't mention `import 'virtual:morpheus-node-styles'` in the renderer entry → without it, the morpheus SCSS bundle never executes; nodes render unstyled. The web app's `main.jsx` does this; Athene's needs the same.
- Didn't flag StrictMode incompatibility (see §3.4 below) → consumers must disable StrictMode in the renderer entry.

These are framework-level assumptions that any consumer (web or electron) has to honor. The web app's `vite.config.js` + `src/main.jsx` are the canonical reference.

---

### 3.4 Known issue — Morpheus is not React 18 StrictMode-safe (affects both web and electron)

**Status:** active. Both consumers must disable StrictMode in the renderer entry; the web app already does this (commented-out StrictMode in `some-morpheus-based-app/src/main.jsx`).

#### What happens with StrictMode enabled

StrictMode double-invokes every `useEffect` in dev to surface impure side effects. Morpheus's lifecycle reserves an instance slot before async kernel initialization completes, and `destroyKernel` nulls out kernel fields on unmount. The combination produces three error families on every node mount:

1. `[NodeManager] Duplicate instance "X:Default" blocked` — second StrictMode pass calls `createNode`, which checks `mayCreateInstance` against the still-pending or already-mounted first pass and rejects.
2. `[GraphManager] Node "X:Default" has no parent but root already exists` — same root cause surfacing in the graph-registration path.
3. `[Kernel] Unknown signal ID: "showUI" { nodeId: null }` — kernels destroyed during the StrictMode unmount cycle leak references into user-code callbacks (the `nodeId: null` is the diagnostic giveaway; `destroyKernel` nulls those fields). The DevApp's Trigger button is the most visible symptom.

#### Dev-time mitigation

Don't wrap `<App />` (or `<MorpheusGraph />`) in `<StrictMode>` in the renderer entry. Pattern matches the web app:

```jsx
// src/renderer/src/main.jsx
import { createRoot } from 'react-dom/client'
import 'virtual:morpheus-node-styles'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
```

#### Long-term fix at the framework level

StrictMode-safety is worth doing eventually — it surfaces real lifecycle issues that StrictMode tries to flag. Three touch points:

- **`createNode`'s pending-instance reservation** needs a cancellation path. Today the loadNode `useEffect` has no cleanup function, so a StrictMode unmount mid-create orphans the reservation.
- **`destroyKernel`'s field-nulling** is too aggressive. It nulls the kernel synchronously, but user code (e.g. inline click handlers in modules) may hold references that get re-invoked under StrictMode's "remount with same identity" semantics. Either mark the kernel as destroyed without nulling, or have public methods check a `destroyed` flag and silently no-op.
- **`mayCreateInstance` should be re-entrant** under StrictMode — the same `(nodeId, instanceId)` pair from the same render slot shouldn't trip the duplicate-check.

None of this is blocking the integration. Document, ship without StrictMode, fix upstream when bandwidth allows.

---

### 3.5 Known issue — Diagnostics writes inside the Vite root cause cascading reloads (affects both web and electron)

**Status:** active. Both consumers should ignore the `diagnostics/` directory in their Vite watcher config.

#### What happens

`morpheusResourcePlugin`'s `POST /__morpheus_state` middleware writes diagnostic JSON files to `${projectRoot}/diagnostics/`. Every node mount writes ~5 snapshot files (`kernelDidCompile`, `kernelDidInitialize`, `signalsDidInitialize`, `nodeDidMount`, plus timeline flushes). Deep-subtree mounts (e.g. navigating to a DevApp panel like AppInspector with its child modules `AppResourceRow`, `AppResourceDetails`) write dozens of files in a sub-second burst.

The diagnostics directory is **inside the Vite project root** (`src/renderer/diagnostics/` in Athene; `diagnostics/` in the web app). Vite's chokidar watcher fires `add` events for every file. Vite's HMR processing + React Fast Refresh interpret the cascade as a major change and trigger a full page reload. The reload re-instantiates the Morpheus singleton, which calls `Diagnostics.initSession()`, which wipes the diagnostics directory — making the symptom hard to diagnose post hoc because the smoking-gun snapshots get deleted.

User-visible symptom: clicking a DevApp navigation tab "closes the DevApp" — actually the whole page reloads, and the DevApp's `showUI` signal returns to its default `false`, so the panel disappears.

#### Dev-time mitigation

Add a watch-ignore to the consumer's Vite config:

```js
// electron.vite.config.js (renderer block) or vite.config.js
server: {
  watch: {
    ignored: ['**/diagnostics/**'],
  },
},
```

The web app's `vite.config.js` should add the same; it likely has the same latent bug but masked because users don't open AppInspector / NodeInspector / Timeline as often, or because the cascade is shallower in the web app's typical browse pattern.

#### Long-term fix at the framework level

Two options, either of which removes the need for the per-consumer ignore:

1. **Write diagnostics outside the project root.** The plugin chooses `path.join(projectRoot, 'diagnostics')`. Switching to a sibling path (e.g. `${projectRoot}/../diagnostics-{appName}/`) or to `node_modules/.morpheus-diagnostics/` (already in Vite's default ignore set) eliminates the watcher cascade. Caveat: in Electron renderer dev, `projectRoot` is `src/renderer`, so `..` becomes `src/` — still inside the source tree. A path-resolution helper that finds the actual workspace root is cleaner.

2. **Tell Vite's watcher to ignore the diagnostics directory automatically.** The plugin already has access to the dev server (`configureServer(server)`); it can mutate `server.watcher` to ignore the diagnostics path it controls. Single-touch fix:
   ```js
   server.watcher.unwatch(path.join(projectRoot, 'diagnostics'));
   ```
   Run in `configureServer` after computing the path. Self-contained inside the plugin — consumers don't need to know.

Option 2 is the cleanest because the plugin owns the path and the responsibility. Worth a small framework PR after the integration settles.

### 3.3 Build-pipeline issue (separate, deferred)

The other half of the problem: even when you want `npm run build` to *actually* produce a `NodeResourceProvider`, the build pipeline has a known issue preventing it. This affects both web and electron once they're ready to ship production builds. **It is not blocking dev work** — the alias-stub in §3.2 keeps dev green regardless. Track separately:

- Investigate root cause (likely the cluster of issues already documented at `morpheus/KERNEL_FRAGMENTS_BUILD_ISSUE.md` — kernel fragments missing in prod, `__name` helper leaking from esbuild, etc., though the user reports the actual blocker may be different).
- Once the CLI build runs cleanly, the alias becomes conditional: stub in dev, real `morphBuild-03/` path in prod.
- Until then: **no production builds for either app**.

### 3.4 Long-term fix at the framework level

The cleanest fix is to remove the conditional dynamic import from `Morpheus.jsx` and let consumers inject `NodeResourceProvider` (or `null`) explicitly via the constructor. That would mean:

- No `@morphBuild` import in framework source at all.
- Each prod build wires its own provider via the app entry point.
- Dev needs no alias stub.

This is a small, well-scoped framework PR. Worth doing once the build-pipeline issue (§3.3) gets investigated, since both touch the same surface.

---

## 4. Phased implementation

### Phase 1 — Wire morpheus into Athene's renderer (the immediate work)

Source of truth is already in place at `athene/src/renderer/morpheus/`; no consolidation step needed.

1. **Install morpheus's runtime deps** in Athene. Two groups:

   **Core (required for any morpheus app):**
   ```
   npm install nanoid lodash axios lucide-react dexie sass
   ```

   **DevApp-only (required if the bundled morpheus DevApp will render — which is on by default in dev):**
   ```
   npm install reactflow elkjs
   ```
   Without these, the DevApp's `AppLiveView` node fails to compile and you see `Failed to compile node "AppLiveView" ... Cannot read properties of null (reading 'config')` in the console when the tab is clicked (Vite returns 500 on the `.node.jsx` file because import resolution fails; `loadNodeFile` returns null; the hierarchy compiler crashes on the null). Other DevApp tabs work fine without these packages.

   If you've disabled the DevApp (see §5.1), the DevApp-only group is not needed.
2. **Update `electron.vite.config.js`** — register `morpheusResourcePlugin` and add the `@morphBuild` alias stub (§3.2):
   ```js
   import morpheusResourcePlugin from './src/renderer/morpheus/vite/morpheusResourcePlugin.js'

   renderer: {
     root: resolve(__dirname, 'src/renderer'),
     resolve: {
       alias: {
         '@morphBuild': resolve(__dirname, 'src/renderer/morpheus/vite/devAppEntry.prod.js'),
       },
     },
     plugins: [react(), morpheusResourcePlugin()],
     build: { ... },
   }
   ```
3. **Verify `src/renderer/morphSrc/`** has a minimal app. The current Athene tree already has `morphSrc/` with `app.js`, `nodes/`, `README.md` — keep or extend as needed.
4. **Switch `src/renderer/src/main.jsx`** to mount `<MorpheusGraph />` instead of the current `<App />`:
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
5. **Relax the CSP in `src/renderer/index.html`** for dev (Vite HMR over WebSocket + inline scripts):
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*" />
   ```
6. **Add `src/renderer/diagnostics/` to `.gitignore`** — morpheus writes JSON there on every dev session.

**Verification (exit criteria):**
- `npm run dev` opens the Athene window with the Hello-World node rendered.
- DevTools shows `window.morpheus` and `window.appKernel` exposed.
- `src/renderer/diagnostics/timeline.json` appears and grows on interaction.
- Editing a module triggers HMR.
- Decide whether morpheus's DevApp panel (auto-mounted next to the main app) stays visible, hidden via CSS, or removed (§5.1).

### Phase 2 — (Deferred) Production build for Electron

Blocked on the build-pipeline issue (§3.3). When it's unblocked:

1. Chain `morpheus:build:v3` before `electron-vite build` in Athene's package.json.
2. Make the `@morphBuild` alias conditional: dev → stub, prod → `morphBuild-03/`.
3. Register prod-hardening plugins gated on `NODE_ENV === 'production'`:
   - `morpheusProdStripPlugin`
   - `morpheusDevAppStubPlugin` (prevents ~274 MB of devApp sound assets from emitting into `out/renderer/`)
   - `vite-plugin-javascript-obfuscator` with `build.config.js#production.obfuscator.preset`
4. Decide renderer prod load mechanism (`loadFile` vs custom `app://` protocol — affects `Router.isHome()` semantics).
5. Validate dynamic-chunk resolution from the packaged renderer origin.
6. Confirm the `KERNEL_FRAGMENTS_BUILD_ISSUE.md` items are resolved (or apply fixes if not).

### Phase 3 — (Optional) Future framework PRs

See §6.

---

## 5. Open decisions

### 5.1 DevApp visibility in Athene

Morpheus's DevApp auto-mounts in dev (`Morpheus.jsx#initializeDevApp` + the second `<DevToolsRoot />` in `getRootNode`). In a desktop control plane like Athene, you probably want it hidden — Athene likely has its own inspector chrome.

Options (in order of effort):
- Hide with CSS in Athene's app styles.
- Add a `disableDevApp` flag to `build.config.js` and gate the DevApp init on it (small framework PR — §6.2).
- Move the DevApp out of the framework entirely into an opt-in package consumers import explicitly.

Ship Phase 1 with DevApp visible, decide once you see it in context.

### 5.2 Should the demo (`some-morpheus-based-app/`) stay live?

Three answers:
- **Delete it** — saves clutter, no obligation to keep working.
- **Leave it alone** — its bundled morpheus may stale, but it's labeled demo content; harmless.
- **Symlink its morpheus to the canonical** — keeps the demo runnable and gives you a second consumer to validate the shared-source workflow on.

Doesn't need to be decided before Phase 1.

### 5.3 Athene-specific IPC integration

Athene has a preload-bridge IPC surface (`window.athene.*`). When morpheus modules need IPC:
- **Bad:** modules call `window.athene.ipc.invoke(...)` directly — leaks the global, untestable.
- **Good:** declare an `IpcTrait.js` in Athene's `morphSrc/app/traits/`, mount via `kernelFragments` at app level, modules call `_.app.ipc.invoke(...)`. Pattern matches the existing service surface (Router, Media, etc.).

Not a Phase 1 blocker — only matters once a module actually wants to hit IPC.

---

## 6. Framework-side improvements (optional, deferrable)

None of these block the integration. They are paybacks-over-time once the integration is settled.

1. **Configurable `morphSrc` and `devApp` paths.** Move the sibling-path assumption into `build.config.js`:
   ```js
   export default {
     pipeline: '03',
     paths: { morphSrc: '../morphSrc', devApp: './devApp' },
     // ...
   }
   ```
   Touch points: `Morpheus.jsx`, `NodeLevelCompiler.js` (folders + the two relativePath builders), the build CLIs (which `import appDefinition from '../../../morphSrc/app.js'`), `morpheusResourcePlugin.js` (which `path.join(projectRoot, 'morphSrc')` in several places).

2. **DevApp on/off switch.** A `disableDevApp` flag in `build.config.js` (or env var) so embedded contexts like Athene can opt out without forking.

3. **`@morphBuild` import made injectable.** Drop the conditional dynamic import in `Morpheus.jsx`; let consumers pass a `nodeResourceProvider` (or `null`) into the Morpheus constructor. Eliminates the dev-stub alias requirement and makes the framework cleaner to consume.

4. **Build-pipeline reliability** — the actual reason production builds aren't working today. Investigate per §3.3 and the existing `morpheus/KERNEL_FRAGMENTS_BUILD_ISSUE.md` doc.

5. **Diagnostics transport configurability.** Currently hardcoded to `fetch('/__morpheus_state')`. For environments without the Vite middleware available (e.g. a packaged app wanting dev-style diagnostics in prod), let the URL come from config or expose a write-callback.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@morphBuild` resolution error blocks `npm run dev` | Currently **happening** | Dev blocked | Apply §3.2 alias stub in `electron.vite.config.js` |
| Build-pipeline issue blocks production ship | Currently **happening** | Can't ship prod | Treat as separate framework concern; defer Phase 2 until resolved |
| `morpheusResourcePlugin`'s SCSS/discovery `fs` scans pick up the wrong `morphSrc` | Low if `renderer.root` is set correctly | Wrong UI | Confirm `renderer.root = src/renderer` in Athene's Vite config; plugin reads from `path.join(projectRoot, 'morphSrc')` so `config.root` is the source of truth |
| Electron's renderer file:// origin in prod can't load `@morphBuild` chunks | Unknown until Phase 2 | Blocks prod ship | Verify in Phase 2; fallback is custom `app://` protocol |
| DevApp panel layout collides with Athene chrome | Medium | Visual noise | Hide via CSS short-term, gate via framework flag long-term (§6.2) |
| Athene wants IPC inside modules without a clean pattern | Medium | Ad-hoc `window.athene.*` calls scattered | Define an `IpcTrait` in `morphSrc/app/traits/`, mount via `kernelFragments` (§5.3) |

---

## 8. Recommended commit sequence (Phase 1)

Small, reviewable steps:

1. **commit:** "athene: install morpheus runtime deps" — `npm install nanoid lodash axios lucide-react dexie sass`.
2. **commit:** "athene: wire morpheus into renderer vite config" — `morpheusResourcePlugin` + `@morphBuild` alias stub + `renderer.root`.
3. **commit:** "athene: mount MorpheusGraph from main.jsx, gitignore diagnostics" — entry change + `.gitignore`.
4. **commit:** "athene: relax CSP for dev HMR" — `index.html` meta tag update.
5. **commit:** "athene: minimal morphSrc Home node" — only if the current `morphSrc/` needs a starter app added.

Each commit independently verifiable.

---

## 9. What to do first

The immediate, unblocking move is **Phase 1 step 2** — add the `@morphBuild` alias stub to `electron.vite.config.js`. That clears the `Failed to resolve import` error and lets `npm run dev` start. Everything else in Phase 1 follows naturally once dev is running.

Want me to take that step now (write the `electron.vite.config.js` change), or walk through Phase 1 end to end?
