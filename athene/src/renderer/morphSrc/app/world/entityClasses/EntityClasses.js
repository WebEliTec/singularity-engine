import WorldChild  from '../../WorldChild.js';
import EntityClass from './EntityClass.js';

// EntityClasses — the collection of all EntityClass instances in this
// World. Replaces the retired EntityClassManager (formerly under
// app/entityClassManager/), with method names following the iota
// collection convention: since the collection's element type is implied
// by which collection you're inside, methods drop the `…EntityClass(es)`
// suffix:
//
//   getAll()                      — every loaded EntityClass
//   getSingle(id)                 — one by id, or null
//   getCount()                    — Map size
//   loadAll()                     — materialize the list from Apollo
//   createSingle(values)          — POST + refresh
//   updateSingle(id, patch)       — PATCH + refresh
//   deleteSingle(id)              — DELETE + refresh
//   isLoaded()                    — lifecycle gate
//
// Backed by a Map keyed by class id; identity per session — two
// callers asking for `getSingle('organization')` get the same instance.
//
// `_loaded` gates the read paths: throwing "not yet loaded" forces
// callers to be explicit about lifecycle. Otherwise "no classes loaded"
// and "no classes exist" become indistinguishable, which is the source
// of subtle bugs.
//
// All write paths (create/update/delete) follow the same pattern: hit
// Apollo, then `loadAll()` to refresh from server truth. Two round-trips
// per write — chosen over local merge because the server stamps derived
// fields (`updated_at`) that local-merge wouldn't see.

class EntityClasses extends WorldChild {

  constructor( world ) {
    super( world );
    this._byId    = new Map();
    this._loaded  = false;
  }

  // -------------------------------------------------------------------------
  // Read paths
  // -------------------------------------------------------------------------

  async loadAll() {
    const records = await this.apollo.listAllEntityClasses();   // clean array of class meta
    this._byId.clear();
    for ( const record of records ) {
      this._byId.set( record.id, new EntityClass( this, record ) );
    }
    this._loaded = true;
  }

  getAll() {
    this._guardLoaded( 'getAll' );
    return Array.from( this._byId.values() );
  }

  getSingle( id ) {
    this._guardLoaded( `getSingle('${ id }')` );
    return this._byId.get( id ) ?? null;
  }

  getCount() {
    if ( ! this._loaded ) return 0;
    return this._byId.size;
  }

  isLoaded() {
    return this._loaded;
  }

  // -------------------------------------------------------------------------
  // Write paths — Apollo + refresh-from-server
  // -------------------------------------------------------------------------

  async createSingle( values ) {
    this._guardLoaded( 'createSingle' );
    await this.apollo.createSingleEntityClass( values );
    await this.loadAll();
    return this._byId.get( values?.id ) ?? null;
  }

  async updateSingle( id, patch ) {
    this._guardLoaded( `updateSingle('${ id }')` );
    await this.apollo.updateSingleEntityClass( id, patch );
    await this.loadAll();
    return this._byId.get( id ) ?? null;
  }

  async deleteSingle( id ) {
    this._guardLoaded( `deleteSingle('${ id }')` );
    await this.apollo.deleteSingleEntityClass( id );
    await this.loadAll();
    return null;
  }

  // -------------------------------------------------------------------------

  _guardLoaded( methodLabel ) {
    if ( ! this._loaded ) {
      throw new Error( `EntityClasses.${ methodLabel } called before loadAll() — call loadAll() first.` );
    }
  }

}

export default EntityClasses;
