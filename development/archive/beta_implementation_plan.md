---
title:         Beta Implementation Plan — Vertical Slice
status:        executed
date_executed: 2026-05-27
date_archived: 2026-05-28
scope:         First vertical slice — Athene singleton + Apollo HTTP + first ContentClass node
parent:        ../alpha_implementation_plan.md
phases:
  - B1 — executed (Athene singleton)
  - B2 — executed (Apollo stub child)
  - B3 — executed (Apollo.listAllContentClasses hits real Laravel)
  - B4 — executed (ContentClassManager + ContentClass domain object)
  - B5 — executed (ContentClassExplorer view + devApp style migration)
---

# Beta Implementation Plan — Vertical Slice

**Companion to:** [conceptual-deep-dive.md](../../notes/conceptual-deep-dive.md), [mvp-feature-inventory.md](../../notes/mvp-feature-inventory.md), [planning-state.md](planning-state.md) (in memory)

*This plan is archived (frozen). All five phases (B1–B5) landed in
commits `3318485` through `1097dd0`. Subsequent work (gamma G1+ etc.)
superseded the ContentClassExplorer surface — it was deleted in G2
when Hermes/ContentClass replaced its functionality. Plan kept as
historical record.*

---

## What this beta proves

One vertical slice through Athene's architecture: **a node in Athene renders the list of all Content Classes that live in Apollo (the existing Laravel `content-creation-center`)**, with every layer the eventual MVP needs already wired up.

Success looks like: open the Electron app, see a list of content class titles fetched live from Laravel running at `http://localhost:8000` (or wherever), with no JSON files imported directly into the renderer.

That's it. No editing. No locales. No ingestion. No agents. Just the loop:

```
Node module
   └─ moduleProps inject ContentClasses
        └─ Athene.contentClasses.getAll()
             └─ Apollo.listContentClasses()    ← HTTP to Laravel
                  ↳ Apollo returns raw JSON
             ↳ Athene materializes ContentClass instances
        ↳ node module renders titles
```

Once this works, every later MVP feature (locales, ingestion, editing, agents) extends a pattern that's already proven.

---

## What this beta does NOT do

- No write paths (`POST`/`PUT`/`DELETE` against Apollo). Read-only.
- No locale handling. ContentClasses are read as-is.
- No editing UI. Just a list.
- No agents. No AI chat. No ingestion script.
- No persistence of the fetched list — re-fetch on each mount.
- No Class Versions, Attribute Sets, Composition Schemes, Class Objects. Just the bare ContentClass list.
- No changes to Apollo (Laravel). Use whatever endpoint already exists; if none, add one as a tiny supporting step but keep it minimal.
- No auth. Engine stays local.

If a piece feels missing here, it's deferred on purpose — the point is to prove the wiring, not the feature set.

---

## Architectural target (the OOP layer)

```
appKernel
  └─ athene  (Athene singleton — top-level app orchestrator)
       ├─ apollo         (HTTP client to Laravel — the ONLY door to backend data)
       └─ contentClasses (registry + collection of ContentClass instances)

ContentClass  (per-record domain object; lightweight value-object wrapper)
```

**Conventions, mirroring Jung's `inc/`:**

- **`Athene`** holds `appKernel` (the morpheus app kernel) and instantiates its children in its own `init()`.
- **`AtheneChild`** is the base class for kernel-aware sub-entities (analogue of `JungChild`). Gives each child `this.athene` (non-enumerable, to keep diagnostics from infinite-recursing on `JSON.stringify`) and `this.appKernel` (convenience).
- **`Apollo`** extends `AtheneChild`. Owns the HTTP client + base URL. All Laravel calls go through it — no other class makes `fetch`.
- **`ContentClasses`** extends `AtheneChild`. Holds a `Map<id, ContentClass>` plus methods like `loadAll()`, `getAll()`, `getById(id)`. When it needs data, it calls `this.athene.apollo.listContentClasses()`.
- **`ContentClass`** is NOT an `AtheneChild`. It's a plain class — one instance per record. Holds raw data + getters. Methods that would need backend access take `athene` from their constructor or call back through the registry.

