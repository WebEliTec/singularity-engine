import WorldChild                from '../../../WorldChild.js';
import TraitAttributeSetVersions from './traitAttributeSetVersions/TraitAttributeSetVersions.js';

// Trait — a single class-scoped role (mixin) its host EntityClass adopts to
// gain extra attributes. The server-side mirror is apollo/src/domain/Trait.js;
// the contract is the only coupling.
//
// Identity-only ({ id, label, description }) — like an EntityClass, a Trait's
// lifecycle lives on the versioned attribute sets it OWNS (its TASVs), not on
// the trait itself. Structurally a Trait is "an owner of Attribute Set
// Versions" one level below the class, which is why its TASV subtree mirrors
// the class's ASV subtree (a TASV is byte-for-byte an ASV one level down).
//
// Materialized by Traits._populateFromWalk() — one Trait per element in the
// class walk's `traits` array. Each trait record already carries its own
// `attributeSetVersions` (the walk is fully nested), so the child collection is
// built at construction, exactly as an AttributeSetVersion builds its embedded
// attributes at construction.

class Trait extends WorldChild {

  constructor( parent, rawRecord ) {
    super( parent );
    this._raw = rawRecord;

    // Child collection — the trait's own versioned attribute sets, built from
    // this trait's walk record (which nests `attributeSetVersions`).
    this.traitAttributeSetVersions = new TraitAttributeSetVersions( this );
    this.traitAttributeSetVersions._populateFromWalk( rawRecord );
  }

  // Apollo's clean trait contract: flat camelCase { id, label, description }.
  // A trait is identity-only; no lifecycle/timestamps here.
  get id()          { return this._raw.id; }
  get label()       { return this._raw.label; }
  get description() { return this._raw.description; }

  // Display label for list cells + headers. Falls back to id if label is
  // missing (a trait is named by its label, not pluralized like a class).
  get displayName() {
    return this._raw.label ?? this._raw.id ?? '';
  }

  // Escape hatch — prefer a named getter when a field becomes stable contract.
  get raw() { return this._raw; }

}

export default Trait;
