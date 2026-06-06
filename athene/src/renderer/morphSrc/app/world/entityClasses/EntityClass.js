import WorldChild                from '../../WorldChild.js';
import AttributeSetVersions      from './attributeSetVersions/AttributeSetVersions.js';
import Traits                    from './traits/Traits.js';
import CompositionSchemeVersions from './compositionSchemeVersions/CompositionSchemeVersions.js';

// EntityClass — a single kind of thing in this World. Relocated from
// the retired app/entityClassManager/ at iota I1. Extended with its
// subtree at I2: attributeSetVersions (and its nested Attributes).
// Carries a non-enumerable back-reference to its parent EntityClasses
// collection (and transitively to World and Athene) via WorldChild.
//
// Materialized by EntityClasses.loadAll() from the clean class-meta record
// Apollo returns from `GET /entity-classes` (A5 cutover) — flat camelCase
// { id, singular, plural, description, profileImgUrl }, no `core` nesting and
// no lifecycle/timestamp (an entity class is identity-only; lifecycle lives on
// its ASVs). The getters pass these through directly.
//
// loadDetail() fetches the full walk (`GET /entity-classes/{id}`) and
// repopulates the subtree from server truth — attributeSetVersions, (since the
// Traits beta, T2) traits, and (since the Composition beta, C2)
// compositionSchemeVersions, all nested in the one walk. The same hook will
// populate ClassVersions and EntityObjects as those layers land.

class EntityClass extends WorldChild {

  constructor( parent, rawRecord ) {
    super( parent );
    this._raw = rawRecord;

    // Subtree collections — created empty here; populated by loadDetail() from
    // the one class walk. `traits` joined `attributeSetVersions` as a sibling
    // at T2 (a trait owns its own versioned attribute sets, one level down);
    // `compositionSchemeVersions` joined at C2 (a class-only versioned axis —
    // how the class is composed of other classes). Future siblings
    // (classVersions, entityObjects) land alongside these.
    this.attributeSetVersions      = new AttributeSetVersions( this );
    this.traits                    = new Traits( this );
    this.compositionSchemeVersions = new CompositionSchemeVersions( this );
  }

  // Apollo's clean contract is flat camelCase (no `core` nesting). Entity
  // classes are identity-only — lifecycle/timestamps live on the versioned
  // things (ASVs), not here.
  get id()            { return this._raw.id; }
  get singular()      { return this._raw.singular; }
  get plural()        { return this._raw.plural; }
  get description()   { return this._raw.description; }
  get profileImgUrl() { return this._raw.profileImgUrl; }

  // Capitalized singular for display. Apollo returns lowercase nouns
  // (`organization`, `person`, `plugin`); this is the canonical
  // human-readable label for list cells and headers. Lives on the
  // value object so every consumer renders the same way without
  // re-implementing the capitalization.
  get displayName() {
    const s = this.singular;
    if ( ! s ) return '';
    return s.charAt( 0 ).toUpperCase() + s.slice( 1 );
  }

  // Escape hatch — for anything not yet promoted to a named getter.
  // Avoid in consumer code; prefer adding a getter when a field
  // becomes a stable part of the contract.
  get raw() { return this._raw; }

  // -------------------------------------------------------------------------
  // Load paths
  // -------------------------------------------------------------------------

  // Fetches the full directory walk and repopulates the subtree from
  // server truth. Idempotent and safe to re-run after any write — the
  // subtree collections clear + repopulate, so stale entries from a
  // previous load can't survive.
  //
  // Collection identity is preserved across loads (`this.attributeSetVersions`
  // is the same object before and after). Identity of *individual*
  // ASVs and Attributes inside it is NOT — those are fresh instances
  // each load. Callers that need a post-load reference should re-acquire
  // it via the tree rather than caching from a prior call.
  async loadDetail() {
    const walk = await this.apollo.getSingleEntityClassDirectoryWalk( this.id );
    this.attributeSetVersions._populateFromWalk( walk );
    this.traits._populateFromWalk( walk );
    this.compositionSchemeVersions._populateFromWalk( walk );
  }

}

export default EntityClass;