This shape matches Jung's `Jung → JungChild → (Session, User, Navigator, …)` cleanly, just at app scope.

---

## Files we'll touch (and create)

```
athene/src/renderer/morphSrc/
├── app.js                                    ← edit: register node, instantiate Athene in hook
├── app/
│   ├── Athene.js                             ← NEW: top-level orchestrator
│   ├── AtheneChild.js                        ← NEW: base class
│   ├── apollo/
│   │   └── Apollo.js                         ← NEW: HTTP client
│   └── contentClasses/
│       ├── ContentClasses.js                 ← NEW: registry/collection
│       └── ContentClass.js                   ← NEW: per-record domain object
└── nodes/
    └── ContentClassExplorer/                 ← NEW: exemplary node
        ├── ContentClassExplorer.node.jsx
        └── Root.jsx
```

The existing `nodes/Home/` stays for now; we can drop it or keep it as a landing surface — undecided.

---

## Phased deliverables

Each phase is a *standalone shippable unit* — at the end of each, the app runs, even if some pieces are stubbed.

### Phase B1 — Athene singleton wired into the app kernel

**Goal:** `appKernel.athene` exists, has been initialized, and modules can read from it. No Apollo yet, no nodes touching it.

**Work:**

1. Create `app/AtheneChild.js`. Constructor takes the parent `athene`; sets `this.appKernel = athene.appKernel` plus a non-enumerable `this.athene = athene`.
2. Create `app/Athene.js`. Constructor takes the `appKernel`, calls `this.init()`. For B1, `init()` does nothing — Athene is just a marker that's been instantiated.
3. Edit `morphSrc/app.js`:
   - Import `Athene`.
   - Add an `appKernelDidInitialize(appKernel)` hook that does `appKernel.athene = new Athene(appKernel)`.
4. Sanity check: from `Home.jsx`, log `App.athene` to confirm it's there.

**Acceptance:**

