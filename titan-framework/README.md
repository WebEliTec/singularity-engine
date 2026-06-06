# Titan Domain Modeling Framework

Every piece of software models a domain, physical or virtual. Fail to model that domain correctly and you end up with inferior software — no matter how clean your code or how elaborate your software architecture.

In most projects the domain is discovered and developed whilst writing code, so the domain model remains implicit in that code at all times. To reason about it apart from implementation details, a developer or agent must extract it on-the-fly into working memory. That improvised extraction has no canonical reference to measure itself against, and from this single absence each of its errors follows:

- **Incompleteness** — not all domain model properties are recovered from the codebase, and nothing exists against which the extraction's completeness can be measured.
- **Uncorrectable flaws** — malformed or inadequate properties are accepted as "sunk costs", because the model cannot be corrected without rewriting the software that carries it.
- **Software-model contamination** — with no boundary between the two, properties of the software model itself are mistaken for properties of the domain it was meant to model.

The common fact behind all three is that the domain model has no explicit, canonical existence of its own. It lives only dissolved into the code, and must therefore be re-extracted by improvisation every time it is needed.

The Titan Domain Modeling Framework (TDMF) seeks to provide a set of procedures and methodologies to facilitate the modeling of the domain at hand.

It produces a domain model which is prescriptive for the succeeding software development. 

## The model

The model is the domain made explicit: a single artifact, authored before the software and kept apart from it. It is the one authoritative statement of what the domain is. The software conforms to the model, not the model to the software. Where the two disagree, the code is wrong and is corrected, never the model.

A model is composed of three views. The **structural view** fixes what exists: the domain's entities, their properties, and the relations among them. The **invariant view** states what must hold in every state. The **dynamic view** constrains how the domain may change over time. Each view is written in the logic suited to it: the structural view in description logic, the invariant view in first-order logic, the dynamic view in LTLf (linear temporal logic over finite traces).

Each view is written as a formal statement and a prose mirror of it. The formal is canonical — the precise, machine-checkable source of truth; the prose is derived from it, a plain-language rendering for review. In every case the subject is the domain — what the software is about — never the software itself, whose structure (its classes, services, architecture) is a separate concern.

## Versioning

A domain is never modeled correctly in one pass. Understanding deepens, requirements shift, and the domain itself evolves. The model is therefore versioned: it advances as a sequence of self-contained snapshots, corrected and extended one version at a time.

Each version is a directory `v<N>` under `titan-model/`. Inside, the three views — `structure`, `invariants`, `dynamics` — each appear as a formal document and a prose mirror, beside a `STATUS` file that marks the version's stage (see Authoring):

```
titan-model/
  v1/
    STATUS
    formal/
      structure.formal.md
      invariants.formal.md
      dynamics.formal.md
    prose/
      structure.prose.md
      invariants.prose.md
      dynamics.prose.md
  v2/
    …
```

A version is a self-contained snapshot of the model — read its files and you have the model entire. It is a full copy, not a delta from the previous version.

## Authoring a version

### The schema

Read `schema.formal.md` and `schema.prose.md` first: together they define a model document — its grammar and its well-formedness constraints (`W1–W10`). Every formal file must conform to these shapes, and not for style: the formal is machine-readable, so a document that strays will not parse. The schema governs every version.

### The loop

Authoring is a loop. You write the formal domain model — the `*.formal.md` documents — and derive its prose mirror, the `*.prose.md` documents, from it; the human then reviews that prose. You change the formal first; the prose follows, always re-derived from it and never hand-corrected. So when review turns up a fault, you do not touch the prose — you fix the formal and re-derive the prose from it. The formal domain model is the single source of truth, and the prose never drifts from it.

### Starting a version

You author the first version, `v1`, from scratch. Every later version begins as a full copy of the one before it — `cp -r titan-model/v<N> titan-model/v<N+1>` — which you then edit.

### Order

Author the three views in causal order:

> **structure → invariants → dynamics**

Structure comes first: it alone introduces vocabulary — entities, properties, relations — and the other two views are written in that vocabulary, adding no terms of their own. Invariants come before dynamics as the static precedes the temporal: an invariant constrains a single state, a dynamic rule a whole run, and a run is a sequence of states. Within each view, write the formal before its prose.

### The prose mirror

What makes a prose mirror faithful is fixed by the contract in `schema.prose.md` §3 — its single source of truth. In short: the prose mirrors the formal's headings one-to-one, carries one entry per formal id, adds and drops nothing, and renders each entry as a short bullet — the id, a plain-language statement, and the formal form in backticks. Re-derive and re-check it after any change to the formal; drift between the two is a defect, not a variant.

### Templates

The dynamic view writes its rules using **DECLARE templates** — named, reusable shapes for temporal rules, such as *Response* (every occurrence of one event is eventually followed by another). The standard shapes are catalogued in `reference/declare-templates.md`; copy the subset you use into the dynamics view's `## Templates` section — along with any a copied shape is built from (e.g. `Succession` pulls in `Response` and `Precedence`) — so the version stays self-contained. Whether you copy such a dependency or inline it is your choice: it changes the prose surface, not the meaning, so the difference is a variant, not a defect. You may coin custom shapes the same way.

### Status

A version carries a `STATUS` file holding one of three values:

- `draft` — you are authoring it;
- `ready-for-review` — you have finished and self-verified;
- `final` — a human has reviewed and accepted it.

You reach `ready-for-review` only after self-verifying: all six files exist, each formal parses and resolves against the schema, every `W1–W10` holds, each prose mirrors its formal, and the model is faithful to the requirements. The human grants `final` by accepting the prose — or returns corrections, which you fix in the formal and re-derive.

### Committing

Commit a version only once it is `final`, as a single atomic commit — message `model: add v<N> — <one-line summary>`. One commit per version.

## Layout

The framework and the model are two sibling directories in the project:

```
titan-framework/            ← this framework
  README.md
  schema.formal.md
  schema.prose.md
  reference/
    declare-templates.md
titan-model/                ← the project's domain model
  v1/
  v2/
  …
```

- **`titan-framework/README.md`** — this front door.
- **`titan-framework/schema.formal.md` / `schema.prose.md`** — the schema every version conforms to: a model document's grammar and well-formedness constraints (`W1–W10`), formal and in plain language.
- **`titan-framework/reference/declare-templates.md`** — the catalogue of DECLARE templates the dynamic view copies from.
- **`titan-model/`** — the versioned domain model, one directory per version (see Versioning for a version's contents). It lives in the project repository and is versioned with the project's code.

