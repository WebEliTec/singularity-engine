import WorldChild from '../../../../WorldChild.js';

// Attribute — a single attribute inside one AttributeSetVersion.
// Relocated from the retired app/attributeManager/ into the World tree
// at iota I2. Now extends WorldChild, carrying a non-enumerable parent
// ref (its Attributes collection), and through that the ASV, EntityClass,
// World, and Athene.
//
// Materialized by Attributes._populateFromRecords() — one Attribute per
// element in the ASV's embedded `attributes` array on Apollo's clean walk.
// Apollo's contract is flat camelCase ({ id, label, dataType, description,
// isRequired }), so Object.assign exposes those fields directly — no aliases
// needed. Hermes's Resource wrapper looks up field values via plain property
// access against the field id (`data[fieldId]`), so the Hermes Attribute
// field ids are camelCase too (`dataType`), matching both the domain object
// and the wire payload — the form round-trips with no translation.
//
// Object.assign reserved-key risk (iota plan open call #3): if a raw
// record were to carry a key colliding with a WorldChild-defined
// property (`parent`, `athene`, `apollo`), the assign would shadow the
// inherited property. Current attribute records don't use those keys
// and WorldChild's `parent` is set writable: true — defer the strict
// reserved-key check to a later phase if a collision actually shows up.

class Attribute extends WorldChild {

  constructor( parent, rawRecord ) {
    super( parent );
    Object.assign( this, rawRecord );
    this._raw = rawRecord;
  }

  // Display label for list cells + headers. Falls back to id if label
  // is missing (e.g., partial records).
  get displayName() {
    return this.label ?? this.id ?? '';
  }

  get raw() { return this._raw; }

}

export default Attribute;