- `console.log(App.athene)` in any module shows an `Athene` instance.
- Dev tools show no errors during startup.
- No HTTP calls fired (Apollo doesn't exist yet).

---

### Phase B2 — Apollo business class (no HTTP yet, just structure)

**Goal:** `Athene.apollo` exists, has a defined surface, but every method returns a hardcoded stub. Proves the cross-class wiring works before introducing the network boundary.

**Work:**

1. Create `app/apollo/Apollo.js`. Extends `AtheneChild`. Stores `this.baseUrl` (read from `this.appKernel.getConstant('apolloBaseUrl')` — see step 3).
2. Add one stub method: `async listContentClasses()` returns a hardcoded array, e.g.:
   ```js
   return [
     { id: 'stub-1', title: 'Stub Class A' },
     { id: 'stub-2', title: 'Stub Class B' },
   ];
   ```
3. Edit `app.js`:
   - Add `constants: { apolloBaseUrl: 'http://localhost:8000' }` (URL is provisional; Laravel might serve on a different port).
   - No code change in `appKernelDidInitialize` — Athene's `init()` is what instantiates Apollo.
4. Edit `Athene.js`:
   - Import `Apollo`.
   - In `init()`: `this.apollo = new Apollo(this);`
5. Sanity check: from a module, `App.athene.apollo.listContentClasses()` returns the stub array.

**Acceptance:**

- `App.athene.apollo` is an `Apollo` instance.
- `await App.athene.apollo.listContentClasses()` resolves to the stub array.
- Still no real HTTP yet — the network boundary is intentionally deferred to B3.

---

### Phase B3 — Apollo talks to real Laravel

**Goal:** Apollo's `listContentClasses()` actually hits the Laravel server and returns whatever it has.

**Work:**

1. **Discovery step (no code):** Survey `content-creation-center` for an existing endpoint that returns the list of content classes. Likely candidates: `/api/content-classes`, `/api/contentClasses`, or whatever the existing React frontend already calls. If nothing usable exists, add a minimal new Laravel route returning `[{ id, title }, ...]` from the filesystem-backed JSON store. **Don't refactor Apollo Laravel.** This is a read-only thin endpoint.
2. Replace Apollo's stub method:
   ```js
   async listContentClasses() {
     const res = await fetch(`${this.baseUrl}/api/content-classes`);
     if (!res.ok) throw new Error(`Apollo listContentClasses failed: ${res.status}`);
     return res.json();
   }
   ```
3. Decide: does Apollo throw on failure (caller catches), or does it return a normalized `{ data, error }` shape? **Recommendation: throw.** Cleaner control flow; node-level error handling decides what to show.
4. Start Laravel locally; confirm CORS allows the Electron renderer's origin (`file://` or `http://localhost:5173` if Vite dev server). Add CORS headers in Laravel if needed — one-line config.

**Acceptance:**

- With Laravel running, `await App.athene.apollo.listContentClasses()` returns real data from the filesystem.
- With Laravel stopped, the call throws — and the error reaches a place we can log it (browser console for now).
- No JSON file imports in Athene's renderer code. Every byte of content data crosses the HTTP boundary.

---

### Phase B4 — ContentClass collection + ContentClass domain object

**Goal:** The data Apollo returns gets wrapped in proper domain objects, owned by a registry on Athene.

**Work:**

1. Create `app/contentClasses/ContentClass.js` — plain class (NOT an `AtheneChild`). Constructor takes raw data: `constructor(rawData) { this._data = rawData; }`. Add getters: `get id()`, `get title()`. Keep it small for B4 — just enough to render a list.
2. Create `app/contentClasses/ContentClasses.js` — extends `AtheneChild`. Internal state: `this._classesById = new Map()`, `this._loaded = false`.
3. Methods:
   - `async loadAll()` — calls `this.athene.apollo.listContentClasses()`, wraps each raw record in a `ContentClass` instance, populates the Map, sets `_loaded = true`.
   - `getAll()` — returns `Array.from(this._classesById.values())`. Throws if `!_loaded` (or returns `[]` and forces caller to `loadAll` first — pick one and document).
   - `getById(id)` — `this._classesById.get(id) || null`.
   - `isLoaded()` — `this._loaded`.
4. Edit `Athene.js` — in `init()`: `this.contentClasses = new ContentClasses(this);`

**Acceptance:**

- `App.athene.contentClasses` exists.
- After `await App.athene.contentClasses.loadAll()`, `App.athene.contentClasses.getAll()` returns an array of `ContentClass` instances.
- Each instance's `.title` matches the title Laravel returned.

---

### Phase B5 — Exemplary node renders the list

**Goal:** A morpheus node that triggers the load on mount, holds the ContentClass list in a signal, and renders titles. Closes the loop.

**Work:**

1. Create `nodes/ContentClassExplorer/ContentClassExplorer.node.jsx`:
   - `signals`: `contentClasses` (`type: 'array'`, `default: []`), `isLoading` (`boolean`, `false`), `error` (`string`, `''`).
   - `moduleProps`: expose Athene + ContentClasses to modules without forcing them through `App.athene.contentClasses`:
     ```js
     moduleProps: {
       Athene:         (k) => k.app.athene,
       ContentClasses: (k) => k.app.athene.contentClasses,
     }
     ```
   - `kernel.loadList()` — sets `isLoading = true`, calls `this.app.athene.contentClasses.loadAll()`, copies the result into the `contentClasses` signal, sets `isLoading = false`. Catches errors → `error` signal.
   - `hooks.nodeDidMount(kernel)` — async; calls `kernel.loadList()`.
   - `modules: { Root: { isRoot: true } }`.
2. Create `nodes/ContentClassExplorer/Root.jsx`:
   ```jsx
   export default function Root({ _ }) {
     const isLoading = _.getSignal('isLoading');
     const error     = _.getSignal('error');
     const classes   = _.getSignal('contentClasses');

     if (isLoading) return <div>Loading...</div>;
     if (error)     return <div>Error: {error}</div>;
     if (!classes.length) return <div>No content classes found.</div>;

     return (
       <ul>
         {classes.map(cc => <li key={cc.id}>{cc.title}</li>)}
       </ul>
     );
   }
   ```
3. Edit `app.js`:
   - Register the new node: `nodes: { ContentClassExplorer: { isRoot: true } }`.
   - Demote `Home` (or remove it entirely — undecided).

**Acceptance:**

- Launching the Electron app with Laravel running shows a live list of content class titles.
- Stopping Laravel and reloading shows the error message.
- The list is sourced from Apollo via Athene — no direct imports of JSON files anywhere in `morphSrc/`.
- Modules access ContentClasses via the `ContentClasses` moduleProp, not via `App.athene.contentClasses` directly. (Both work — but the moduleProps pattern is what we'll standardize on going forward.)

---

## What we'll have learned by the end

- The Athene singleton pattern works the way we modeled it.
- Apollo's HTTP boundary is clean — only one class makes `fetch`.
- ContentClass as a domain object survives the round-trip; we know whether the Map-based registry is the right shape or wants revisiting.
- The CORS/serve-locally story is sorted; we won't have to figure it out under pressure later.
- We know Apollo's existing content-class list endpoint (or have added one), which is foundational for every later phase.

If anything in this list turns out to be different from how we imagined it, **the plan was supposed to deviate**. Beta deviates from alpha; nothing here is binding.

---

## Open questions, to resolve in-flight

- **Apollo URL.** `localhost:8000` is a guess. Confirm Laravel's actual dev port.
- **Existing endpoint.** Is there already a route returning the list, or do we need to add one minimally? If we add, what shape? `[{ id, title }, ...]` is the simplest. The full `Class Version` manifest (attribute set version id, etc.) is not needed for B5 — `id` and `title` cover it.
- **Home node.** Keep it as a landing/welcome screen, or delete? Probably delete for now — `ContentClassExplorer` is the temporary root. Reintroduce a real Home later.
- **Error UX.** Plain text for B5. A real "Apollo unreachable" frame can come later.
- **`getAll()` semantics when not loaded.** Throw or return `[]`? Going with **throw** — caller-must-load-first is clearer.
- **Where do moduleProps belong long-term?** B5 puts them on `ContentClassExplorer`. If every node ends up wanting `Athene` + `ContentClasses`, we'll promote them to globally-injected app-kernel props — but not until two nodes need them.

---

## What this plan deviates from in alpha

- The alpha [`architecture.md`](../../notes/architecture.md) imagined an Apollo Node.js port. **We're keeping Laravel as Apollo for the entire MVP** (per [planning-state.md](planning-state.md)). The HTTP boundary stays the same either way.
- The alpha implementation plan (not yet drafted) would walk all phases. **This beta is one vertical slice.** Other slices (locale support, write paths, ingestion, agents) come after this loop is solid.
- We're skipping all "P1/P2" items from [`mvp-feature-inventory.md`](../../notes/mvp-feature-inventory.md). The beta is intentionally narrower than the feature inventory.

---

## Next betas (sketch — not committed)

Once B1–B5 land, candidate next slices include:

- **Beta-Edit:** Add `Apollo.updateContentClass(id, patch)` + an inline rename in `ContentClassExplorer`. Proves the write path.
- **Beta-Locales:** Extend `ContentClass` with the locale model from the conceptual deep-dive. Read a multi-locale title.
- **Beta-Detail:** Click a ContentClass title → mount a `ContentClassDetail` node that fetches and shows the full schema (attributes, traits).
- **Beta-Agents:** Add a `Diagnostics`-style AI chat panel that can call `Athene.contentClasses.getAll()` and answer "list all classes whose title contains X" — proves the agent surface.

Each of these is its own beta and gets its own plan when we're ready.
