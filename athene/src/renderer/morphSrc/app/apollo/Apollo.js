import AtheneChild from '../AtheneChild.js';

// HTTP boundary to Apollo — the Node + Fastify world-model backend
// (singularity-engine/apollo, :8001). The single door to backend data: no
// other renderer code makes outbound `fetch` calls, and agents reach the
// world model only through Athene's surface, never this JSON directly.
//
// A5 cutover: this conforms ONCE to Apollo's clean slice-1 REST contract and
// nothing above it re-touches the backend shape again —
//   - plural collections, no verbs-in-path (`/entity-classes`, …/commit is the
//     one action sub-resource);
//   - single-encoded camelCase JSON (no double-encoded `data` string);
//   - envelope `{ success, data, message }` on success,
//     `{ success: false, error: { code, message } }` on failure.
// `_request` unwraps the envelope and returns `data`. The legacy Laravel CCC
// surface (content_class URLs, core-nested snake_case, double-encoded data,
// primary_error, PATCH-to-commit) is retired for this slice.

class Apollo extends AtheneChild {

  constructor( athene ) {
    super( athene );
    this.baseUrl = this.appKernel.getConstant( 'apolloBaseUrl' );
  }

  // One fetch + envelope unwrap for every call. Returns the envelope's `data`
  // on success; throws Error(reason) on network failure, HTTP non-2xx, or
  // `success: false` — reading the clean `error.message`, falling back to
  // `message` then the HTTP status line.
  async _request( method, path, body = undefined ) {
    const opts = { method, headers: { 'Accept': 'application/json' } };
    if ( body !== undefined ) {
      opts.headers[ 'Content-Type' ] = 'application/json';
      opts.body = JSON.stringify( body );
    }
    const res = await fetch( `${ this.baseUrl }${ path }`, opts );
    const env = await res.json().catch( () => null );
    if ( ! res.ok || ! env?.success ) {
      const reason = env?.error?.message ?? env?.message ?? `HTTP ${ res.status } ${ res.statusText }`;
      throw new Error( `Apollo ${ method } ${ path }: ${ reason }` );
    }
    return env.data;
  }

  _classPath( id )         { return `/entity-classes/${ encodeURIComponent( id ) }`; }
  _asvPath( cid, asvId )   { return `${ this._classPath( cid ) }/attribute-set-versions/${ encodeURIComponent( asvId ) }`; }
  // Composition Scheme Versions nest under the class directly (class-only).
  _csvPath( cid, csvId )   { return `${ this._classPath( cid ) }/composition-scheme-versions/${ encodeURIComponent( csvId ) }`; }

  // Trait paths nest one level under the class — the same `attribute-set-versions`
  // segment reappears scoped to a trait (T1: the TASV is byte-for-byte an ASV one
  // level down).
  _traitPath( cid, tid )            { return `${ this._classPath( cid ) }/traits/${ encodeURIComponent( tid ) }`; }
  _traitAsvPath( cid, tid, tasvId ) { return `${ this._traitPath( cid, tid ) }/attribute-set-versions/${ encodeURIComponent( tasvId ) }`; }

  // ── Entity classes ───────────────────────────────────────────────────

  // GET /entity-classes → array of class meta
  // { id, singular, plural, description, profileImgUrl }.
  async listAllEntityClasses() {
    return this._request( 'GET', '/entity-classes' );
  }

  // GET /entity-classes/{id} → the full walk
  // { ...meta, attributeSetVersions: [ { …, attributes: [...] } ] }.
  async getSingleEntityClassDirectoryWalk( id ) {
    return this._request( 'GET', this._classPath( id ) );
  }

  // Same endpoint; kept for API completeness (loadDetail uses the walk above).
  async getSingleEntityClassData( id ) {
    return this._request( 'GET', this._classPath( id ) );
  }

  // POST /entity-classes — { id?, singular, plural, description?, profileImgUrl? }.
  // `id` is the client-supplied kebab machine key here; Apollo also accepts it
  // absent (derives from singular). Returns the created class meta.
  async createSingleEntityClass( values ) {
    return this._request( 'POST', '/entity-classes', values );
  }

