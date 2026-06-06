import WorldChild from '../../../../WorldChild.js';

// CompositionDirective — a single composition rule inside one Composition
// Scheme Version: "this sub-class goes here, optionally qualified by a trait of
// that sub-class, with this cardinality + description." Apollo's clean record is
// flat camelCase { id, subClassId, traitId?, cardinalityRules, description } —
// Object.assign exposes those directly so Hermes's Resource reads field values
// via plain property access (`data[fieldId]`), matching both the domain object
// and the wire payload (the C3 directive form round-trips with no translation;
// its field ids are subClassId / cardinalityRules / description).
//
// The `id` is the SERVER-DERIVED natural key (subClassId, or subClassId:traitId
// when trait-qualified) — not an editable field. `subClassId`/`traitId` are the
// frozen identity (changing them is a delete + re-create, not a patch).
//
// Object.assign reserved-key risk: same note as Attribute — a raw record key
// colliding with a WorldChild property (`parent`/`athene`/`apollo`) would
// shadow it; directive records don't use those keys. Defer the strict check.

class CompositionDirective extends WorldChild {

  constructor( parent, rawRecord ) {
    super( parent );
    Object.assign( this, rawRecord );
    this._raw = rawRecord;
  }

  // Display label. A directive has no `label` field — its readable handle is the
  // deterministic id (subClassId, or subClassId:traitId). C3 may resolve a richer
  // label (the sub-class's display name) from world.entityClasses; the World-tree
  // value object keeps the id-based fallback.
  get displayName() {
    return this.id ?? '';
  }

  get raw() { return this._raw; }

}

export default CompositionDirective;
