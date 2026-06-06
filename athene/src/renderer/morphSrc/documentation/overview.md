# Overview

Athene is the **control surface** for the Singularity Engine — a knowledge-modeling
system. It is a thin front end over a world-model backend (**Apollo**); everything
you do here ultimately reads from or writes to Apollo.

## What you model

The core concept is the **entity class** — a *type of thing* being modeled
(for example `plugin` or `theme`). Each entity class carries a **versioned
attribute schema**: its attributes are grouped into **Attribute Set Versions**
that move through a `draft → committed` lifecycle.

- **Draft** versions are editable — you add, remove, and reshape attributes.
- **Committed** versions are frozen — a stable schema the rest of the engine
  can rely on.

## What you do here

From Athene you:

- browse and manage the registry of entity classes,
- edit the attributes of a class,
- and create / commit / delete schema versions.

## Where it sits

Athene is built with the **Morpheus** meta-framework and talks to Apollo at
`http://localhost:8001`. See [Architecture](./architecture.md) for how the
pieces fit together, and [Conventions](./conventions.md) for the patterns the
codebase follows.
