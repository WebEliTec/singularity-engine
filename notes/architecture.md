# Singularity Engine — Architecture (Current Target)

*Snapshot of the architectural decisions reached as of 2026-05-27. This is the shape we are building toward, not a finished specification. Updates expected as we move into implementation.*

---

## The system, named

**Singularity Engine** is the overall private system for domain-modeling, content authoring, and structured-data publication. It is composed of two subsystems with distinct, complementary roles:

- **Athene** — the active control plane. The morpheus + Electron desktop application where humans and agents work together. The sole legitimate client of Apollo's API. The agentic runtime environment.

- **Apollo** — the structured world model. The Node.js backend that holds the canonical representation of the domain being curated (initially WordPress) — schema, versions, history, relations, taxonomies. Accessible only through its HTTP API.

The pairing reflects the architectural relationship. Apollo holds the structured truth of the domain — the world model, accessible only through proper protocol. Athene is the active wisdom that consults Apollo's model, weaves new versions through deliberation with humans and agents, and ships them into the public world through the distribution layer.

Both subsystems are private — never exposed directly to the public internet. The public-facing world consumes only **Data-Pockets**: versioned, structurally-coherent snapshots that Athene publishes from Apollo's current state.

---

## Trust zones

```
                  PRIVATE ZONE (Singularity Engine)
   ┌─────────────────────────────────────────────────────────┐
   │                                                          │
   │   ┌──────────────┐         ┌──────────────┐            │
   │   │              │   HTTP  │              │            │
   │   │   ATHENE     │ ──────► │    APOLLO    │            │
   │   │              │ ◄────── │              │            │
   │   │ Electron app │         │ Node.js + DB │            │
   │   │ + Morpheus   │         │ + HTTP API   │            │
   │   │              │         │              │            │
   │   │ Humans       │         │ Schema       │            │
   │   │ Agents       │         │ Versions     │            │
   │   │ Master AI    │         │ History      │            │
   │   │              │         │ Relations    │            │
   │   └──────┬───────┘         └──────────────┘            │
   │          │                                               │
   │          │ publishes                                     │
   │          ▼                                               │
   │   ┌──────────────┐                                      │
   │   │ DATA-POCKETS │  (versioned JSON / Supabase)         │
   │   └──────┬───────┘                                      │
   │          │                                               │
   └──────────┼─────────────────────────────────────────────┘
              │
              ▼  (read-only)
   ┌─────────────────────────────────────────────────────────┐
   │                                                          │
   │              PUBLIC ZONE (consumer apps)                 │
   │                                                          │
   │   wp-prof.com   |   install-wp   |   (future products)  │
   │                                                          │
   └─────────────────────────────────────────────────────────┘
```

---

## Athene — the control plane

**Stack:** Electron + morpheus + React.

**Role:** the active control plane for Singularity Engine. The only legitimate client of Apollo's API. The workspace where humans, autonomous agents, and (eventually) a verbal master AI collaborate.

### Responsibilities

- **Schema authoring** — visual editing of ContentClasses, AttributeSetVersions, Traits, Composition Scheme Versions, Composition Directives, Class Objects, Class Relations, Class Taxonomies.
- **Lifecycle management** — draft → committed → active transitions for every versioned resource.
- **Distribution control** — managing Data-Pockets, Products, Pocket Bindings, Release operations.
- **Agent hosting** — providing the runtime environment where external agents (Claude Code etc.) operate against the engine.
- **Human-agent interaction** — chat surface, dialog system, eventually voice.
- **Version-drift observability** — at-a-glance view of which Products are on which content versions.

### Why Electron from day one

- **Direction A** (agents drive Athene via the morpheus AI layer, when that layer lands) requires always-on; Electron provides it.
- **Direction B** (Athene spawns external agents like Claude Code) requires `child_process.spawn`; only Electron's Node-side process gives this.
- **Privacy** — the engine never leaves the local machine or private server.
- **Filesystem access** for data-pocket writes, agent file I/O, configuration.

### Authority

Athene does *not* own state. Apollo does. Athene caches state for UI responsiveness, but every mutation is an API call to Apollo. The kernel signals in the morpheus app reflect Apollo's current state; they are not the source of truth.

---

## Apollo — the world model

**Stack:** Node.js + (initially) JSON-tree file storage. Future: SQLite or Postgres remain options.

**Role:** the structured world model. Holds the canonical representation of the domain being curated. Enforces all invariants of the schema: versioning, lifecycle transitions, cascade rules, relations, atomicity. Never exposed publicly.

### Responsibilities

- **Persistence** — store and retrieve all schema, all versions, all history, all relations.
- **Validation** — enforce schema invariants; reject malformed mutations.
- **Lifecycle enforcement** — control draft / committed / active transitions per resource.
- **Audit** — log every mutation with attribution, intent, timestamp.
- **API surface** — the HTTP boundary through which Athene operates.

### Storage discipline

The JSON-tree storage (carried over conceptually from the Laravel-era backend) is the canonical representation. Even if a database is later introduced, the JSON-tree shape remains the model's mental form. Storage backend is implementation detail; the structured JSON snapshot is the authoritative artifact.

### Migration

The current Laravel implementation (content-creation-center) is being replaced by a Node.js implementation. The data model and API contracts are carried forward; only the runtime changes. Estimated effort: 1–2 days.

### Invariant (load-bearing)

Agents and humans **NEVER** write directly to Apollo's storage. Every mutation goes through the HTTP API, which enforces all invariants. The API is the only door. This rules out:
- MCP servers that expose file-system access to Apollo's JSON tree.
- Agent processes inside Apollo with direct DB/file access.
- Direct database queries from any client other than Apollo itself.

