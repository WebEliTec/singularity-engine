---
title:  Singularity Engine MVP — Alpha Implementation Plan
status: active
date:   2026-05-28
scope:  MVP shape, shipping condition, in/out boundary, phased work sequence
parent: none — root plan
---

# Singularity Engine MVP — Alpha Implementation Plan

*Meta-level planning. Each major division of this MVP — a subsystem, a
major bet, or a phase — spawns its own **beta** plan in this directory as
it becomes the active work block; a beta spawns gammas only if it later
needs its own sub-breakdown. See `README.md` for the planning framework.*

*Last updated: 2026-05-29 (development/ re-map: letters = abstraction level = distance from root; Phase 3's subsystem plans are direct **betas** of alpha — an earlier same-day pass mislabeled them as gammas under a now-removed container — see amendments below).*

*Amended 2026-05-28: Phase 3 ("Athene schema authoring UI") is structurally two surfaces rather than one — a global EntityClass list (the Hermes beta, shipped through G8) and a per-class management surface that hosts the sub-managers (the EntityClass-management beta, drafting). See `beta_implementation_plan_entity_class_management.md`. Strategic premise unchanged.*

*Amended 2026-05-29 (development/ level re-map): Phase 3 is divided directly into four sibling **betas** of alpha — Hermes, EntityClass management, Chronos, and the (parallel-track) World-OOP-tree. An earlier same-day pass mislabeled these as gammas under a hollow "phase-3 control plane" container beta; that container was removed and the four re-parented directly to alpha (level = distance from the root, not the kind of thing). This decomposition also covers Phase 2 — the business-class scaffold is the World-OOP-tree beta — built interleaved with Phase 3. See `README.md` + `plans_index.md`.*

*Amended 2026-05-29 (Apollo node port — strategic): Apollo is being reimplemented as a **Node + Fastify service now**, not post-MVP. It sits on the launch critical path (ingest → Apollo stores → Data-Pocket export → Next.js), so the "Laravel CCC used as-is" premise AND the "Apollo Node.js port = post-MVP" boundary are both retired. Built incrementally alongside Athene, slice by slice — slice 1 = World + Entity Classes + Attribute Set Versions. The Apollo feature section + Phase 1 below now target node-Apollo. See `beta_implementation_plan_apollo.md`.*

*Amended 2026-06-02 (schema-concept build order — strategic): the order in which the remaining schema concepts are built is now **canonicalized** (agreed with Daniel). Principle: **complete a class's full definitional surface before instantiating objects against it.** Order: attributes ✓ → traits ✓ → **composition → relations → taxonomies → Class Versions → objects → Data-Pocket export**. A Class Version is the binding manifest (it selects coherent versions of attribute-set + trait-versions + composition-scheme), so it **cannot precede** a complete schema surface — which retires the earlier "Class Versions next" assumption. The canonical, rationaled sequence lives in `beta_implementation_plan_apollo.md` § "Canonical slice order"; `plans_index.md` surfaces it. Each concept is a full vertical (Apollo slice + World-tree subtree + Hermes/Chronos instances), as the Traits feature beta was.*

---

## What this plan is

The master coordinating document for the Singularity Engine MVP. Captures the shipping condition, the in-scope feature inventory, the explicit out-of-scope boundary, the phased work sequence, dependencies, parallel tracks, and risks. Each phase here will spawn its own beta plan as it becomes the active work block.

## What this plan is *not*

- Not a substitute for the architecture (`notes/architecture.md`), the conceptual model (`notes/conceptual-deep-dive.md`), or the history (`notes/history-and-motivation.md`). It assumes those.
- Not the detailed task breakdown — those live in beta plans.
- Not a delivery contract — phases are dependency-ordered; weekly framing is a forcing function, not a deadline.

---

## MVP shipping condition

**install-wp.com launches publicly with:**

1. ~400 plugins, ~300 themes, ~100 providers structurally modeled in Singularity Engine.
2. Each entity has its own canonical URL with rich structured content rendered in static HTML.
3. Five locales present (`/en/`, `/de/`, `/es/`, `/fr/`, `/hi/`). Skeleton metadata in all five at launch; deep content starts English and translates over weeks.
4. Cross-references between entities are rendered as HTML links (crawler-traversable).
5. JSON-LD structured data on every entity page.
6. `install-wp.com/guides/installation-guide` mounts the Jung-based interactive walkthrough.
7. Clear funnel paths from wp-prof content pages into the install guide.
8. Sitemap submitted to Google; LLMs and crawlers find the content from day one.

**The proving-ground bet:** structured-volume aggregation + visible source attribution + the Jung guide as conversion engine = GEO-driven traffic with affiliate-revenue capture.

---

## Feature inventory

P0 = must ship · P1 = ship if time allows · P2 = nice-to-have, cuttable.

### Apollo — backend (~~Laravel, unchanged stack~~ → **Node + Fastify, reimplemented incrementally** — see `beta_implementation_plan_apollo.md`)

*Amended 2026-05-29: the Laravel CCC is now the reference spec, not the shipping backend. The functionality below is reimplemented cleanly in node-Apollo, slice by slice, as Athene grows into each area.*

Existing functionality (the spec the node port reimplements): CRUD for Entity Classes, Attribute Set Versions, Traits, Composition Schemes, Composition Directives, Class Objects, Class Relations, Class Taxonomies; lifecycle management; JSON-tree storage.

New work:

- **P0 — Locale support on Class Objects.** Each Class Object carries multi-locale variants; API endpoints support locale-aware reads/writes.
- **P0 — Source attribution fields.** `source_url` + `last_fetched_at` as standard fields on Class Object meta.
- **P0 — Data-Pocket export endpoint.** Produces a versioned JSON snapshot of currently-active state for Next.js consumption.
- **P1 — Bulk-operation efficiency.** Verify the API handles ~4000 object creations efficiently. Add batch endpoint if needed.

### Athene — control plane (Electron + morpheus)

- **P0 — Apollo HTTP client.** Morpheus services wrapping Apollo's API.
- **P0 — Business-class scaffold (Jung-style architecture).** `inc/` tree: orchestrator class, EngineChild base, wrappers for each Apollo entity.
- **P0 — Schema authoring surfaces:**
  - Entity Class list + create/edit/delete
  - Attribute Set Version editor
  - Attribute editor
  - Trait list + editor — **✓ delivered** (Traits beta T3, `9748951`/`d6b5fb6`/`140fe0e`)
  - Trait Attribute Set Version editor — **✓ delivered** (Traits beta T3.3, `140fe0e`; the workbench Traits tab's two-level surface)
  - Composition Scheme Version editor — **✓ delivered** (Composition beta C3, `89826c4`; Chronos/CompositionSchemeVersion strip = Chronos E4)
  - Composition Directive editor — **✓ delivered** (Composition beta C3, `89826c4`; Hermes/CompositionDirective with the data-driven sub-class picker)
  - Class Object list + create/edit/delete
  - **Locale switcher for Class Objects**
  - Class Relation editor
  - Class Taxonomy editor
- **P0 — Lifecycle controls.** Draft → committed UI; visible status; commit actions.
- **P0 — Class Version creation.** Manual via "create new class version" action.
- **P0 — Data-Pocket publishing UI.** "Release current state" action triggers export, writes artifact to known path.
- **P0 — Source attribution display.** `source_url` + `last_fetched_at` visible per object, with refresh affordance.
- **P1 — Primitive AI chat panel.** Claude API integration; small set of hard-coded operations (chat about current entity, suggest content, help with translations, editorial review).
- **P2 — Bulk operations UI.** Multi-select + bulk edit. Cuttable.

### Ingestion Script — standalone Node.js tool

Lives separately (suggested: `/Users/daniel/Desktop/singularity-engine/scripts/wp-org-ingestion/`). Uses Apollo's HTTP API like any other client.

- **P0 — wp.org plugin directory fetcher** (wp.org REST API).
- **P0 — wp.org theme directory fetcher.**
- **P0 — Provider extraction** from plugin/theme author data.
- **P0 — Class Object mapping** to Apollo's API.
- **P0 — Locale generation pipeline.** Per object, translate metadata (title, short description, category labels) into the 5 locales via Claude API. Deep content stays English at launch.
- **P0 — Error handling + retry.**
- **P1 — Dedup logic** on re-run.
- **P1 — Progress reporting** (console + run log file).

### install-wp.com — Next.js consumer

Lives at `/Users/daniel/Desktop/singularity-engine/install-wp/` (suggested).

- **P0 — Locale routing** (Next.js i18n for en/de/es/fr/hi).
- **P0 — Per-entity SSG pages:** Plugin (`/plugin/{slug}`), Theme (`/theme/{slug}`), Provider (`/provider/{slug}`). All locale-aware.
- **P0 — Index/browse pages:** Plugins index (with categories), Themes index, Providers index.
- **P0 — JSON-LD structured data** on every entity page (schema.org types).
- **P0 — Sitemap.xml** + **robots.txt**.
- **P0 — Cross-reference HTML links** between entities.
- **P0 — Funnel paths to /guides/installation-guide.**
- **P0 — Data-Pocket consumption at build time.**
- **P0 — Mount point for the morpheus subapp at /guides/installation-guide.**
- **P1 — Hreflang tags** for locale variants.
- **P1 — Open Graph metadata.**
- **P2 — Search within wp-prof.**

### The Morpheus Subapp (Jung guide)

- **P0 — Configure to mount under /guides/installation-guide.** Path prefix change from current root mounting.

Content, graph, behavior stay unchanged for MVP. Hand-authored Jung graph remains in-app data, not in Singularity Engine.

### Shared concepts / artifacts

- **P0 — Data-Pocket format definition.** Documented in `notes/data-pocket-format.md` (to be drafted in Phase 5).
- **P0 — Locale model concretization.** Concrete schema for how Class Objects carry locale variants.
- **P0 — Source attribution model concretization.** Field shapes + refresh affordance.

---

## Explicit out-of-MVP

Hold this list strict to prevent scope creep.

- ~~Apollo Node.js port (post-MVP)~~ — **moved in-scope 2026-05-29**: Apollo is built in node from the start, on the critical path (see `beta_implementation_plan_apollo.md`)
- Full morpheus AI layer / Axis 2 (post-MVP framework work)
- Data Sources as a first-class primitive (just a script for MVP)
- AI gate-keeper agents at the release boundary
- Authentication (engine stays local; not exposed)
- Class Condensation / Decomposition
- Universal Traits
- Forward-Reference Composition Directives
- Attribute Groups
- Sophisticated provenance tracking beyond `source_url` + `last_fetched_at`
- Multi-product publishing (one product: install-wp.com)
- Analytics, A/B testing
- Class Object Structure Versioning beyond basic shape
- Formal test suites (smoke testing during dev is enough)
- Multilingual *deep* content at launch (skeleton multilingual is in scope; deep translation is post-launch incremental work)

---

## Phases

Dependency-ordered. Beta plans drafted as each phase becomes active. Rough timing is a forcing function, not a deadline.

### Phase 1 — Apollo foundation updates

**Goal:** Apollo's API supports the new data-model needs (locales, source attribution, data-pocket export).

**Deliverables:**
- Locale-aware Class Object read/write endpoints.
- `source_url` + `last_fetched_at` as standard Class Object meta fields.
- `POST /content_class/{cid}/class_object_manager/{oid}/refresh-source` (or similar) — placeholder for the refresh affordance; backend logic can be stubbed for MVP.
- Data-Pocket export endpoint: returns the currently-active state as a structured JSON document.

**Acceptance:**
- Test request creates a Class Object with locales + source attribution; round-trip read returns identical state.
- Test request to the data-pocket export endpoint returns a JSON document with the expected entities, locales, attribution.

**Estimated effort:** ~3 days.

### Phase 2 — Athene business-class scaffold

**Goal:** Athene has the OOP layer mirroring Apollo's entities, in Jung-style architecture.

**Deliverables:**
- `inc/SingularityEngine.js` orchestrator class (analogous to Jung).
- `inc/EngineChild.js` base class (analogous to JungChild).
- Entity wrappers under `inc/entities/`: EntityClass, AttributeSetVersion, Trait, TraitAttributeSetVersion, CompositionSchemeVersion, CompositionDirective, ClassVersion, ClassObject, ClassRelation, ClassTaxonomy.
- Apollo HTTP client service in `inc/services/ApolloClient.js`.
- Initial signal/kernel integration so entities wrap kernel signals.

**Acceptance:**
- From a placeholder UI in Athene, can fetch and display all current Entity Classes from Apollo (the existing organization/person/plugin/etc.) via the business-class API.
- The morpheus app's `moduleProps` expose the entity tree following the Jung pattern.

**Estimated effort:** ~3 days.

### Phase 3 — Athene schema authoring UI

**Goal:** Athene has UI surfaces for creating, reviewing, and editing all entity types, including locale-aware Class Object editing.

**Deliverables:**
- All schema-authoring surfaces listed in the feature inventory.
- Lifecycle controls (draft/committed visibility + commit action).
- Class Version manifest creation UI.
- Locale switcher in the Class Object editor.
- Source attribution panel on Class Objects.
- Data-Pocket publishing UI ("release current state" button).

**Acceptance:**
- Can manually create an Entity Class, add attributes, define a Trait with its own attribute set, write a composition directive, create a Class Object with locale variants — all through the UI.
- Lifecycle states are visible and commitable.
- Clicking "release" produces a Data-Pocket JSON file at the expected path.

**Estimated effort:** ~4–5 days. Largest phase by scope.

### Phase 4 — Ingestion script + first run

**Goal:** wp.org data is structured and loaded into Apollo, in 5 locales (skeleton translations).

**Deliverables:**
- Node.js script in `/scripts/wp-org-ingestion/`.
- Fetches wp.org plugin directory (target: ~400 plugins).
- Fetches wp.org theme directory (target: ~300 themes).
- Extracts provider data (target: ~100 unique providers).
- Maps each entry to Class Object creation requests.
- Generates skeleton locale translations via Claude API (titles, short descriptions, category labels).
- Pushes everything through Apollo's HTTP API.

**Acceptance:**
- Apollo contains the expected entity counts post-run.
- Sampled entities viewable in Athene's UI; locales switch correctly; source attribution visible.
- Run log shows successes, retries, any failures.

**Estimated effort:** ~3 days. Can begin while Phase 3 is in progress; full run waits for Phase 3 acceptance (so Athene UI can validate ingested entities).

### Phase 5 — Data-Pocket publishing flow

**Goal:** Athene-triggered publishing produces a Data-Pocket consumable by Next.js.

**Deliverables:**
- `notes/data-pocket-format.md` — the schema for the JSON artifact.
- Athene "release" action calls Apollo's export endpoint and writes the JSON to a known path (suggested: `/Users/daniel/Desktop/singularity-engine/data-pockets/install-wp-current.json`).
- Version-stamped artifacts archived alongside the current one (suggested: `/data-pockets/install-wp-v{N}.json`).

**Acceptance:**
- Clicking "release" in Athene produces a complete, valid JSON file at the expected path.
- Re-releasing produces a new versioned file; the "current" file is updated.

**Estimated effort:** ~1–2 days.

### Phase 6 — Next.js consumer with locale routing + SSG

**Goal:** install-wp.com renders the wp-prof content as static HTML across 5 locales.

**Deliverables:**
- Next.js project at `/Users/daniel/Desktop/singularity-engine/install-wp/`.
- i18n routing for en/de/es/fr/hi.
- Per-entity SSG pages (Plugin, Theme, Provider) with locale variants.
- Index/browse pages.
- JSON-LD structured data per page.
- sitemap.xml + robots.txt.
- Cross-reference HTML links between entities.
- Build-time consumption of the Data-Pocket JSON.
- Funnel CTAs into the install guide.

**Acceptance:**
- `npm run build` produces a static site with all entities present across all locales.
- sitemap.xml lists every URL.
- View-source on a plugin page shows full structured content + JSON-LD.
- Internal links resolve correctly across locales.

**Estimated effort:** ~3–4 days.

### Phase 7 — Mount morpheus subapp + integration

**Goal:** Jung's install walkthrough serves at `/guides/installation-guide` within install-wp.com's Next.js shell.

**Deliverables:**
- Morpheus subapp configured to mount at `/guides/installation-guide` path prefix.
- Build pipeline integrates the morpheus subapp's output into Next.js (or Next.js routes proxy to it — exact mechanism TBD in Phase 7's beta plan).
- Funnel paths from wp-prof entity pages → install guide work end-to-end.

**Acceptance:**
- Browsing a plugin page → clicking "Install WordPress" → landing on `/guides/installation-guide` → completing a path (e.g., Local → MAMP) all works as a user journey.

**Estimated effort:** ~1–2 days.

### Phase 8 (parallel, opportunistic) — Primitive AI chat in Athene

**Goal:** Athene has a chat panel for editorial review of ingested data.

**Deliverables:**
- Chat UI in Athene.
- Claude API integration via Electron main process (API key in env).
- Small set of hard-coded operations: chat about current entity, suggest content modifications, generate translation drafts, flag suspect content.

**Acceptance:**
- Can have a productive conversation with Claude about a Class Object's metadata.
- Can apply a suggested change through the chat to update the entity via Apollo's API.

**Estimated effort:** ~3–4 days, scattered across phases 3–7 as time allows. Not a launch-blocker; the MVP can ship without this if it isn't ready.

### Phase 9 — Launch

**Goal:** wp-prof content live, install guide accessible, public.

**Deliverables:**
- Deploy install-wp.com (hosting decision: probably Vercel or similar Next.js-friendly host).
- Submit sitemap to Google Search Console.
- Verify all paths work in production.
- Initial monitoring (basic uptime + access logs).

**Acceptance:**
- A new visitor can reach a plugin page in any of 5 locales, read structured content, click through to the install guide, and complete a Jung walkthrough.

**Estimated effort:** ~1 day, assuming hosting/deployment is straightforward.

---

## Critical path

The minimum sequence that must happen in order:

```
Phase 1 (Apollo updates)
    ↓
Phase 2 (Athene scaffold)
    ↓
Phase 3 (Athene authoring UI)  ←─── starts before Phase 4 finishes
    ↓
Phase 4 (Ingestion run)        ←─── relies on Phase 1 (API) + Phase 3 (validation)
    ↓
Phase 5 (Data-Pocket publish)
    ↓
Phase 6 (Next.js consumer)
    ↓
Phase 7 (Mount morpheus subapp)
    ↓
Phase 9 (Launch)
```

## Parallel tracks

- **Phase 4 (ingestion script writing)** can begin during Phase 2/3 — the script's structure can be written before the full run, which waits for Phase 3 acceptance.
- **Phase 8 (AI chat)** is opportunistic; scattered across phases 3–7 as time allows.
- **Documentation updates** (especially `notes/data-pocket-format.md` in Phase 5) can happen alongside their phase.

---

## Rough three-week sequencing

A forcing function, not a contract:

- **Week 1:** Phase 1 (Apollo updates) + Phase 2 (Athene scaffold) + Phase 3 begins.
- **Week 2:** Phase 3 completes + Phase 4 (ingestion script writing + first run) + Phase 5 (publishing flow).
- **Week 3:** Phase 6 (Next.js consumer) + Phase 7 (mount morpheus subapp) + Phase 9 (launch). Phase 8 scattered if time.

If a phase slips, the sequencing absorbs the slip without changing the dependency order.

---

## Risks and unknowns

Things to watch:

- **Apollo's existing data model may not cleanly support locales.** The docs reference locales conceptually; the implementation may need more than minor changes. If Phase 1 reveals deeper restructuring is needed, Phase 1 expands and downstream phases compress. Mitigation: investigate first, then commit to a Phase 1 beta plan.

- **wp.org API rate limits or data quality issues.** The ingestion script may hit rate limits, throttling, or unexpectedly malformed data. Mitigation: build retry/backoff into the script from the start; budget time for data-quality cleanup.

- **Claude API translation cost.** ~4000 entities × 4 non-English locales × short translation each = ~16,000 API calls for skeleton translations. Cost should be modest but not zero. Mitigation: estimate cost up-front; batch where possible.

- **Next.js + morpheus subapp mounting mechanics.** Mounting a built morpheus app inside Next.js at a path prefix may need experimentation. Mitigation: prototype this in Phase 7's beta plan early.

- **Translation quality.** Bad skeleton translations may hurt more than help. Mitigation: review a sample of translated entities post-Phase 4; gate launch on quality being acceptable.

- **MVP scope creep.** Every phase has natural pull toward "while we're here, let's also add..." Mitigation: hold the out-of-scope list strictly. New requirements get parked into a post-MVP backlog, not absorbed into the current phase.

---

## Beta plan conventions

When a major division of alpha becomes the active work block — a subsystem, a major bet, or a phase — draft a beta plan for it:

- File: `development/beta_implementation_plan_{topic}.md` *(amended 2026-05-29: plans live in `development/`, not `notes/`; betas are named by topic / major-bet — not by phase number — since a beta is any direct division of alpha, not necessarily 1:1 with a numbered phase)*
- Examples: `beta_implementation_plan_hermes.md`, `beta_implementation_plan_world_oop_tree.md` (a parallel-track beta), a future `beta_implementation_plan_ingestion.md`
- Each beta plan contains: detailed task breakdown, the agent prompt(s) to forward (if delegating), specific acceptance criteria, decisions made during the phase, blockers encountered.

Beta plans are *living documents during their phase* — updated as decisions are made and tasks complete. After a phase ships, the beta plan freezes as historical record.

---

## Pointers

- Architecture: `notes/architecture.md`
- Conceptual model: `notes/conceptual-deep-dive.md`
- History & motivation: `notes/history-and-motivation.md`
- Setup prompts for agents: `notes/prompts.md`
