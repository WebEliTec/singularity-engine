import WorldChild from '../../../../WorldChild.js';
import Attribute  from './Attribute.js';

// Attributes — the collection of every Attribute inside one AttributeSetVersion.
// Populated by AttributeSetVersion's constructor from the ASV record's
// `.attributes` object (one Attribute per attribute id). Replaces the
// retired AttributeManager + its `loadedAsvId` hack: the ASV is now a
// concrete step in the chain (`this.parent`), not stashed state.
//
// Method shape per the iota convention:
//   getAll()                  — every loaded Attribute
//   getSingle(id)             — one by id, or null
//   getCount()                — Map size
//   createSingle(values)      — POST + refresh parent EntityClass
//   updateSingle(id, patch)   — PATCH + refresh
//   deleteSingle(id)          — DELETE + refresh
//
// All write paths follow the same pattern:
//   1. Apollo call (uses entityClass.id + this.parent.id [ASV id])
//   2. entityClass.loadDetail() — re-fetches the walk, rebuilds the
//      ASV tree from server truth
//   3. Re-acquire the new collection via the freshly-loaded tree and
//      return the relevant instance — the `this` Attributes collection
//      becomes stale after step 2 (its parent ASV was replaced), so
//      callers expecting a useful return value need the fresh one.
//
// `_populateFromRecords(records)` is the constructor-time hook —
// internal, prefixed with underscore. Bypasses the public surface for
// authoritative replacement.

class Attributes extends WorldChild {

  constructor( attributeSetVersion ) {
    super( attributeSetVersion );
    this._byId = new Map();
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

  // -------------------------------------------------------------------------
  // Write paths
  // -------------------------------------------------------------------------

  async createSingle( values ) {
    const entityClass = this.parent.parent.parent;  // ASV → ASVCollection → EntityClass
    const asvId       = this.parent.id;
    await this.apollo.createSingleAttribute( entityClass.id, asvId, values );
    await entityClass.loadDetail();
    // Re-acquire from the refreshed tree — `this` is now stale.
    return entityClass.attributeSetVersions
      .getSingle( asvId )
      ?.attributes
      .getSingle( values?.id ) ?? null;
  }

  async updateSingle( id, patch ) {
    const entityClass = this.parent.parent.parent;
    const asvId       = this.parent.id;
    await this.apollo.updateSingleAttribute( entityClass.id, asvId, id, patch );
    await entityClass.loadDetail();
    return entityClass.attributeSetVersions
      .getSingle( asvId )
      ?.attributes
      .getSingle( id ) ?? null;
  }

  async deleteSingle( id ) {
    const entityClass = this.parent.parent.parent;
    const asvId       = this.parent.id;
    await this.apollo.deleteSingleAttribute( entityClass.id, asvId, id );
    await entityClass.loadDetail();
    return null;
  }

  // -------------------------------------------------------------------------

  _populateFromRecords( records ) {
    this._byId.clear();
    // Apollo embeds attributes as an ordered ARRAY inside the ASV (each with
    // its own `id`); key the Map by it.
    for ( const raw of records ) {
      this._byId.set( raw.id, new Attribute( this, raw ) );
    }
  }

}

export default Attributes;
