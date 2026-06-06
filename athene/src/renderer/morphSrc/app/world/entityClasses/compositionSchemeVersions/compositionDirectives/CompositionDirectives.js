import WorldChild           from '../../../../WorldChild.js';
import CompositionDirective  from './CompositionDirective.js';

// CompositionDirectives — the collection of every Composition Directive inside
// one CompositionSchemeVersion. The analogue of Attributes (one level down from
// the version), but a DISTINCT class — a directive is NOT an attribute: its
// shape is { id, subClassId, traitId?, cardinalityRules, description } and its
// id is SERVER-DERIVED (subClassId or subClassId:traitId), never client-supplied.
//
// Method shape per the iota convention:
//   getAll()                  — every loaded directive
//   getSingle(id)             — one by id, or null
//   getCount()                — Map size
//   createSingle(values)      — POST + refresh parent EntityClass; values carry
//                               { subClassId, traitId?, cardinalityRules,
//                               description } with NO id (the server derives it)
//   updateSingle(id, patch)   — PATCH + refresh (patch = cardinalityRules /
//                               description only; subClassId/traitId are frozen)
//   deleteSingle(id)          — DELETE + refresh
//
// All write paths follow the Attributes pattern: Apollo call → entityClass
// .loadDetail() (rebuild from server truth) → re-acquire the fresh instance
// (`this` is stale after the reload, its parent CSV having been replaced).
// The one twist vs Attributes: create re-acquires by the id the SERVER returns
// (the derived natural key), since there is no client-supplied id to predict.

class CompositionDirectives extends WorldChild {

  constructor( compositionSchemeVersion ) {
    super( compositionSchemeVersion );
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
    const entityClass = this.parent.parent.parent;  // CSV → CSVs → EntityClass
    const csvId       = this.parent.id;
    // The server derives the id (subClassId[:traitId]) and returns the created
    // directive — re-acquire by THAT id, not a predicted client id.
    const created = await this.apollo.createSingleCompositionDirective( entityClass.id, csvId, values );
    await entityClass.loadDetail();
    return entityClass.compositionSchemeVersions
      .getSingle( csvId )
      ?.compositionDirectives
      .getSingle( created?.id ) ?? null;
  }

  async updateSingle( id, patch ) {
    const entityClass = this.parent.parent.parent;
    const csvId       = this.parent.id;
    await this.apollo.updateSingleCompositionDirective( entityClass.id, csvId, id, patch );
    await entityClass.loadDetail();
    return entityClass.compositionSchemeVersions
      .getSingle( csvId )
      ?.compositionDirectives
      .getSingle( id ) ?? null;
  }

  async deleteSingle( id ) {
    const entityClass = this.parent.parent.parent;
    const csvId       = this.parent.id;
    await this.apollo.deleteSingleCompositionDirective( entityClass.id, csvId, id );
    await entityClass.loadDetail();
    return null;
  }

  // -------------------------------------------------------------------------

  _populateFromRecords( records ) {
    this._byId.clear();
    // Apollo embeds directives as an ordered ARRAY inside the CSV (each with its
    // deterministic `id`); key the Map by it.
    for ( const raw of records ) {
      this._byId.set( raw.id, new CompositionDirective( this, raw ) );
    }
  }

}

export default CompositionDirectives;
