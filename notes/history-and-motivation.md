# Singularity Engine — History & Motivation

*The story behind the codebase. Where the project came from, what each pivot was a response to, and what it is ultimately for. Companion to `conceptual-deep-dive.md`, which captures the technical model.*

---

## Origin: teaching WordPress

The seed was planted roughly three years ago. Daniel had been teaching WordPress for a long time and had developed an intimate view of how **fragmented the WordPress resource landscape is** — plugins, themes, tutorials, conventions, ecosystems, all scattered across thousands of disconnected sources with no unifying model.

The first idea was **wp-prof**: a unified platform to model the entire WordPress ecosystem. One coherent map of the territory, rather than a thousand partial guides.

## Naive attempt: build wp-prof on WordPress

The obvious first move was to implement wp-prof *on* WordPress itself.

This hit a ceiling quickly. **WordPress's own data model is too constrained to host a model *of* WordPress.** You cannot describe a flexible, evolving, deeply-interrelated ecosystem using a substrate whose schema is fundamentally fixed around posts, terms, and meta. The container is smaller than the thing it would need to contain.

## The pivot: from "WordPress modeling tool" to "arbitrary domain modeling tool"

Across several iterations, the real problem clarified itself:

> What's needed is not a better way to model WordPress. What's needed is a tool to model **arbitrary domains at arbitrary levels of detail**.

WordPress was just the first domain. The substrate itself had to be domain-agnostic.

From this clarification came the load-bearing design insight that defines the whole project:

> **Versioning itself must be versioned.**

To get the relevant attributes and entities right over time — across iterations, across contributors, across domains — the system can't just version content. It has to version the schema, the way the schema is composed, and the way those compositions evolve. That's why singularity engine applies a draft → committed lifecycle recursively to attribute sets, trait attribute sets, composition schemes, and class versions. The governance machinery is not bolted on; it is the point.

## The AI dimension

In parallel with the design work, AI was rapidly maturing. Daniel saw both an **opportunity and a threat** in this — and decided the project's long-term advantage had to be built explicitly around it.

The vision:

- **Gate-keeper agents per entity category.** Each kind of entity in the system has a dedicated AI agent responsible for it. These agents autonomously scan the internet, ingest new information, and propose updates to entities and relations.
- **Agents that can modify the schema itself.** Not just content updates — schema evolution. New attributes, new traits, new composition rules, all proposable by agents.
- **Safety through determinism.** The reason all of this is governable rather than chaotic: the deterministic, version-controlled, draft/committed core. AI agents can have write access *because* every change is captured, versioned, and reviewable.

This is the long-term moat: a **rigorously deterministic schema engine + AI agents that can safely evolve both content and schema within it**. It is not "yet another CMS." It is infrastructure for AI-mediated knowledge curation. wp-prof becomes the first proving ground, not the destination.

## Building the deterministic core

Before any AI layer could exist, the deterministic system had to be right. That meant building the current stack:

- **`content-creation-center/`** — a Laravel backend that stores the entire schema as a portable JSON tree under `storage/app/content-base/`. Eloquent models are present but largely vestigial; the JSON tree is the canonical state and the migration unit.
- **`content-management-hub/`** — a React frontend providing the visual schema editor.

The backend came out reasonably well. The frontend did not.

## The frontend wall → morpheus

Daniel was still learning React while building `content-management-hub`. The result was a codebase that grew complicated faster than his React experience grew, and the architecture became hard to evolve.

Rather than refactor or push through, the response was to **go up the stack**: if React's primitives weren't producing maintainable code for this kind of system, then the right move was to build a meta-framework on top of React that *would*.

The result: **morpheus** — a React meta-framework that has been in development for ~14 months and has reached near-production shape. This is now the centerpiece of the technical stack. Each layer in the journey — wp-prof → singularity engine → content-management-hub → morpheus — was a response to a wall hit at the previous layer.

## Where things stand now

- **`content-creation-center/`** — Laravel backend, working. Stays.
- **`content-management-hub/`** — React frontend, original, considered a stepping stone. To be replaced.
- **`singularity-frontend/`** — actually **Jung**, a separate complex morpheus app, renamed and placed here as a reference exemplar so others (including Claude) can see what a non-trivial morpheus application looks like in practice. Not the home of the rewrite.
- **morpheus** — the meta-framework itself, lives outside this directory. Near production-ready after ~14 months.

## Next step

Re-implement `content-management-hub` in morpheus. A fresh morpheus app, backed by the existing Laravel API. The conceptual deep-dive (`conceptual-deep-dive.md`) is the bridge spec — it captures what must be preserved when the React/Redux specifics dissolve. Jung is the reference for *how* a complex morpheus app is structured.

This is the next pivot, but unlike the earlier ones it is not driven by hitting a wall — it is driven by finally having the right substrate to express the system properly.
