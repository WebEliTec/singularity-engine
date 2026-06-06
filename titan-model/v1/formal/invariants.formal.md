# Invariants

I1  ∀ c1, c2. EntityClass(c1) ∧ EntityClass(c2) ∧ id(c1) = id(c2) → c1 = c2
I2  ∀ c, t1, t2. hasTrait(c, t1) ∧ hasTrait(c, t2) ∧ id(t1) = id(t2) → t1 = t2
I3  ∀ v, a1, a2. hasAttribute(v, a1) ∧ hasAttribute(v, a2) ∧ id(a1) = id(a2) → a1 = a2
I4  ∀ s, d1, d2. hasCompositionDirective(s, d1) ∧ hasCompositionDirective(s, d2) ∧ subClassId(d1) = subClassId(d2) ∧ (∀ t. traitId(d1, t) ↔ traitId(d2, t)) → d1 = d2
I5  ∀ v. Version(v) → version(v) ≥ 1
I6  ∀ o, v1, v2. hasAttributeSetVersion(o, v1) ∧ hasAttributeSetVersion(o, v2) ∧ version(v1) = version(v2) → v1 = v2
I7  ∀ c, v1, v2. hasCompositionSchemeVersion(c, v1) ∧ hasCompositionSchemeVersion(c, v2) ∧ version(v1) = version(v2) → v1 = v2
I8  ∀ v. AttributeSetVersion(v) ∧ lifeCycleStage(v) = committed → ∃ a. hasAttribute(v, a)
I9  ∀ v. CompositionSchemeVersion(v) ∧ lifeCycleStage(v) = committed → ∃ d. hasCompositionDirective(v, d)
I10 ∀ c, s, d. hasCompositionSchemeVersion(c, s) ∧ hasCompositionDirective(s, d) → ¬ (subClassId(d) = id(c))
I11 ∃ w. World(w) ∧ ∀ u. ( World(u) → u = w )
