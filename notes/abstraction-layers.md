# Singularity Engine — Abstraction Layers

*How to keep the levels straight. There are two **orthogonal** ways for two
things to be at "different levels of abstraction" in this project, and
conflating either axis is the fastest way to tie yourself in knots. This doc
is the disambiguation tool. Companion to `conceptual-deep-dive.md` (the
technical model) and `architecture.md` (the system shape).*

---

## The two axes

When something "feels meta," it is at a different level along **one of two
independent axes**. Name the axis and the vertigo stops.

- **Axis 1 — the Towers (what *kind* of thing you are modeling).**
  Are you modeling the *world the software is about*, or the *software
  artifact itself*? These are different animals and want different languages.

- **Axis 2 — the Rungs (how many "instance-of" steps up you are).**
  Within a single tower, a model can describe instances, or describe the
  language that describes instances, and so on (the OMG/MOF M0–M3 ladder).

These are orthogonal. "Tower A vs B" is *not* "higher vs lower on the ladder."
Keep both labels on everything and nothing collides.

---

## Axis 1 — Tower A vs Tower B

| | **Tower A — Domain / Ontology** | **Tower B — Software / Architecture** |
|---|---|---|
| Answers | *"What does the world contain, and what must hold?"* | *"What is the machine made of, and how does it run?"* |
| Nature | Ontological — true (or required) whether or not any code exists | Constructive — exists only because someone built it |
| To‑do example | `List`, `TodoItem`, `Status`; "an item belongs to exactly one list" | the controller, the repository, the React components, the API |
| In SE | `titan-vault` / `model/` — `EntityClass`, `AttributeSetVersion`, `Attribute`, `Relation`… | apollo (Fastify + domain‑rule classes), athene (morpheus nodes/modules/kernels), Hermes, Chronos, the graph |
| Languages | **DL / OWL, ER, ORM, VOWL** (structure) · **FOL** (invariants) · **LTLf / DECLARE** (dynamics) | **UML** (component / sequence / class) · **C4** · morpheus's own node/module/kernel vocabulary |
| In Titan | the **Domain / Ontology view** (`ModelGraph`) | the **Software / Architecture view** (the AppLiveView lineage — the live morpheus graph) |

**The trap:** both towers draw as boxes‑and‑lines, so they *look* alike. They
are not. DL is the wrong tool to say "the Sidebar module subscribes to the
`currentSurface` signal"; UML components are the wrong tool to say "every
committed version is immutable."

**Notational consequence:** UML *class diagrams* are natively a **Tower‑B**
(software) notation. Borrowing them for a Tower‑A domain model is itself a
mild conflation — familiar, but category‑shifted. For Tower A, **ER or VOWL**
is the semantically honest choice (the structure layer genuinely *is* DL).

---

## Axis 2 — the MOF rung ladder (M0–M3)

Within **Tower A**, mapped onto SE:

