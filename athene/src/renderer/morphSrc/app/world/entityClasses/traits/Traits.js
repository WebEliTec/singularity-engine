import WorldChild from '../../../WorldChild.js';
import Trait      from './Trait.js';

// Traits — the collection of every Trait belonging to one EntityClass. A Trait
// is a class-scoped reusable role (mixin) the class adopts to gain extra
// attributes; it owns its own versioned attribute sets (TASVs) exactly as the
// class owns its ASVs. The `traits/` subtree is a sibling of
// `attributeSetVersions/` under the class — the World-OOP-tree beta's I4+
// growth, delivered by the Traits beta (T2).
//
// Materialized from the class walk by EntityClass.loadDetail(): Apollo's clean
// walk nests `traits` as an ordered ARRAY (each trait carries its own
// `attributeSetVersions`), so the whole subtree lands from one GET.
//
// Method shape per the iota convention (resource name implied by the
// collection):
//   getAll()                  — every loaded Trait
//   getSingle(id)             — one by id, or null
//   getCount()                — Map size
//   isLoaded()                — lifecycle gate
//   createSingle(values)      — POST a new trait + refresh parent class detail
//   updateSingle(id, patch)   — PATCH trait meta + refresh
//   deleteSingle(id)          — DELETE trait (+ its TASVs) + refresh
//
// Identity CRUD lives here on the collection (like EntityClasses) — a Trait is
// identity-only; per-version lifecycle (commit/deleteDraft) belongs to the TASV
// singular, one level down. Every write refreshes via the parent EntityClass's
// full walk, which re-nests traits — so stale entries can't survive.

class Traits extends WorldChild {

  constructor( entityClass ) {
    super( entityClass );
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

  getCount() {
    return this._byId.size;
  }

  isLoaded() {
    return this._loaded;
  }

  // -------------------------------------------------------------------------
  // Write paths — Apollo + refresh-from-server (refresh = the parent class's
  // full walk, which re-nests traits)
  // -------------------------------------------------------------------------

  // POSTs a new trait. Unlike a class, a trait's id is client-supplied and
  // REQUIRED (kebab key, unique within the class). Refreshes the class detail
  // so the new trait (with its empty TASV list) lands consistently.
  async createSingle( values ) {
    const entityClass = this.parent;
    await this.apollo.createSingleTrait( entityClass.id, values );
    await entityClass.loadDetail();
    // Re-acquire from the refreshed tree — `this` is now stale.
    return entityClass.traits.getSingle( values?.id ) ?? null;
  }

  async updateSingle( id, patch ) {
    const entityClass = this.parent;
    await this.apollo.updateSingleTrait( entityClass.id, id, patch );
    await entityClass.loadDetail();
    return entityClass.traits.getSingle( id ) ?? null;
  }

  async deleteSingle( id ) {
    const entityClass = this.parent;
    await this.apollo.deleteSingleTrait( entityClass.id, id );
    await entityClass.loadDetail();
    return null;
  }

  // -------------------------------------------------------------------------

  // The I4+ hook EntityClass.loadDetail() calls — internal, authoritative
  // replacement from Apollo's walk. Each trait record carries its own
  // `attributeSetVersions`, which the Trait builds into its subtree at
  // construction (the whole tree materializes from one walk).
  _populateFromWalk( walk ) {
    this._byId.clear();
    const traitRecords = walk?.traits ?? [];
    for ( const raw of traitRecords ) {
      this._byId.set( raw.id, new Trait( this, raw ) );
    }
    this._loaded = true;
  }

}

export default Traits;
