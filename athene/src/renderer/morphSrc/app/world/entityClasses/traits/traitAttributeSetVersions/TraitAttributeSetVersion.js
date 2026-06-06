import WorldChild      from '../../../../WorldChild.js';
import TraitAttributes from './attributes/TraitAttributes.js';

// TraitAttributeSetVersion — a single TASV: the versioned bag of attributes for
// its parent Trait, plus the same draft/committed lifecycle as a class's ASV.
// Byte-for-byte the AttributeSetVersion shape, owned one level deeper (by a
// Trait, not a Class). This is the SECOND versioned type to land (after the
// class ASV) — exactly the trigger the AttributeSetVersion.js header reserved
// for a future shared `Version` base. Until that base is promoted, each
// versioned entity keeps its own (here trait-scoped) lifecycle vocabulary.
//
// A distinct class (not a reuse of AttributeSetVersion) because the lifecycle
// writes are TRAIT-SCOPED: they reach the EntityClass one level deeper (TASV →
// TASVs → Trait → Traits → EntityClass) and call the trait-scoped Apollo
// methods. The getters are identical to AttributeSetVersion's.
//
// Child collection: `attributes` (TraitAttributes). Materialized at
// construction from the TASV record's embedded `attributes` array.

class TraitAttributeSetVersion extends WorldChild {

  constructor( parent, id, rawRecord ) {
    super( parent );
    this._id  = id;
    this._raw = rawRecord;

    this.attributes = new TraitAttributes( this );
    this.attributes._populateFromRecords( rawRecord?.attributes ?? [] );
  }

  // Apollo's clean TASV record: flat camelCase, createdAt + committedAt only.
  get id()             { return this._id; }
  get lifeCycleStage() { return this._raw.lifeCycleStage; }
  get createdAt()      { return this._raw.createdAt; }
  get committedAt()    { return this._raw.committedAt; }

  get isDraft()     { return this.lifeCycleStage === 'draft'; }
  get isCommitted() { return this.lifeCycleStage === 'committed'; }

  get raw() { return this._raw; }

  // -------------------------------------------------------------------------
  // Lifecycle write operations (trait-scoped)
  // -------------------------------------------------------------------------

  // POSTs commit on this TASV — draft → committed. The backend rejects an empty
  // or already-committed TASV. Refreshes the parent class's detail so the
  // lifecycle update propagates through the trait subtree.
  async commit() {
    const trait       = this.parent.parent;      // TASV → TASVs → Trait
    const entityClass = trait.parent.parent;     // Trait → Traits → EntityClass
    await this.apollo.commitTraitAttributeSetVersion( entityClass.id, trait.id, this._id );
    await entityClass.loadDetail();
  }

  // DELETEs this TASV. Only valid while draft — committed versions are
  // immutable (the backend enforces this; we surface any rejection as an error).
  async deleteDraft() {
    const trait       = this.parent.parent;
    const entityClass = trait.parent.parent;
    await this.apollo.deleteTraitAttributeSetVersionDraft( entityClass.id, trait.id, this._id );
    await entityClass.loadDetail();
  }

}

export default TraitAttributeSetVersion;
