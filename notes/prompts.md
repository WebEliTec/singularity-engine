# Athene — Development Prompts

*Prompts to forward to setup and build agents during Singularity Engine development. Each prompt below is self-contained: it stands alone for the recipient agent and does not require the agent to read this file.*

*Each prompt is wrapped in a code block — copy the block's contents and paste as the opening message to a fresh agent session. Newest prompts at the bottom; phases are added as the build sequence advances.*

---

## Phase 1 — Electron Shell Setup

- **Status:** Pending
- **Target directory:** `/Users/daniel/Desktop/singularity-engine/athene/`
- **Predecessor:** None (first phase of Athene's build)
- **Successor:** Phase 2 — minimal morpheus integration (to be drafted when Phase 1 is verified)
- **Recipient agent type:** Setup-focused agent (Claude Code or equivalent)

### Prompt

````markdown
# Athene Electron Setup

## Context

You're setting up the Electron shell for **Athene**, the desktop control plane for Singularity Engine — a private domain-modeling and content-publishing system. Athene will eventually host a morpheus-based React application. Subsequent agents will add the morpheus instance and the IPC capability services. **You are doing only the Electron shell — nothing else.**

Optional background reference: `/Users/daniel/Desktop/singularity-engine/notes/architecture.md`. Not required reading; the specifications below are self-contained.

## Your remit

Produce a runnable Electron application that meets the specifications below. Your work is the foundation that subsequent agents will build on. Get the foundation right; do not extend scope.

## Specifications

### Build tool

Use **electron-vite**. Not Electron Forge for build (Forge can be added later for packaging, not your concern).

### Security defaults (non-negotiable)

The main BrowserWindow must be configured with:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` where compatible with the rest of the setup
- `webSecurity: true`

Renderer access to Node-side capabilities goes through the preload script via `contextBridge.exposeInMainWorld(...)`. Never relax these defaults for convenience.

### Project structure

```
athene/
├── package.json
├── electron.vite.config.js
├── src/
│   ├── main/
│   │   └── index.js           # Electron main process entry
│   ├── preload/
│   │   └── index.js           # contextBridge surface (minimal)
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.jsx
│           └── App.jsx        # placeholder React component
```

The morpheus app will eventually live under `src/renderer/`. Set up the folder shape so it accommodates that later without rearrangement.

### Sanity-check IPC bridge

Expose exactly one capability through preload as a sanity check:

- Main process: register an IPC handler that returns `'pong'`.
- Preload: `contextBridge.exposeInMainWorld('athene', { ping: () => ipcRenderer.invoke('athene:ping') })`
- Renderer placeholder: a button that calls `window.athene.ping()` and displays the response.

This is purely to verify the IPC plumbing works end-to-end. Do not build out additional bridges — those are for the next agent.

### Dev experience

- `npm run dev` launches the Electron app and opens DevTools.
- Hot module reload works for the renderer on source changes.
- Sources written in **JavaScript (not TypeScript)**.

### Target

- **macOS as primary target.** Cross-platform considerations are out of scope.

## What is explicitly NOT in your remit

- Do not add morpheus or any morpheus dependencies.
- Do not add additional IPC capabilities (filesystem, child_process, etc.) beyond the ping bridge.
- Do not configure backend coordination, HTTP clients, or environment variables.
- Do not handle configuration files or secrets management.
- Do not set up packaging for distribution.
- Do not add state management, routing, styling libraries, or UI frameworks beyond what's needed for the placeholder button.
- Do not extend scope toward "useful" additions. Each subsequent agent has its own remit; do not contaminate their work surfaces.

## Acceptance criteria

Your work is complete when:

1. `npm install && npm run dev` starts the Electron app cleanly.
2. The window displays the placeholder renderer with a "ping" button.
3. Clicking the button displays "pong" returned from the main process via the preload bridge.
4. The renderer hot-reloads when source files change.
5. BrowserWindow configuration inspection confirms all four security defaults are set correctly.
6. `package.json` contains no unrequested dependencies.

## Working directory

Create the project at `/Users/daniel/Desktop/singularity-engine/athene/`.

## Reporting back

When complete, report:
- The final folder structure (as a tree).
- The contents of `package.json`.
- Explicit confirmation that all six acceptance criteria are met.
- Any deviations from the spec, with rationale.

If any specification is ambiguous, ask for clarification before proceeding. Otherwise, proceed with the work and report when the acceptance criteria are met.
````

---

## Phase 2 — Minimal Morpheus Integration

*To be drafted when Phase 1 is complete and verified. Will add a minimal morpheus app to Athene's renderer, with no business logic — just the framework integration to confirm morpheus runs inside the Electron shell.*

**Status:** Not yet drafted.

---

## Phase 3+ — TBD

*Subsequent phases will be drafted as the build sequence advances. Likely candidates: Apollo Node.js port, capability service integration (AgentManager, FileSystemManager), schema-authoring UI implementation, Data-Pocket distribution layer, primitive AI chat integration.*

**Status:** Not yet drafted.
