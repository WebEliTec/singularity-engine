# DECLARE templates

Catalogue of standard **DECLARE** constraint templates — each a named, parameterised **LTLf** formula. This is a **lookup menu**, *not* a spec dependency: when authoring a `dynamics.formal.md`, copy the **used subset** of these definitions into that document's `## Templates` section, so each version snapshot stays self-contained. The catalogue is *open* — a new template is just a new LTLf formula (this is what "extending DECLARE" means). Some templates are defined via others (e.g. `Succession` uses `Response` + `Precedence`); when you copy one, copy its referenced templates too — or inline them — so every applied name resolves.

DECLARE is by Pesic & van der Aalst; the resource-assignment extension (RALph / MP-Declare) is Daniel's university work.

Operators: `G` always · `F` eventually · `X` next · `U` until · `⊤` true. (Weak-until `p W q ≝ (p U q) ∨ G p`; expanded below wherever used, so every definition stays within `G F X U`.)

## Existence — cardinality of an event within a run

```
Existence(a)   ≝  F a                          -- a occurs at least once
Absence(a)     ≝  G ¬a                          -- a never occurs
Absence2(a)    ≝  ¬ F( a ∧ X F a )              -- a occurs at most once
Exactly1(a)    ≝  F a ∧ ¬ F( a ∧ X F a )        -- a occurs exactly once
```

## Position

```
Init(a)        ≝  a                             -- a is the first event
End(a)         ≝  F( a ∧ ¬ X ⊤ )                -- a is the last event
```

## Choice

```
Choice(a, b)           ≝  F a ∨ F b                       -- at least one of a, b occurs
ExclusiveChoice(a, b)  ≝  (F a ∨ F b) ∧ ¬(F a ∧ F b)      -- exactly one of a, b occurs
```

## Relation — unordered coupling

```
RespondedExistence(a, b)  ≝  F a → F b          -- if a ever occurs, so does b
CoExistence(a, b)         ≝  F a ↔ F b          -- both, or neither
```

## Relation — response (a, then b later)

```
Response(a, b)           ≝  G( a → F b )         -- every a is eventually followed by b
AlternateResponse(a, b)  ≝  G( a → X(¬a U b) )   -- …with no second a before that b
ChainResponse(a, b)      ≝  G( a → X b )         -- b immediately after every a
```

## Relation — precedence (b only if a before)

```
Precedence(a, b)           ≝  (¬b U a) ∨ G ¬b                          -- b only after some a
AlternatePrecedence(a, b)  ≝  Precedence(a, b) ∧ G( b → X((¬b U a) ∨ G ¬b) )   -- …no second b until another a
ChainPrecedence(a, b)      ≝  G( X b → a )                             -- every b immediately preceded by a
```

## Succession — response ∧ precedence

```
Succession(a, b)       ≝  Response(a, b) ∧ Precedence(a, b)
ChainSuccession(a, b)  ≝  G( a ↔ X b )           -- a and the immediately-following b coincide
```

## Negation

```
NotCoExistence(a, b)      ≝  ¬( F a ∧ F b )      -- a and b never both occur
NotSuccession(a, b)       ≝  G( a → ¬ F b )      -- a is never followed (ever) by b
NotChainSuccession(a, b)  ≝  G( a → ¬ X b )      -- a is never immediately followed by b
```

> A few alternate/chain formulas have minor variants across the literature (notably `AlternatePrecedence` and `End`); verify against a primary source before one becomes load-bearing. The core families match Chiariello et al. (2024) and the Pesic / Di Ciccio–Montali literature.

## Sources

- van der Aalst & Pesic, *Constraint-Based Workflow Models* — https://www.vdaalst.com/publications/p420.pdf
- Chiariello et al., *Direct Encoding of Declare Constraints in ASP* (2024) — https://arxiv.org/html/2412.10152
- Cabanillas et al., *RALph: A Graphical Notation for Resource Assignments in Business Processes* (CAiSE 2015) — https://ai.wu.ac.at/shape-project/files/publications/CAiSE2015_RALph.pdf
