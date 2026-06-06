# Singularity Engine — MVP Feature Inventory

*Drafted 2026-05-27. Captures the agreed MVP feature scope for the Singularity Engine + wp-prof content + install-wp.com launch. The implementation plan with phased sequencing and acceptance criteria is the next artifact (`implementation-plan.md`); this document is the feature backbone it builds on.*

*Priorities: **P0** = must ship; **P1** = ship if time allows; **P2** = nice-to-have, cuttable.*

---

## MVP shipping condition

install-wp.com launches with:
- A Next.js-based public site serving rich, structured wp-prof content (plugins, themes, providers) with build-time SSG and multilingual coverage in 5 locales.
- The Jung-based interactive installation guide mounted at `/guides/installation-guide`.
- Content sourced from a Data-Pocket published by Singularity Engine (Athene + Apollo).
- ~400–500 plugins, ~300 themes, ~100 providers ingested from wp.org.
- All 5 locales (English, German, Spanish, French, Hindi) present at launch with skeleton metadata translations; deeper translations roll out over weeks (**Option D** — skeleton multilingual at launch, deepen over time).

---

## Apollo — backend (Laravel, unchanged stack for MVP)

Existing functionality used as-is: CRUD for Content Classes, Attribute Set Versions, Traits, Composition Schemes, Composition Directives, Class Objects, Class Relations, Class Taxonomies; lifecycle management; JSON-tree storage.

**New work:**

- **P0 — Locale support on Class Objects.** Each Class Object carries multi-locale variants. The existing data model references locales conceptually; the API endpoints need locale-aware reads/writes concretely.
- **P0 — Source attribution fields.** `source_url` + `last_fetched_at` as standard fields on Class Object meta.
- **P0 — Data-Pocket export endpoint.** Produces a versioned JSON snapshot of currently-active state for Next.js consumption.
- **P1 — Bulk-operation efficiency.** Verify the API handles 800 × 5 = 4000 object creations within reasonable time. Add a batch endpoint if needed.

**Out of MVP:** Node.js port of Apollo (post-MVP; runs as Laravel for this launch).

---

## Athene — the control plane (Electron + morpheus)

- **P0 — Apollo HTTP client.** Morpheus services wrapping Apollo's API.
- **P0 — Business-class scaffold (Jung-style architecture).** The `inc/` tree: orchestrator class, `EngineChild` base class, wrappers for each Apollo entity.
- **P0 — Schema authoring surfaces:**
  - Content Class list + create/edit/delete
  - Attribute Set Version editor (per class)
  - Attribute editor (per attribute set version)
  - Trait list + editor (per class)
  - Trait Attribute Set Version editor
  - Composition Scheme Version editor (per class)
  - Composition Directive editor
  - Class Object list + create/edit/delete
  - **Locale switcher** for Class Objects (view/edit per-language content)
  - Class Relation editor
  - Class Taxonomy editor
- **P0 — Lifecycle controls.** Draft → committed UI for the versioned resources. Visible status and commit actions.
- **P0 — Class Version creation.** Manual via a "create new class version" action that captures current resource versions into a manifest.
- **P0 — Data-Pocket publishing UI.** "Release current state" action that triggers Apollo's export and writes the artifact to a location Next.js consumes.
- **P0 — Source attribution display.** Show `source_url` + `last_fetched_at` on Class Objects, with a "refresh from source" affordance.
- **P1 — Primitive AI chat panel.** Claude API integration with a small set of hard-coded operations: chat about current entity, suggest content, help with translations, editorial review.
- **P2 — Bulk operations UI.** Multi-select + bulk edit (e.g., apply trait to N classes). Cuttable.

---

## Ingestion Script — standalone Node.js tool

Not part of Athene; a separate one-off tool that uses Apollo's HTTP API like any other client. (Pre-figures the future "Data Sources" primitive — see `conceptual-deep-dive.md` Section 11.)

- **P0 — wp.org plugin directory fetcher.** Uses the wp.org REST API.
- **P0 — wp.org theme directory fetcher.** Same for themes.
- **P0 — Provider extraction.** Aggregates unique authors / companies from plugin and theme data.
- **P0 — Class Object mapping.** Transforms each wp.org entry into Class Object create-requests through Apollo's API.
- **P0 — Locale generation pipeline.** For each Class Object, generate skeleton translations (title, short description, category labels) into the 5 locales via Claude API. Deep content stays English at launch and translates over weeks.
- **P0 — Error handling + retry.** Network failures, rate limits, malformed data shouldn't crash the run.
- **P1 — Dedup logic.** On re-run, update existing entries rather than duplicating.
- **P1 — Progress reporting.** Console log + run log file for later review.