| Rung | OMG name | In Singularity Engine | An instance of it is… |
|---|---|---|---|
| **M3** | meta‑metamodel (MOF) | `titan-vault/schema.formal.md` — the grammar + well‑formedness defining *what a model document is*. **Self‑describing.** | a metamodel (e.g. SE's own `structure.formal.md`) |
| **M2** | metamodel (the language) | **SE's domain model** — `EntityClass`, `Attribute`, `AttributeSetVersion`… the vocabulary SE *offers* users. ← *what `ModelGraph` renders* | a user's domain model (`List`, `TodoItem`) |
| **M1** | model | a *user's* domain model authored in SE — `List`, `TodoItem`, `Status` | a record ("Groceries") |
| **M0** | instances | the user's actual data — "Buy milk" | (nothing — bottom rung) |

The descent is clean: `EntityClass` *is‑an‑instance‑of* `Concept` (M3);
`List` *is‑an‑instance‑of* `EntityClass` (M2); "Buy milk"
*is‑an‑instance‑of* `List` (M1). No loop anywhere going down.

> **Tower B has its own ladder** (C4: System Context → Containers
> `apollo`/`athene`/`prometheus` → Components `Hermes`/`Chronos`/nodes →
> Code). Tower B is **not** "above" or "below" Tower A — it is a *sideways
> projection*: the code that *realizes* the M3→M2 machinery.

---

## The grounding test

For **any** box on any diagram, ask one question:

> **"What would an *instance* of this be?"**

- Instance of `EntityClass`? → `List`, `TodoItem` ⇒ it's **M2**.
- Instance of `List`? → "Groceries" ⇒ it's **M1**.
- Instance of `Concept` (the schema's vocabulary)? → `EntityClass`,
  `Attribute` (the things on the canvas) ⇒ the schema is **M3**, and what we
  render is its **M2** instance.

One question pins the rung of anything and stops the spin.

---

## Why SE specifically makes your stomach drop

SE is a **domain‑modeling tool whose domain *is* domain‑modeling.** So its M2
vocabulary (`EntityClass`, `Attribute`) and its M3 vocabulary (`Concept`,
`Relation`) are *both about the activity of modeling* — one rung apart. They
**rhyme**, so they camouflage.

In a normal to‑do app, M2 (`TodoItem`) and M3 (`Concept`) are visibly about
different things (tasks vs. modeling), so nobody ever confuses them. In SE
they aren't. The rhyme is the entire source of the "this is f***ed up"
feeling. Stratification — keeping the rungs labeled — is the entire fix.

**Self‑reference is not circularity.** SE is a *metacircular* modeling tool,
in the same family as a C compiler written in C, Lisp's `eval` written in
Lisp, BNF describing BNF, or set theory kept sane by type stratification. The
**only** genuine loop is at the very top: the schema (M3) describes its own
format. That is a benign **fixpoint**, not an infinite regress — it bottoms
out, exactly as MOF is defined in MOF. (This is *why* making
`schema.prose.md` self‑describe was the right move: M3 is self‑defining by
nature.) The discipline that keeps the fixpoint from becoming Russell's
paradox: **never let a rung be an instance of itself**, except that one
deliberate, well‑founded top.

---

## Consequences for how we build

1. **One language per tower, never one across both.**
   Tower A → ER/VOWL (+ the DL/FOL/LTLf formal core). Tower B → UML
   component/sequence + C4 (or the live morpheus graph). Don't draw apollo's
   classes and the domain's concepts on the same canvas.

2. **`ModelGraph` is rung‑agnostic.** It renders a *Tower‑A* model —
   concepts, relations, taxonomy — and does **not** care which rung that
   model sits at. Point it at `titan-vault` → you are inspecting **M2** (SE's
   own domain model). Point it at a user's project vault → you are inspecting
   **M1** (their domain). *Same notation, same renderer, different rung.* The
   rung is context, not code — so the recursion adds **zero** complexity to
   Titan's design.

3. **The current dummy data is correct, and it is M2.** `EntityClass /
   AttributeSetVersion / Attribute / TraitAttribute / VersionStatus` is a
   Tower‑A model at the M2 rung (SE's own domain model). It is *not* a Tower‑B
   software model, and it is *not* a user's M1 model — though `ModelGraph`
   would render any of those identically.

4. **Titan is a multi‑view cockpit, and the views *are* the axes.**
   - **Domain / Ontology view** — `ModelGraph`, fed by a vault, DL‑honest
     notation. *"What is the system about?"*
   - **Software / Architecture view** — AppLiveView lineage, fed by the live
     morpheus graph (and eventually apollo). *"What is the system made of?"*
   - **Traceability** (long game) — which Tower‑B component *realizes* which
     Tower‑A concept. Only coherent *because* the towers are kept separate.

---

## Cheat sheet

When something feels "meta," ask, in order:

1. **Which tower?** Is this about *the world* (A) or *the software* (B)?
2. **Which rung?** "What would an instance of this be?" → fixes M0/M1/M2/M3.
3. **Is the apparent loop real?** Only the M3 self‑description is a (benign)
   loop; everything else is a clean instance‑of descent.

Label both axes on every artifact and the tower stays standing.
