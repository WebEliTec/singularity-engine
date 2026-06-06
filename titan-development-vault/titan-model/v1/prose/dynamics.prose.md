# Dynamics

What happens over time — the rules over *runs* of the model, not single states. (Mirrors `dynamics.formal.md`; the formal is canonical.) Operators: `G` always, `F` eventually, `X` next, `U` until.

## Events

Named state-changes — the things the system does.

- **addAttribute(v, a)** — attribute `a` is absent from version `v` now, present next. `¬ hasAttribute(v, a) ∧ X hasAttribute(v, a)`
- **removeAttribute(v, a)** — `a` is present in `v` now, absent next. `hasAttribute(v, a) ∧ X ¬ hasAttribute(v, a)`
- **addDirective(s, d)** — directive `d` is absent from scheme version `s` now, present next. `¬ hasCompositionDirective(s, d) ∧ X hasCompositionDirective(s, d)`
- **removeDirective(s, d)** — `d` is present in `s` now, absent next. `hasCompositionDirective(s, d) ∧ X ¬ hasCompositionDirective(s, d)`

## Templates

Named rule-shapes.

- **Monotone(p)** — once `p` holds, it holds forever after (custom). `G( p → G p )`

## Rules

- **D1 — Committed is terminal.** Once a version is committed, it stays committed; it never returns to draft. `∀ v. Version(v) → Monotone( lifeCycleStage(v) = committed )`
- **D2 — Committing freezes attributes.** While an attribute-set version is committed, no attribute is ever added or removed. `∀ v, a. AttributeSetVersion(v) → G( lifeCycleStage(v) = committed → ( ¬ addAttribute(v, a) ∧ ¬ removeAttribute(v, a) ) )`
- **D3 — Committing freezes directives.** While a composition-scheme version is committed, no directive is ever added or removed. `∀ v, d. CompositionSchemeVersion(v) → G( lifeCycleStage(v) = committed → ( ¬ addDirective(v, d) ∧ ¬ removeDirective(v, d) ) )`
