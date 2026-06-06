import WorldChild from '../../../WorldChild.js';
import Attributes from './attributes/Attributes.js';

// AttributeSetVersion — a single ASV. Carries the versioned bag of
// Attributes for its parent EntityClass + the draft/committed lifecycle
// metadata. Per the conceptual deep dive §2 #3, ASVs are the unit of
// schema evolution at the attribute level.
//
// The ASV id is the file basename Apollo stores at
// `storage/app/content-base/classes/{cid}/attributes/{asv_id}.json`. We
// pass it explicitly into the constructor because in the walk response
// it's the KEY in `walk.attributes`, not a field inside the value.
//
// Lifecycle operations live here (not on the collection) because they
// act on a SPECIFIC version:
//   commit()        — PATCH commit_attribute_set_version
//   deleteDraft()   — DELETE (only valid while life-cycle stage is draft)
//
// Child collection: `attributes` (Attributes). Materialized at construction
// from the raw ASV record's `.attributes` object — one Attribute instance
// per attribute id in this ASV.
//
// Reserved as a future generalization (deferred): a `Version` base class
// abstracting the draft/committed lifecycle across all five versioning
// axes (ASV, Trait ASV, CSV, Class Version, Class Object Structure). For
// now each versioned entity carries its own lifecycle vocabulary; iota
// I4+ can promote the shared invariants into a base if/when a second
// versioned type lands.

class AttributeSetVersion extends WorldChild {

  constructor( parent, id, rawAsvRecord ) {
    super( parent );
    this._id   = id;
    this._raw  = rawAsvRecord;

    this.attributes = new Attributes( this );
    this.attributes._populateFromRecords( rawAsvRecord?.attributes ?? [] );
  }

  // Apollo's clean ASV record: flat camelCase, `committedAt` spelled correctly
  // (the legacy `commited_at` typo is gone), no `updatedAt` (an ASV carries
  // createdAt + committedAt only).
  get id()             { return this._id; }
  get lifeCycleStage() { return this._raw.lifeCycleStage; }
  get createdAt()      { return this._raw.createdAt; }
  get committedAt()    { return this._raw.committedAt; }

  get isDraft()      { return this.lifeCycleStage === 'draft'; }
  get isCommitted()  { return this.lifeCycleStage === 'committed'; }

  get raw() { return this._raw; }

  // -------------------------------------------------------------------------
  // Lifecycle write operations
  // -------------------------------------------------------------------------

  // PATCHes commit on this ASV — moves it from draft to committed.
  // Idempotent from the engine's perspective; the backend rejects if
  // the ASV is already committed. Refreshes the parent EntityClass's
  // detail so the lifecycle stage update propagates.
  async commit() {
    const entityClass = this.parent.parent;
    await this.apollo.commitAttributeSetVersion( entityClass.id, this._id );
    await entityClass.loadDetail();
  }

  // DELETEs this ASV. Only valid while the ASV is in draft — committed
  // versions are immutable (per the deep dive §3.1, "drafts can be
  // deleted; committed cannot"). The backend enforces this; we surface
  // any rejection as an error.
  async deleteDraft() {
    const entityClass = this.parent.parent;
    await this.apollo.deleteAttributeSetVersionDraft( entityClass.id, this._id );
    await entityClass.loadDetail();
  }

}

export default AttributeSetVersion;