**Out of MVP:** ingestion from additional sources beyond wp.org (wp-beginner, GitHub, ThemeForest, etc. — post-MVP).

---

## install-wp.com — Next.js consumer

- **P0 — Locale routing.** Next.js i18n routing for `/` (en), `/de/`, `/es/`, `/fr/`, `/hi/`.
- **P0 — Per-entity SSG pages.** Plugin (`/plugin/{slug}`), Theme (`/theme/{slug}`), Provider (`/provider/{slug}`). All locale-aware.
- **P0 — Index / browse pages.** Plugins index (with categories), Themes index, Providers index.
- **P0 — JSON-LD structured data** on every entity page. Schema.org types: `SoftwareApplication` for plugins / themes, `Organization` or `Person` for providers.
- **P0 — Sitemap.xml.** Lists every reachable URL across all locales. Submitted to Google Search Console.
- **P0 — robots.txt.** Standard, plus sitemap reference.
- **P0 — Cross-reference HTML links.** "Plugins by this Provider", "Other plugins in this Category", "Latest version: X" — rendered as `<a>` tags so crawlers traverse.
- **P0 — Funnel paths to `/guides/installation-guide`.** Clear CTAs from entity pages into the install guide.
- **P0 — Data-Pocket consumption at build time.** Build process reads the JSON and generates static pages.
- **P0 — Mount point for the morpheus subapp at `/guides/installation-guide`.**
- **P1 — Hreflang tags.** Tells search engines which URLs are locale variants of each other. Important for SEO; not a launch-blocker.
- **P1 — Open Graph metadata.** For social sharing. Not GEO-critical.
- **P2 — Search within wp-prof.** Browse-by-category covers most of the user need for MVP.

---

## The Morpheus Subapp (Jung guide)

- **P0 — Configure to mount under `/guides/installation-guide`.** Path prefix change from current root mounting.

That's it. Jung's content, graph, and behavior stay as-is. The hand-authored Jung graph remains in-app data, not in Singularity Engine for MVP.

---

## Shared concepts / artifacts

- **P0 — Data-Pocket format definition.** A documented JSON schema for the published artifact. Should land in `notes/data-pocket-format.md`.
- **P0 — Locale model concretization.** How Class Objects carry locale variants. Implemented in Apollo, exercised by Athene's UI and the ingestion script.
- **P0 — Source attribution model concretization.** `source_url` + `last_fetched_at` fields + the refresh affordance.

---

## Explicit out-of-MVP

To prevent scope creep:

- Apollo Node.js port (post-MVP)
- Full morpheus AI layer / Axis 2 (post-MVP framework work)
- Data Sources as a first-class primitive (planned; uses a script for MVP)
- AI gate-keeper agents at the release boundary
- Auth (engine stays local; not publicly exposed)
- Class Condensation / Decomposition
- Universal Traits
- Forward-Reference Composition Directives
- Attribute Groups
- Sophisticated provenance tracking beyond `source_url` + `last_fetched_at`
- Multi-product publishing (one product: install-wp.com)
- Analytics / A/B testing
- Class Object Structure Versioning beyond basic shape
- Formal test suites (smoke testing during dev is enough for MVP)
- Ingestion from sources beyond wp.org

---

## Implicit dependencies determining sequencing

1. **Apollo's locale + attribution updates** must precede the ingestion script (script depends on the API shape).
2. **Athene's business-class scaffold** must precede the authoring UI (UI consumes the scaffold).
3. **Athene's authoring UI** must work end-to-end before ingestion lands at scale (we need to validate ingested content is editable, locale switching works, etc.).
4. **The Data-Pocket export endpoint** must exist before the Next.js consumer can build.
5. **Next.js consumer** must exist before the morpheus subapp can mount at `/guides/installation-guide`.

Rough order this implies:
- Apollo schema updates →
- Athene scaffold + UI (parallel with ingestion script writing) →
- Ingestion run →
- Data-Pocket export →
- Next.js consumer + locale routing →
- Mount morpheus subapp →
- Integration testing + launch

This is the backbone for the phased implementation plan that follows in `implementation-plan.md` (to be drafted next).
