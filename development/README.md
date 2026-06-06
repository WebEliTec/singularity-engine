# Implementation Plans — A Planning Framework

*A portable framework for planning work as a **living graph** of plans at
nested abstraction levels. This file describes how plans are written,
nested, executed, and kept true. It is project-agnostic — drop it into any
project's `development/` folder unchanged; the plans next to it are its
applications.*

*This is a living document. It follows its own rules: amend it in place
when working with it reveals the framework needs adjustment.*

---

## The core idea: a living plan graph

Plans form a **graph** — a tree of abstraction levels, coarsest at the
root, finer toward the leaves. You **author** it top-down (the broad plan
first, then its divisions, then their subsystems). You **execute** it at
the leaves (the concrete phases).

The load-bearing property is that **the graph is never frozen while it's
active — it is reconciled after every implementation:**

> **Discovery flows downward; revision flows upward.** A plan is written
> by zooming in from its parent. But the act of *implementing* a leaf is
> also an act of *learning* — and whatever you learn is allowed to revise
> the levels **above** it. A low-level phase can amend its parent; a hard
> discovery can reshape a grandparent; a broken premise can force a change
> at the root.

So a plan graph is a hypothesis about how the work decomposes, continually
corrected by contact with reality. **Drift between levels is the defect**
the framework exists to prevent: the cold reader who opens the root plan
must find a root that is *still true*, even though the truth was discovered
three levels down. Only branches that have fully landed are frozen (see
*Lifecycle*); everything else stays live and answerable to what execution
teaches.

This is why the levels and the conventions below exist — they make the
graph cheap to keep honest.

---

## Levels — letters encode abstraction, never sequence

A plan lives at one **abstraction level**, named with a Greek letter.
Alpha is the coarsest; **each next letter is one level finer**. The letter
says *how zoomed-in this plan is* — nothing else.

| Letter | Resolution | Scope | How many |
|---|---|---|---|
| **Alpha (α)** | Coarsest — strategy, shipping condition, in/out boundary | The whole effort | Exactly **one** |
| **Beta (β)** | A major division of alpha — one phase / major bet / proving slice | One division | **n** |
| **Gamma (γ)** | A subsystem / feature family within a beta | One subsystem | **m** |
| **Delta (δ) onward** | A sub-plan of one gamma, only if that subsystem needs its own phased breakdown | One slice of one subsystem | as needed |

### The three rules that keep levels honest

1. **The letter is abstraction level only — and level is *distance from
   the root*, not the *kind* of thing the plan is.** Never sequence, never
   track. Alpha coarsest; each next letter one step finer. A "subsystem"
   that is a direct division of α is a **β**, not a γ; derive a plan's
   level from its position in the graph, never from the words "phase" or
   "subsystem." (This is the trap to avoid: collapsing peers to a deeper
   letter and inventing a hollow parent to hold them.)

2. **Multiplicity grows with depth: one α, several β, more γ.** A *second*
   plan at a level that already exists is a **sibling** — it reuses that
   level's letter and is distinguished by its `_{topic}` suffix. It is
   **not** the next letter. Two peers at one level are two of that letter
   (e.g. two betas), never "a beta and a gamma."

3. **`parent:` points exactly one level up.** A γ's parent is a β; a β's
   parent is α. This is the structural-integrity check: if you can't name a
   parent exactly one level up, the plan is at the wrong level — re-letter
   it.

### Ordering and parallelism are NOT the letter's job

These are the two things people are tempted to overload onto the letter.
Keep them in frontmatter, decoupled from level:

- **Time-ordering → `date` + `depends_on:`.** Plans are *written* roughly
  top-down, but a plan authored later at an already-established level
  **reuses that level's letter**. *When* you build a given γ has no bearing
  on *what letter* it gets. Build-order and cross-plan dependencies live in
  `depends_on:`.

- **Parallel / orthogonal tracks → `track: parallel`.** A refactor,
  investigation, or spike that runs alongside the main work is a plan at
  its **natural abstraction level** carrying a `track: parallel` flag — not
  a skipped letter. (A cross-cutting refactor of a subsystem is a gamma
  with `track: parallel`, not a new top-level letter.)

> If you find yourself reaching for the *next* letter just because time has
> passed, or *skipping* a letter to signal "this one's different" — stop.
> That's the letter trying to do a second job. Same level → same letter +
> a topic suffix; difference in timing or track → frontmatter.

---

## The execution loop

Working a plan graph is a loop, not a pass:

1. **Pick the active leaf.** The finest-resolution plan whose turn it is —
   a phase of a gamma, or a sketch of a phase.
2. **Implement it.**
3. **Reconcile the graph upward.** Before moving on, ask: *did this teach
   me anything that makes a plan above me no longer true?* If so, fix it
   now — see below.
4. **Record what landed** in the plan (mark the phase executed; note any
   deviation from what was planned).
5. **Repeat**, until a branch's phases have all landed — then freeze it
   (see *Lifecycle / Archiving*).

### Upward propagation — concrete moves

1. **Amend in place. Don't fork.** Edit the parent's affected section
   directly and leave a dated marker so the change is traceable without
   polluting the prose:
   ```
   *Amended {YYYY-MM-DD}: discovered during {phase} that {finding};
   § {section} updated to {change}.*
   ```

