import WorldChild            from '../../../WorldChild.js';
import CompositionDirectives from './compositionDirectives/CompositionDirectives.js';

// CompositionSchemeVersion — a single CSV: the versioned bag of Composition
// Directives for its parent EntityClass, plus the draft/committed lifecycle.
// Getters are identical to AttributeSetVersion's (id + lifecycle metadata);
// the difference is the embedded leaf — a CompositionDirective, not an
// Attribute — and that the version is class-only (lifecycle writes reach the
// EntityClass one level up: CSV → CSVs → EntityClass, the same depth as an ASV).
//
// This is the THIRD versioned type to materialize in the World tree (after the
// class ASV and the trait TASV) — the shared `Version` base the
// AttributeSetVersion header reserved stays deferred; each versioned entity
// keeps its own lifecycle vocabulary until that base earns promotion.
//
// Child collection: `compositionDirectives` (CompositionDirectives). Materialized
// at construction from the CSV record's embedded `compositionDirectives` array.

class CompositionSchemeVersion extends WorldChild {

  constructor( parent, id, rawRecord ) {
    super( parent );
    this._id  = id;
    this._raw = rawRecord;

    this.compositionDirectives = new CompositionDirectives( this );
    this.compositionDirectives._populateFromRecords( rawRecord?.compositionDirectives ?? [] );
  }

  // Apollo's clean CSV record: flat camelCase, createdAt + committedAt only.
  get id()             { return this._id; }
  get lifeCycleStage() { return this._raw.lifeCycleStage; }
  get createdAt()      { return this._raw.createdAt; }
  get committedAt()    { return this._raw.committedAt; }

  get isDraft()     { return this.lifeCycleStage === 'draft'; }
  get isCommitted() { return this.lifeCycleStage === 'committed'; }

  get raw() { return this._raw; }

  // -------------------------------------------------------------------------
  // Lifecycle write operations (class-only)
  // -------------------------------------------------------------------------

  // POSTs commit on this CSV — draft → committed. The backend rejects an empty
  // (no directives) or already-committed CSV. Refreshes the parent class's
  // detail so the lifecycle update propagates.
  async commit() {
    const entityClass = this.parent.parent;      // CSV → CSVs → EntityClass
    await this.apollo.commitCompositionSchemeVersion( entityClass.id, this._id );
    await entityClass.loadDetail();
  }

  // DELETEs this CSV. Only valid while draft — committed versions are immutable
  // (the backend enforces this; we surface any rejection as an error).
  async deleteDraft() {
    const entityClass = this.parent.parent;
    await this.apollo.deleteCompositionSchemeVersionDraft( entityClass.id, this._id );
    await entityClass.loadDetail();
  }

}

export default CompositionSchemeVersion;
