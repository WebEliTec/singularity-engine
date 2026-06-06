# Singularity Engine — Plan Index

*This project's live index of implementation plans. For **how** the
planning system works — levels, upward propagation, lifecycle — see
[`README.md`](README.md). Cold readers: start at `README.md` for the
rules; start **here** for what plans currently exist and where each sits
in the graph.*

*Last updated: 2026-06-03*

*Governance peer — `../model/`: the canonical, **versioned prescriptive model**
(Structure · Invariants · Dynamics; established 2026-06-03, reorganised into the
versioned `model/` 2026-06-04). `development/` answers *how we plan*; `model/`
answers *what the system IS*. Reference material, not a plan (it carries its own
`README.md`) — noted here so cold readers find it.*

---

## Active

The structure is **α → β** (no γ level yet). The active betas are *direct
divisions of alpha*, peers of each other — **five subsystem-oriented** plans
(Hermes, EntityClass-management, Chronos, World-OOP-tree, Apollo) plus **one
active feature-oriented** beta (**Composition** — the next slice in the canonical
order). The first feature beta (Traits — which *composed* the subsystems rather
than owning one) shipped end-to-end and is now **archived** (see below);
Composition follows the same feature-beta pattern. A feature that cuts across
subsystems is still one level below alpha — level is graph position, not
kind-of-thing. Phase IDs (`G*`/`D*`/`E*`/`I*`/`A*`/`T*`/`C*`) are frozen
git-commit labels, **not** abstraction levels.

| File | Level | Scope |
|---|---|---|
| `alpha_implementation_plan.md` | **α** | MVP shape, shipping condition, in/out boundary |
| `beta_implementation_plan_hermes.md` | **β** | Hermes — generic config-driven CRUD engine (morpheus node) — G1–G9 |
| `beta_implementation_plan_entity_class_management.md` | **β** | Per-EntityClass management surface + app shell — D1–D10 |
| `beta_implementation_plan_chronos.md` | **β** | Chronos — generic version-management engine — E1–E5 |
| `beta_implementation_plan_world_oop_tree.md` | **β**, `track: parallel` | World OOP tree — app/ domain-layer refactor — I1–I4 |
| `beta_implementation_plan_apollo.md` | **β** | Apollo — node (Fastify) backend, reimplementing the CCC incrementally; **the slice driver** (its § "Canonical slice order" is the project's roadmap); slice 1 = World + Entity Classes + ASVs — A1–A5 done |
| `beta_implementation_plan_composition.md` | **β** (feature) | Composition — class-owned, separately-versioned bags of Composition Directives; full vertical (Apollo + World tree + `Hermes/CompositionDirective` + `Chronos/CompositionSchemeVersion` [E4] + Composition tab) — C1–C3 — **COMPLETE ✓** (2026-06-02; `1b364ed`/`0ae8f4a`/`89826c4`; ready to archive) |

All six active betas declare `parent: alpha_implementation_plan.md`
(Apollo is the backend + the slice driver; four are the Athene-side subsystems
it serves — CCC retired slice by slice as Apollo reaches parity; **Composition**
is the active feature beta). Future schema concepts (Relations, Taxonomies, Class
Versions, Objects) each ship as a **feature beta** like Traits + Composition —
spawned when it becomes the active work block, in the canonical slice order
(below). **There is no γ level yet** — a gamma appears only when a beta
sub-decomposes into its own phased plans. (The Hermes beta sketches uncommitted
future gamma children — "Gamma-Inputs", "Gamma-RemainingManagers", etc. — which
would be the project's first real gammas if drafted.)

## Roadmap — canonical build order

The order the remaining schema concepts are built (agreed 2026-06-02). The full
rationale + per-slice detail lives in `beta_implementation_plan_apollo.md`
§ "Canonical slice order"; this is the one-line map. **Principle: complete a
class's full *definitional* surface before instantiating objects against it.**

> attributes ✓ → traits ✓ → **composition** → relations → taxonomies → class versions → objects → Data-Pocket export

Each is a full vertical (Apollo slice + World-tree subtree + Hermes/Chronos
instances). **Composition is IN PROGRESS** (`beta_implementation_plan_composition.md`,
active — design locked 2026-06-02, executing C1; also delivers Chronos **E4**).
(This retires the earlier "Class Versions next" framing: a Class Version binds
coherent versions of the schema concepts, so it cannot precede them.)

## Archive

| File | What it produced | Archived |
|---|---|---|
| `archive/beta_implementation_plan_traits.md` | **First feature beta** (T1–T3.4): Traits end-to-end — Apollo trait routes (owner-generalized ASV/attribute domain) + World-tree `traits/` subtree + `Hermes/Trait` + `Hermes/TraitAttribute` + `Chronos/TraitAttributeSetVersion` + the two-level Traits tab + the generic `viewAction` capability. Fulfilled Chronos E5, World-OOP-tree's first I4+ subtree, Apollo's first post-slice-1 entry, alpha's Trait-authoring P0. Deferred frontend halves → `deferred_frontend_security.md`. | 2026-06-02 |
| `archive/beta_implementation_plan.md` | First proving vertical slice (B1–B5): Athene singleton + Apollo wiring + first node | 2026-05-28 |
| `archive/gamma_g4_sketch.md` | G4 edit-mode design (working copy + first Apollo write path) | 2026-05-28 |
| `archive/delta_d7_sketch.md` | D7 EntityClassWorkbench shell design | 2026-05-28 |
| `archive/theta_implementation_plan_hermes_oop.md` | OOP migration (T1–T7) — a legacy parallel-track refactor (would now be a β with `track: parallel`) — deleted, not archived | (deleted prematurely; see commit `5cf0a94`) |

---

## Legacy → corrected mapping

The Greek letter was originally used as a **time counter**, so each new
work block took the next letter (β→γ→δ→ε) and parallel refactors took
skip-letters (θ, ι). It took **two correction passes on 2026-05-29** to
land the right structure:

- **Pass 1** declared letters = level, but mechanically collapsed δ/ε/ι →
  **γ** and invented a hollow `beta_…_phase_3_athene_authoring_ui.md`
  container to parent them. That container had no plan content of its own
  — the tell that it wasn't a real level.
- **Pass 2** (final) corrected it: a plan's level is its **distance from
  the root**, not the kind of thing it is. The four subsystem plans are
  *direct divisions of alpha*, so they are **betas**. The container was
  **deleted** and the four re-parented to `alpha`. No γ level remains.

| Current file | Was | Level | `parent:` |
|---|---|---|---|
| `alpha_implementation_plan.md` | α | **α** | none — root |
| `archive/beta_implementation_plan.md` | β | **β** | α (archived/frozen) |
| `beta_implementation_plan_hermes.md` | γ (orig.) → γ (pass 1) | **β** | α |
| `beta_implementation_plan_entity_class_management.md` | δ → γ (pass 1) | **β** | α |
| `beta_implementation_plan_chronos.md` | ε → γ (pass 1) | **β** | α |
| `beta_implementation_plan_world_oop_tree.md` | ι (skip = parallel) → γ (pass 1) | **β** + `track: parallel` | α |
| ~~`beta_…_phase_3_athene_authoring_ui.md`~~ | container (pass 1) | — | **removed** in pass 2 |

Phase IDs (`G*`/`D*`/`E*`/`I*`) were kept as frozen labels — they trace to
the git commits that landed each phase. The `development-framework` and
`planning-state` memories are reconciled. **One** downstream reference is
intentionally left as-is: the **`epsilon` git branch name** (and the
`iota` branch) — work-labels, not plan letters; rename at a clean
checkpoint if desired.
