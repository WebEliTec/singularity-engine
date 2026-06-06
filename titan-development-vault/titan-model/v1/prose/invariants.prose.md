# Invariants

What must always be true, in every single state of the model. (Mirrors `invariants.formal.md`; the formal is canonical.)

- **I1 — Entity-class ids are unique.** No two entity classes share an id. `∀ c1, c2. EntityClass(c1) ∧ EntityClass(c2) ∧ id(c1) = id(c2) → c1 = c2`
- **I2 — Trait ids are unique within a class.** Within one class, no two traits share an id. `∀ c, t1, t2. hasTrait(c, t1) ∧ hasTrait(c, t2) ∧ id(t1) = id(t2) → t1 = t2`
- **I3 — Attribute ids are unique within a version.** Within one attribute-set version, no two attributes share an id. `∀ v, a1, a2. hasAttribute(v, a1) ∧ hasAttribute(v, a2) ∧ id(a1) = id(a2) → a1 = a2`
- **I4 — Directives are unique by their target.** Within one composition-scheme version, no two directives have the same sub-class *and* the same trait qualifier (counting "no qualifier" as a value). The (sub-class, trait) pair is a directive's natural key. `∀ s, d1, d2. hasCompositionDirective(s, d1) ∧ hasCompositionDirective(s, d2) ∧ subClassId(d1) = subClassId(d2) ∧ (∀ t. traitId(d1, t) ↔ traitId(d2, t)) → d1 = d2`
- **I5 — Version numbers start at 1.** Every spec version's number is a positive integer. `∀ v. Version(v) → version(v) ≥ 1`
- **I6 — Attribute-set version numbers are unique per owner.** Within one owner (class or trait), no two attribute-set versions share a number. `∀ o, v1, v2. hasAttributeSetVersion(o, v1) ∧ hasAttributeSetVersion(o, v2) ∧ version(v1) = version(v2) → v1 = v2`
- **I7 — Composition-scheme version numbers are unique per class.** Within one class, no two composition-scheme versions share a number. `∀ c, v1, v2. hasCompositionSchemeVersion(c, v1) ∧ hasCompositionSchemeVersion(c, v2) ∧ version(v1) = version(v2) → v1 = v2`
- **I8 — A committed attribute-set version is non-empty.** Once committed, an attribute-set version holds at least one attribute. `∀ v. AttributeSetVersion(v) ∧ lifeCycleStage(v) = committed → ∃ a. hasAttribute(v, a)`
- **I9 — A committed composition-scheme version is non-empty.** Once committed, a composition-scheme version holds at least one directive. `∀ v. CompositionSchemeVersion(v) ∧ lifeCycleStage(v) = committed → ∃ d. hasCompositionDirective(v, d)`
- **I10 — No self-composition.** A directive never names, as its sub-class, the very class whose scheme it belongs to — regardless of any trait qualifier. `∀ c, s, d. hasCompositionSchemeVersion(c, s) ∧ hasCompositionDirective(s, d) → ¬ (subClassId(d) = id(c))`
- **I11 — There is exactly one World.** A model has one and only one world (the singleton root). `∃ w. World(w) ∧ ∀ u. ( World(u) → u = w )`
