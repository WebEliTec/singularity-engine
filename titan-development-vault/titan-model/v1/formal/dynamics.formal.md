# Dynamics

## Events

addAttribute(v, a)    ≝  ¬ hasAttribute(v, a) ∧ X hasAttribute(v, a)
removeAttribute(v, a) ≝  hasAttribute(v, a) ∧ X ¬ hasAttribute(v, a)
addDirective(s, d)    ≝  ¬ hasCompositionDirective(s, d) ∧ X hasCompositionDirective(s, d)
removeDirective(s, d) ≝  hasCompositionDirective(s, d) ∧ X ¬ hasCompositionDirective(s, d)

## Templates

Monotone(p)           ≝  G( p → G p )

## Rules

D1  ∀ v. Version(v) → Monotone( lifeCycleStage(v) = committed )
D2  ∀ v, a. AttributeSetVersion(v) → G( lifeCycleStage(v) = committed → ( ¬ addAttribute(v, a) ∧ ¬ removeAttribute(v, a) ) )
D3  ∀ v, d. CompositionSchemeVersion(v) → G( lifeCycleStage(v) = committed → ( ¬ addDirective(v, d) ∧ ¬ removeDirective(v, d) ) )