  // PATCH /entity-classes/{id} — editable meta { singular?, plural?,
  // description?, profileImgUrl? } (never id). Returns the updated meta.
  async updateSingleEntityClass( id, patch ) {
    return this._request( 'PATCH', this._classPath( id ), patch );
  }

  // DELETE /entity-classes/{id} — removes the class and its ASVs.
  async deleteSingleEntityClass( id ) {
    return this._request( 'DELETE', this._classPath( id ) );
  }

  // ── Attribute Set Versions ─────────────────────────────────────────────

  // POST …/attribute-set-versions — create a new empty draft ASV.
  async createAttributeSetVersion( classId ) {
    return this._request( 'POST', `${ this._classPath( classId ) }/attribute-set-versions` );
  }

  // POST …/attribute-set-versions/{asvId}/commit — draft → committed. Apollo
  // models commit as an explicit action (not a lifecycle PATCH); rejects empty
  // (400) / already-committed (409).
  async commitAttributeSetVersion( classId, asvId ) {
    return this._request( 'POST', `${ this._asvPath( classId, asvId ) }/commit` );
  }

  // DELETE …/attribute-set-versions/{asvId} — only valid while draft (Apollo
  // rejects deletes against committed ASVs with 409).
  async deleteAttributeSetVersionDraft( classId, asvId ) {
    return this._request( 'DELETE', this._asvPath( classId, asvId ) );
  }

  // ── Attributes (embedded in a draft ASV) ───────────────────────────────

  // POST …/{asvId}/attributes — { id, label, dataType, description?, isRequired? }.
  async createSingleAttribute( classId, asvId, values ) {
    return this._request( 'POST', `${ this._asvPath( classId, asvId ) }/attributes`, values );
  }

  // PATCH …/{asvId}/attributes/{attrId} — partial update of editable fields
  // (never id).
  async updateSingleAttribute( classId, asvId, attrId, patch ) {
    return this._request( 'PATCH', `${ this._asvPath( classId, asvId ) }/attributes/${ encodeURIComponent( attrId ) }`, patch );
  }

  // DELETE …/{asvId}/attributes/{attrId}.
  async deleteSingleAttribute( classId, asvId, attrId ) {
    return this._request( 'DELETE', `${ this._asvPath( classId, asvId ) }/attributes/${ encodeURIComponent( attrId ) }` );
  }

  // ── Traits (class-scoped roles — T1) ────────────────────────────────────
  // A trait owns its own ASVs exactly like a class; the methods below mirror
  // the entity-class / ASV / attribute trios, scoped by an extra traitId. The
  // class walk already nests `traits`, so the read path is loadDetail() — these
  // are the writes (+ a list/walk for completeness).

  // GET …/traits → array of trait meta { id, label, description }.
  async listAllTraits( classId ) {
    return this._request( 'GET', `${ this._classPath( classId ) }/traits` );
  }

  // GET …/traits/{traitId} → one trait's full walk
  // { id, label, description, attributeSetVersions: [ { …, attributes:[…] } ] }.
  async getSingleTraitDirectoryWalk( classId, traitId ) {
    return this._request( 'GET', this._traitPath( classId, traitId ) );
  }

  // POST …/traits — { id, label, description? }. `id` is the client-supplied
  // kebab machine key (required here, unlike a class, which can derive it).
  async createSingleTrait( classId, values ) {
    return this._request( 'POST', `${ this._classPath( classId ) }/traits`, values );
  }

  // PATCH …/traits/{traitId} — editable meta { label?, description? } (never id).
  async updateSingleTrait( classId, traitId, patch ) {
    return this._request( 'PATCH', this._traitPath( classId, traitId ), patch );
  }

  // DELETE …/traits/{traitId} — removes the trait and its TASVs.
  async deleteSingleTrait( classId, traitId ) {
    return this._request( 'DELETE', this._traitPath( classId, traitId ) );
  }

  // ── Trait Attribute Set Versions (the TASV lifecycle — mirrors the ASV trio) ──

