import WorldChild from '../../../../../WorldChild.js';
import Attribute  from '../../../attributeSetVersions/attributes/Attribute.js';

// TraitAttributes — the collection of every attribute inside one TASV. The
// mirror of Attributes, one level deeper (under a Trait's TASV). The leaf
// `Attribute` is REUSED wholesale: an attribute is write-free identity
// (Object.assign over the raw record + displayName), so a trait-attribute IS an
// Attribute — the shape is identical (the §5 "reuse where the shape is
// identical" call). Only the COLLECTION differs, because its write paths are
// trait-scoped.
//
// Method shape per the iota convention:
//   getAll()                  — every loaded attribute
//   getSingle(id)             — one by id, or null
//   getCount()                — Map size
//   createSingle(values)      — POST + refresh parent class detail
//   updateSingle(id, patch)   — PATCH + refresh
//   deleteSingle(id)          — DELETE + refresh
//
// All write paths reach the EntityClass through the deeper trait chain
// (TraitAttributes → TASV → TASVs → Trait → Traits → EntityClass) and call the
// trait-scoped Apollo methods (createSingleTraitAttribute, …). The trait id +
// TASV id are captured before the refresh (primitives — safe across the tree
// rebuild) and used to re-acquire the relevant instance from the fresh tree.

class TraitAttributes extends WorldChild {

  constructor( traitAttributeSetVersion ) {
    super( traitAttributeSetVersion );
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
    const tasvId      = this.parent.id;
    const trait       = this.parent.parent.parent;   // TraitAttributes → TASV → TASVs → Trait
    const entityClass = trait.parent.parent;          // Trait → Traits → EntityClass
    await this.apollo.createSingleTraitAttribute( entityClass.id, trait.id, tasvId, values );
    await entityClass.loadDetail();
    return this._reacquire( entityClass, trait.id, tasvId, values?.id );
  }

  async updateSingle( id, patch ) {
    const tasvId      = this.parent.id;
    const trait       = this.parent.parent.parent;
    const entityClass = trait.parent.parent;
    await this.apollo.updateSingleTraitAttribute( entityClass.id, trait.id, tasvId, id, patch );
    await entityClass.loadDetail();
    return this._reacquire( entityClass, trait.id, tasvId, id );
  }

  async deleteSingle( id ) {
    const tasvId      = this.parent.id;
    const trait       = this.parent.parent.parent;
    const entityClass = trait.parent.parent;
    await this.apollo.deleteSingleTraitAttribute( entityClass.id, trait.id, tasvId, id );
    await entityClass.loadDetail();
    return null;
  }

  // -------------------------------------------------------------------------

  // Re-acquires one attribute from the freshly-loaded tree — `this` and every
  // intermediate collection are stale after loadDetail() replaces the subtree.
  _reacquire( entityClass, traitId, tasvId, attrId ) {
    return entityClass.traits
      .getSingle( traitId )
      ?.traitAttributeSetVersions
      .getSingle( tasvId )
      ?.attributes
      .getSingle( attrId ) ?? null;
  }

  _populateFromRecords( records ) {
    this._byId.clear();
    // A trait-attribute IS an Attribute — reuse the leaf class directly.
    for ( const raw of records ) {
      this._byId.set( raw.id, new Attribute( this, raw ) );
    }
  }

}

export default TraitAttributes;
