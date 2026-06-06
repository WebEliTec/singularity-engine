import WorldChild           from '../../../WorldChild.js';
import AttributeSetVersion  from './AttributeSetVersion.js';

// AttributeSetVersions — the collection of every ASV belonging to one
// EntityClass. Populated from the directory walk by EntityClass.loadDetail();
// the contents replace any prior load (clear + repopulate), so stale
// entries from previous loads can't survive.
//
// Collection method shape per the iota convention (resource name implied
// by the collection):
//
//   getAll()                  — every loaded ASV
//   getSingle(id)             — one by id, or null
//   getLatest()               — the highest-numbered ASV id (matches the
//                               "latest ASV" behavior the retired
//                               AttributeManager defaulted to). Will be
//                               replaced by an explicit Chronos selection
//                               once epsilon lands.
//   getCount()                — Map size
//   createSingle()            — POST a new (draft) ASV + refresh parent
//                               class detail
//
// Per-version lifecycle operations (commit, deleteDraft) live on the
// AttributeSetVersion singular — operations *on* a specific version
// belong to that version, not to the collection.
//
// `_populateFromWalk(walk)` is the I2 hook EntityClass.loadDetail() calls
// — internal, prefixed with underscore. Bypasses the collection's public
// surface to do an authoritative replacement based on Apollo's walk
// response.

class AttributeSetVersions extends WorldChild {

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

  // The highest-numbered ASV id wins. Matches the retired AttributeManager's
  // "latest ASV" pick. Returns null if no ASVs are loaded.
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

  // POSTs a new (draft) ASV for the parent EntityClass. The backend
  // returns the new ASV's id in the success envelope — but rather than
  // trust that, we refresh the whole class detail so the new ASV (and
  // any server-side derived fields) lands in the cache consistently
  // with the rest of the tree.
  async createSingle() {
    const entityClass = this.parent;
    await this.apollo.createAttributeSetVersion( entityClass.id );
    await entityClass.loadDetail();
    // The collection's contents were replaced; the just-created ASV
    // is now the highest-numbered. Returning it via getLatest() gives
    // callers a reference to the freshly-created instance.
    return entityClass.attributeSetVersions.getLatest();
  }

  // -------------------------------------------------------------------------

  _populateFromWalk( walk ) {
    this._byId.clear();
    // Apollo's clean walk nests ASVs as an ordered ARRAY under
    // `attributeSetVersions` (each with a numeric `id`). Key the Map by the
    // STRING id so selection (Chronos) + lookups stay string-based as before.
    const asvRecords = walk?.attributeSetVersions ?? [];
    for ( const raw of asvRecords ) {
      const id = String( raw.id );
      this._byId.set( id, new AttributeSetVersion( this, id, raw ) );
    }
    this._loaded = true;
  }

}

export default AttributeSetVersions;
