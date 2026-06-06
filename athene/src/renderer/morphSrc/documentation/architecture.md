# Architecture

Athene is a **Morpheus app**: a tree of nodes rooted at `Root`, each node a
self-contained unit of UI and behaviour backed by a kernel.

## The node tree

| Node | Role |
|------|------|
| `Root` | Pure dispatcher — reads the active-page signal and mounts exactly one page-node sibling. Holds no chrome. |
| `Home` | The brand-identity surface — the engine logo plus the class list as navigation. The only place the logo appears. |
| `EntityClassRegistry` | The surface for adding / editing / deleting entity classes themselves. |
| `EntityClassWorkbench` | The per-class surface, scoped to whichever class the user opened — where attributes and schema versions are managed. |

## The backend boundary

Athene holds **no domain state of its own** — it is a projection of Apollo's
world model. Reads and writes go through Apollo at `apolloBaseUrl`
(`http://localhost:8001`). The A5 cutover (2026-05-29) flipped this from the
legacy Laravel content-creation-center to the node + Fastify world-model
backend.

## Inputs — Hermes

Form inputs across the app are provided by **Hermes**, a global component
vocabulary (text, select, comboBox, checkboxes, …) registered at the app level
so any surface can compose the same inputs without copying them per node.