  // POST …/traits/{traitId}/attribute-set-versions — create a new empty draft TASV.
  async createTraitAttributeSetVersion( classId, traitId ) {
    return this._request( 'POST', `${ this._traitPath( classId, traitId ) }/attribute-set-versions` );
  }

  // POST …/{tasvId}/commit — draft → committed (empty → 400, already-committed → 409).
  async commitTraitAttributeSetVersion( classId, traitId, tasvId ) {
    return this._request( 'POST', `${ this._traitAsvPath( classId, traitId, tasvId ) }/commit` );
  }

  // DELETE …/{tasvId} — only valid while draft (committed → 409).
  async deleteTraitAttributeSetVersionDraft( classId, traitId, tasvId ) {
    return this._request( 'DELETE', this._traitAsvPath( classId, traitId, tasvId ) );
  }

  // ── Trait attributes (embedded in a draft TASV — mirrors the attribute trio) ──

  // POST …/{tasvId}/attributes — { id, label, dataType, description?, isRequired? }.
  async createSingleTraitAttribute( classId, traitId, tasvId, values ) {
    return this._request( 'POST', `${ this._traitAsvPath( classId, traitId, tasvId ) }/attributes`, values );
  }

  // PATCH …/{tasvId}/attributes/{attrId} — partial update of editable fields (never id).
  async updateSingleTraitAttribute( classId, traitId, tasvId, attrId, patch ) {
    return this._request( 'PATCH', `${ this._traitAsvPath( classId, traitId, tasvId ) }/attributes/${ encodeURIComponent( attrId ) }`, patch );
  }

  // DELETE …/{tasvId}/attributes/{attrId}.
  async deleteSingleTraitAttribute( classId, traitId, tasvId, attrId ) {
    return this._request( 'DELETE', `${ this._traitAsvPath( classId, traitId, tasvId ) }/attributes/${ encodeURIComponent( attrId ) }` );
  }

  // ── Composition Scheme Versions (class-only — C1/C2) ────────────────────
  // A class owns CSVs directly (no trait variant); the lifecycle mirrors the ASV
  // trio. The class walk already nests `compositionSchemeVersions`, so the read
  // path is loadDetail() — these are the writes.

  // POST …/composition-scheme-versions — create a new empty draft CSV.
  async createCompositionSchemeVersion( classId ) {
    return this._request( 'POST', `${ this._classPath( classId ) }/composition-scheme-versions` );
  }

  // POST …/{csvId}/commit — draft → committed (empty → 400, already-committed → 409).
  async commitCompositionSchemeVersion( classId, csvId ) {
    return this._request( 'POST', `${ this._csvPath( classId, csvId ) }/commit` );
  }

  // DELETE …/{csvId} — only valid while draft (committed → 409).
  async deleteCompositionSchemeVersionDraft( classId, csvId ) {
    return this._request( 'DELETE', this._csvPath( classId, csvId ) );
  }

  // ── Composition Directives (embedded in a draft CSV) ────────────────────
  // The directive id is SERVER-DERIVED (subClassId or subClassId:traitId), so
  // create sends NO id and returns the created directive (carrying the derived
  // id). On the wire the id's `:` is percent-encoded by encodeURIComponent (→
  // %3A), which Apollo's route decodes back before matching.

  // POST …/{csvId}/directives — { subClassId, traitId?, cardinalityRules, description }.
  async createSingleCompositionDirective( classId, csvId, values ) {
    return this._request( 'POST', `${ this._csvPath( classId, csvId ) }/directives`, values );
  }

  // PATCH …/{csvId}/directives/{directiveId} — { cardinalityRules?, description? }
  // (subClassId / traitId / id are frozen identity, never patched).
  async updateSingleCompositionDirective( classId, csvId, directiveId, patch ) {
    return this._request( 'PATCH', `${ this._csvPath( classId, csvId ) }/directives/${ encodeURIComponent( directiveId ) }`, patch );
  }

  // DELETE …/{csvId}/directives/{directiveId}.
  async deleteSingleCompositionDirective( classId, csvId, directiveId ) {
    return this._request( 'DELETE', `${ this._csvPath( classId, csvId ) }/directives/${ encodeURIComponent( directiveId ) }` );
  }

}

export default Apollo;