---

## The Data-Pocket distribution system

**Form:** versioned, structurally-coherent JSON files (optionally mapped to Supabase tables for query workloads).

**Content:** active state only — the currently-active schema and its content as of the release. Historical versions are NOT included by default (they remain in Apollo; can be optionally exposed if needed).

### Distribution primitives (engine-level, not Content Classes)

- **DataPocket** — instance of a published artifact. Identity, current version, storage location, bound content version.
- **Product** — a consumer application the engine serves. wp-prof.com, install-wp, future siblings. Identity, descriptor, domain.
- **PocketBinding** — the link between a Product and a DataPocket.
- **Release** — the *act* of promoting Apollo's current state to a specific Pocket as a specific version. Carries provenance (who triggered it; eventually: which AI gate-keeper approved it).
- **ReleasePolicy** — the rules governing what constitutes a valid release. The natural seat for AI gate-keeper review.

These are first-class engine primitives, **peer to** content primitives, *not* modeled as ContentClasses. They reference content versions; content does not reference them. The dependency is one-way (distribution → content).

### Version-drift as visible state

Because content evolves rapidly, the binding between Products and content versions is *cheap to update* and *easy to observe*. A Pocket pointing at a stale version isn't a bug — it's a state to see and decide about. Athene exposes a **version-drift view** as a first-class affordance.

---

## Agent integration

Two complementary directions:

### Direction A — agents drive Athene

Through the morpheus AI layer (Axis 2 — yet to be implemented as a morpheus framework feature). When that layer ships, Athene's exposed kernel methods become natively agent-callable. Every morpheus app will inherit this property; Athene gets it automatically as a morpheus update — no rework required.

Until then: a **primitive in-Athene chat panel** with hard-coded operations. Sufficient for early agent integration; will be replaced by the framework feature when it arrives.

### Direction B — Athene drives external agents

Athene spawns external CLI agents (Claude Code etc.) through Electron's `child_process.spawn`. The agent runs as a subprocess; results stream back to Athene's UI. Available from day one of the Electron build.

Both directions converge on the same trust boundary: **agents are clients of the engine through Athene, never residents of Apollo.**

---

## The two-axis AI architecture

Singularity Engine inherits morpheus's two-axis AI support:

| Axis | Audience | Surface |
|---|---|---|
| **1: Build-time** | Agents writing morpheus / Singularity Engine code (Claude Code, Cursor-style) | Full framework awareness — moduleProps, kernel fragments, registries, Diagnostics, morphDocs |
| **2: Runtime** | Agents *operating* the running Singularity Engine | Only Athene's domain primitives — ContentClasses, Traits, Compositions, DataPockets, Products. No morpheus internals. |

Axis 1 is supported today (morphDocs + Diagnostics). Axis 2 is the layer the morpheus AI feature will provide; until it exists as a framework feature, a primitive in-Athene equivalent serves.

---

## Tech stack summary

| Component | Stack |
|---|---|
| Athene runtime | Electron + Chromium |
| Athene framework | Morpheus (React-based meta-framework) |
| Athene → Apollo transport | HTTP / JSON |
| Apollo runtime | Node.js |
| Apollo storage | JSON-tree files (initial); future: SQLite/Postgres optional |
| Data-Pocket form | Structured JSON files (optionally Supabase tables) |
| Consumer apps | Stack-agnostic (read Data-Pockets only) |
| External-agent integration | `child_process.spawn` from Athene (Claude Code etc.) |
| Internal AI surface (future) | Morpheus AI layer (Axis 2) — framework-level, yet to be implemented |

---

## Sequencing (current target)

1. **Stand up Electron + morpheus shell for Athene.** ~1 day.
2. **Migrate Apollo (content-creation-center) from Laravel to Node.js.** 1–2 days.
3. **Rebuild Athene's schema-authoring surface against Apollo.** First major work block — feature parity with content-management-hub, in morpheus patterns.
4. **Add primitive in-Athene AI integration** — chat panel + Claude API or Claude Code subprocess, hard-coded operations.
5. **Add Data-Pocket distribution primitives** to Athene; wire up the publish flow.
6. **Start producing structured WordPress plugin and theme data** as soon as schema authoring works end-to-end.
7. **Wire install-wp to consume the Data-Pocket** as soon as a first version exists.
8. **Target: structured WordPress plugin/theme data published within ~3 weeks** to support install-wp's launch.

Post-MVP: the full morpheus AI layer (Axis 2) lands as a morpheus framework update; Athene inherits it. Singularity Engine extends to additional domains beyond WordPress. AI gate-keeper agents take a seat at the release boundary.

---

## What this architecture is for

The point of Singularity Engine is not to be a CMS or a schema editor. It is to be a **private deterministic publishing platform** with a strong AI agency story — a place where structured knowledge of arbitrary domains is curated, versioned, and published in forms LLMs can natively ingest.

The proving ground is **wp-prof** (the curated WordPress knowledge base, GEO-positioned) and **install-wp** (the WordPress installation guide built with Jung). If these prove the substrate, the same platform extends to other domains.

### The architectural bets — all load-bearing

1. **Recursive versioning as a first-class invariant** — schemas-of-schemas tracked with the same discipline as content.
2. **API-only mutation discipline** — agents are clients, not residents; the API is the only door to Apollo.
3. **Athene as sole control plane** — one substrate for humans and agents, no out-of-band channels.
4. **Two-axis AI architecture** — build-time agents see morpheus; runtime agents see only Athene's domain surface.
5. **Private engine + public data-pockets** — the engine's internals never leak; only structured published artifacts cross the boundary.

Compromise on any one and the system's distinctive properties degrade.
