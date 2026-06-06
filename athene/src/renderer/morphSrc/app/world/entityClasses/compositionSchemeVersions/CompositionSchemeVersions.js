import WorldChild               from '../../../WorldChild.js';
import CompositionSchemeVersion from './CompositionSchemeVersion.js';

// CompositionSchemeVersions — the collection of every Composition Scheme
// Version (CSV) belonging to one EntityClass. A CSV is a separately-versioned
// bag of Composition Directives ("how this class is composed of other
// classes") — a SIBLING of attributeSetVersions under the class, class-only
// (no trait level), so this collection is a near-exact mirror of
// AttributeSetVersions: the version level is identical; only the embedded leaf
// differs (Composition Directive, not Attribute).
//
// Populated from the directory walk by EntityClass.loadDetail() via
// `_populateFromWalk(walk)` (clear + repopulate from server truth). Collection
// method shape per the iota convention:
//
//   getAll()        — every loaded CSV
//   getSingle(id)   — one by id, or null
//   getLatest()     — the highest-numbered CSV id (the Chronos default-to-latest
//                     selection mirrors the ASV behaviour)
//   getCount()      — Map size
//   createSingle()  — POST a new (draft) CSV + refresh parent class detail
//
// Per-version lifecycle (commit, deleteDraft) lives on the CompositionScheme-
// Version singular — operations *on* a specific version belong to that version.

class CompositionSchemeVersions extends WorldChild {

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

  // The highest-numbered CSV id wins (Chronos defaults its selection to the
  // latest version, as with ASVs). Returns null if no CSVs are loaded.
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

  // POSTs a new (draft) CSV for the parent EntityClass, then refreshes the
  // whole class detail so the new CSV lands in the cache consistently with the
  // rest of the tree. A new class starts with ZERO CSVs (no auto-v1), so this
  // is how the first scheme version is created (the Composition tab's
  // empty-state action in C3).
  async createSingle() {
    const entityClass = this.parent;
    await this.apollo.createCompositionSchemeVersion( entityClass.id );
    await entityClass.loadDetail();
    // The collection's contents were replaced; the just-created CSV is now the
    // highest-numbered. getLatest() hands callers the fresh instance.
    return entityClass.compositionSchemeVersions.getLatest();
  }

  // -------------------------------------------------------------------------

  _populateFromWalk( walk ) {
    this._byId.clear();
    // Apollo's clean walk nests CSVs as an ordered ARRAY under
    // `compositionSchemeVersions` (each with a numeric `id`). Key the Map by the
    // STRING id so selection (Chronos) + lookups stay string-based, as with ASVs.
    const csvRecords = walk?.compositionSchemeVersions ?? [];
    for ( const raw of csvRecords ) {
      const id = String( raw.id );
      this._byId.set( id, new CompositionSchemeVersion( this, id, raw ) );
    }
    this._loaded = true;
  }

}

export default CompositionSchemeVersions;