2. **Match the amendment to the kind of change.**
   - *Tactical* (a phase's method changes) → amend the plan, continue.
   - *Strategic* (a plan's premise wobbles) → amend, pause, decide whether
     a new sketch or parallel track is needed before continuing.
   - *Invalidates a parent's premise* (the root assumed X; execution proves
     X impossible) → you **must** amend the parent before proceeding. Work
     built on a false premise compounds.

3. **Amend vs. new plan — the parallel-track test.** Sometimes a discovery
   isn't a *revision* but a *new track*. Decide with: *if I inserted this
   work into the current plan's phase sequence, would the sequence still
   make sense?*
   - **Yes** → amend the existing plan, add a phase.
   - **No** → create a new plan **at its natural level** with
     `track: parallel` in its frontmatter, and state the orthogonality in
     its preamble.

---

## File-naming convention

```
{letter}_implementation_plan_{topic}.md     A plan for one work block
{letter}_{phaseId}_sketch.md                A deep dive into one phase
README.md                                   This framework doc
plans_index.md                              The project's live plan index (see below)
archive/                                    Frozen, executed plans
```

Examples:
- `alpha_implementation_plan.md` — alpha needs no topic; there is only one.
- `beta_implementation_plan_{topic}.md` — a beta: any direct division of alpha (a phase, a major bet, a subsystem…).
- `gamma_implementation_plan_{topic}.md` — a gamma: a sub-plan *within* one beta (exists only once that beta sub-decomposes).
- `gamma_implementation_plan_{other_subsystem}.md` — **another** gamma: a
  sibling at the same level, different topic — not a "delta."
- `gamma_g4_sketch.md` — a sketch: same level as its gamma, sharper detail
  on phase G4.

Multiple plans share a letter; the `_{topic}` suffix tells them apart. A
`_sketch` file is a **child** of the same-letter plan — same scope, one
phase in depth.

---

## Frontmatter convention

Every plan opens with YAML frontmatter:

```yaml
---
title:      Human-readable title
status:     drafting | active | executed | archived
date:       YYYY-MM-DD  (when last touched while still active)
scope:      One-line statement of what this plan covers
parent:     Filename of the parent plan (exactly one level up), or "none — root"
depends_on: (optional) filenames of sibling/earlier plans this one builds on
track:      (optional) "parallel" — marks an orthogonal refactor/investigation
phases:     (optional) inline list of phase IDs + their status
---
```

The minimum is `title`, `status`, `date`, `scope`, `parent`. `parent` is
load-bearing: it is how the level graph is reconstructed, so it must always
point exactly one level up. `depends_on` and `track` carry the
ordering/parallelism the letter no longer does. `phases:` surfaces
phase-by-phase progress so a reader sees state without scrolling.

---

## Lifecycle

A plan moves through four states:

1. **drafting** — being written; not yet committed to a course of action.
   Free to mutate radically; readers should not act on it.
2. **active** — under execution; authoritative for its scope. Amendments
   land in place (see *Upward propagation*).
3. **executed** — every phase has landed. Lives in `development/` briefly
   (for the commit that retires it) before moving to `archive/`.
4. **archived** — moved to `archive/`. **Frozen.**

Each transition is a deliberate move, ideally a commit that names it
(`archive {plan} — executed`).

### Archiving — what frozen means

When a plan's phases have all landed: flip `status` to `executed`, move it
to `archive/` (same commit that lands the last phase, or shortly after),
and **make no further edits**. An archived plan is a historical record of
what was understood while building that thing — editing it after the fact
destroys that record. Later understanding lands in the *active* plan that
supersedes it, never by rewriting the archive.

This is the one place upward propagation **stops**: it flows up through the
*active* graph, but never into a frozen branch.

---

## When to create a new plan vs. amend an existing one

- **Work one level finer than any existing plan covers?** → new plan at the
  next letter, `parent:` set to the plan one level up.
- **Another subsystem at a level that already exists?** → new plan, **same
  letter**, new `_{topic}` suffix (a sibling).
- **Same scope, sharper detail on one phase?** → new sketch (same letter as
  the parent plan + phase ID).
- **Different track entirely?** (orthogonal to the main work) → new plan at
  its natural level with `track: parallel`.
- **Discovery during execution changes specifics?** → amend the active plan
  in place (see *Upward propagation*).

---

## When NOT to use this folder

- **Architectural / reference docs** (system shape, conceptual model,
  domain history) → wherever the project keeps reference material, not
  here. Plans are *what we're about to build and why*, not *how the system
  is shaped*.
- **One-off commit messages** → git's commit message field.
- **Ephemeral todos / personal scratch** → wherever you keep those.

This folder is for plans the team can read together and act on. A "plan"
implies *more than one person will reference this* (or one person across
days). If only the next 30 minutes care about the note, write it elsewhere.

---

## The project plan index

This framework doc describes the *rules*. The list of a project's actual
plans — what exists, what's active, what's archived, and where each sits in
the graph — lives in a companion **`plans_index.md`** alongside this file.
Keeping the two separate lets this README stay identical across every
project that adopts the framework; only `plans_index.md` is
project-specific. Cold readers start at `README.md` for the rules and
`plans_index.md` for the current map.

---

## Adopting this framework in a new project

1. Copy this `README.md` into the project's `development/` folder
   unchanged.
2. Create a `plans_index.md` (empty to start) for that project's plans.
3. Write the single `alpha_implementation_plan.md` — the root.
4. Spawn betas as alpha's phases become active; gammas as subsystems do.
5. Run the execution loop; reconcile upward after every implementation.

---

## Meta-note

This README is itself a plan — for how plans work. It obeys its own rules:
living document, scope stated, amendments in place. If working with it
reveals the framework needs adjustment, amend this file directly.
