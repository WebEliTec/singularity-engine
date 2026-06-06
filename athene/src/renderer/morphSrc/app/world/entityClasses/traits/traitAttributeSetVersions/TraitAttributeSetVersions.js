import WorldChild               from '../../../../WorldChild.js';
import TraitAttributeSetVersion from './TraitAttributeSetVersion.js';

// TraitAttributeSetVersions — the collection of every TASV belonging to one
// Trait. The exact mirror of AttributeSetVersions, one level deeper: a TASV is
// byte-for-byte an ASV, owned by a Trait instead of a Class. Populated from the
// trait's walk record (the class walk nests `traits[].attributeSetVersions`),
// so the contents replace any prior load (clear + repopulate).
//
// A distinct class (not a reuse of AttributeSetVersions) because its write
// paths are TRAIT-SCOPED — they reach the EntityClass one level deeper (TASV →
// TASVs → Trait → Traits → EntityClass) and call the trait-scoped Apollo
// methods (createTraitAttributeSetVersion, …). The read shape is identical; the
// reserved `Version` base (see AttributeSetVersion.js / TraitAttributeSetVersion.js)
// can later absorb the shared invariants now that a second versioned type has
// landed.
//
// Method shape per the iota convention:
//   getAll()       — every loaded TASV
//   getSingle(id)  — one by id, or null
//   getLatest()    — the highest-numbered TASV id (the default selection)
//   getCount()     — Map size
//   isLoaded()     — lifecycle gate
//   createSingle() — POST a new (draft) TASV + refresh the parent class detail
//
// Per-version lifecycle (commit, deleteDraft) lives on the TASV singular.

class TraitAttributeSetVersions extends WorldChild {

  constructor( trait ) {
    super( trait );
    this._byId   = new Map();
    this._loaded = false;
  }

  // -------------------------------------------------------------------------
  // Read paths
  // -------------------------------------------------------------------------

  getAll() {
    return Array.from( this._byId.values() );
  }

  getSingle( id ) {
    return this._byId.get( id ) ?? null;
  }

  // The highest-numbered TASV id wins (matches the ASV "latest" pick). Returns
  // null if no TASVs are loaded.
  getLatest() {
    if ( this._byId.size === 0 ) return null;
    const ids = Array.from( this._byId.keys() );
    const latestId = ids.sort( ( a, b ) => Number( b ) - Number( a ) )[ 0 ];
    return this._byId.get( latestId );
  }

  getCount() {
    return this._byId.size;
  }

  isLoaded() {
    return this._loaded;
  }

  // -------------------------------------------------------------------------
  // Write paths
  // -------------------------------------------------------------------------

  // POSTs a new (draft) TASV for the parent Trait, then refreshes the whole
  // class detail so the new TASV lands in the cache consistently. The trait id
  // is captured before the refresh (a primitive — safe across the rebuild) and
  // used to re-acquire the freshly-created (now highest-numbered) TASV.
  async createSingle() {
    const trait       = this.parent;
    const entityClass = trait.parent.parent;     // Trait → Traits → EntityClass
    await this.apollo.createTraitAttributeSetVersion( entityClass.id, trait.id );
    await entityClass.loadDetail();
    return entityClass.traits
      .getSingle( trait.id )
      ?.traitAttributeSetVersions
      .getLatest() ?? null;
  }

  // -------------------------------------------------------------------------

  // Reads the trait walk record's `attributeSetVersions` array (the wire key is
  // the shared `attributeSetVersions`, nested in the trait). Keyed by STRING id
  // so selection (Chronos) + lookups stay string-based as on the class side.
  _populateFromWalk( traitRecord ) {
    this._byId.clear();
    const tasvRecords = traitRecord?.attributeSetVersions ?? [];
    for ( const raw of tasvRecords ) {
      const id = String( raw.id );
      this._byId.set( id, new TraitAttributeSetVersion( this, id, raw ) );
    }
    this._loaded = true;
  }

}

export default TraitAttributeSetVersions;
