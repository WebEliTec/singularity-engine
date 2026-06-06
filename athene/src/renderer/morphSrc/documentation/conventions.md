# Conventions

A few patterns Athene follows.

## Naming

- **Page-nodes** are nouns describing the surface (`Home`,
  `EntityClassRegistry`, `EntityClassWorkbench`).
- Visual primitives use Greek-letter variants (`PanelAlpha`, `ListAlpha`,
  `PageHeaderAlpha`) rather than purpose-bound names, so they stay reusable
  across surfaces.

## State

- Domain data lives in **Apollo**, not in node signals. Signals hold only
  view state — what is selected, what is open.
- The active page is a single signal on `Root`; `Root` mounts one page-node
  at a time.

## Backend

- All backend calls target `apolloBaseUrl`. There is no second source of truth
  in the front end.
