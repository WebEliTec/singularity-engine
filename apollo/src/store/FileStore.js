// FileStore — the directory-as-DB seam (Apollo Decision #4: on-disk layout).
//
// The ONLY place in Apollo that touches the filesystem. The domain calls these
// methods and never sees a path, so the storage substrate stays swappable. It
// deals in RAW on-disk records (parsed JSON) — the domain owns the
// store↔contract mapping.
//
// A1 read · A2 entity-class writes · A3 ASV reads+writes · A4 attributes
// embedded · T1 traits. A class owns a `traits/` folder, and a Trait owns
// Attribute Set Versions exactly like a class does — so the ASV methods are
// generalized over an OWNER: `{ classId }` (a class) or `{ classId, traitId }`
// (a trait). One ASV/attribute implementation serves both.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApolloError } from '../errors.js';

const HERE        = path.dirname( fileURLToPath( import.meta.url ) );
const APOLLO_ROOT = path.resolve( HERE, '..', '..' );                  // apollo/
const WORLD_DIR   = process.env.APOLLO_WORLD_DIR ?? path.join( APOLLO_ROOT, 'world' );

export class FileStore {
  constructor( { worldDir = WORLD_DIR } = {} ) {
    this.worldDir         = worldDir;
    this.entityClassesDir = path.join( worldDir, 'entity-classes' );
  }

  // ── World ────────────────────────────────────────────────────────────
  async readWorldRecord() {
    return this.#readJson( path.join( this.worldDir, 'world.json' ) );
  }

  // ── Entity classes ───────────────────────────────────────────────────
  async listEntityClassIds() {
    return this.#listSubdirs( this.entityClassesDir );
  }
  async readEntityClassRecord( id ) {
    return this.#readJson( path.join( this.#classDir( id ), 'identity.json' ) );
  }
  async createEntityClass( id, record ) {
    await this.#writeIdentity( this.#classDir( id ), record );
  }
  async writeEntityClassRecord( id, record ) {
    await this.#writeJson( path.join( this.#classDir( id ), 'identity.json' ), record );
  }
  async deleteEntityClass( id ) {
    await fs.rm( this.#classDir( id ), { recursive: true, force: true } );
  }

  // ── Traits (nested under a class) ────────────────────────────────────
  async listTraitIds( classId ) {
    return this.#listSubdirs( this.#traitsDir( classId ) );
  }
  async readTraitRecord( classId, traitId ) {
    return this.#readJson( path.join( this.#traitDir( classId, traitId ), 'identity.json' ) );
  }
  async createTrait( classId, traitId, record ) {
    await this.#writeIdentity( this.#traitDir( classId, traitId ), record );
  }
  async writeTraitRecord( classId, traitId, record ) {
    await this.#writeJson( path.join( this.#traitDir( classId, traitId ), 'identity.json' ), record );
  }
  async deleteTrait( classId, traitId ) {
    await fs.rm( this.#traitDir( classId, traitId ), { recursive: true, force: true } );
  }

  // ── Attribute Set Versions (owner = a class OR a trait): read ────────
  // owner: { classId } | { classId, traitId }
  async listAttributeSetVersionRecords( owner ) {
    const dir   = this.#asvDir( owner );
    const files = await fs.readdir( dir ).catch( () => [] );
    const records = await Promise.all(
      files
        .filter( f => /^[0-9]+\.json$/.test( f ) )
        .map( f => this.#readJson( path.join( dir, f ) ) ),
    );
    return records.filter( Boolean );
  }
  async listAttributeSetVersionIds( owner ) {
    const files = await fs.readdir( this.#asvDir( owner ) ).catch( () => [] );
    return files
      .filter( f => /^[0-9]+\.json$/.test( f ) )
      .map( f => Number.parseInt( f, 10 ) )
      .sort( ( a, b ) => a - b );
  }
  async readAttributeSetVersionRecord( owner, asvId ) {
    return this.#readJson( this.#asvFile( owner, asvId ) );
  }

  // ── Attribute Set Versions: write ────────────────────────────────────
  async createAttributeSetVersion( owner, record ) {
    const dir = this.#asvDir( owner );
    await fs.mkdir( dir, { recursive: true } );
    await this.#writeJson( path.join( dir, `${ record.id }.json` ), record );
  }
  async writeAttributeSetVersionRecord( owner, asvId, record ) {
    await this.#writeJson( this.#asvFile( owner, asvId ), record );
  }
  async deleteAttributeSetVersion( owner, asvId ) {
    await fs.rm( this.#asvFile( owner, asvId ), { force: true } );
  }

  // ── Composition Scheme Versions (class-only): read ───────────────────
  // A class owns CSVs directly — no owner axis (a trait does not own them).
  // Directives are EMBEDDED in the CSV record (an array), like attributes in an
  // ASV; only the CSV id traverses the filesystem.
  async listCompositionSchemeVersionRecords( classId ) {
    const dir   = this.#csvDir( classId );
    const files = await fs.readdir( dir ).catch( () => [] );
    const records = await Promise.all(
      files
        .filter( f => /^[0-9]+\.json$/.test( f ) )
        .map( f => this.#readJson( path.join( dir, f ) ) ),
    );
    return records.filter( Boolean );
  }
  async listCompositionSchemeVersionIds( classId ) {
    const files = await fs.readdir( this.#csvDir( classId ) ).catch( () => [] );
    return files
      .filter( f => /^[0-9]+\.json$/.test( f ) )
      .map( f => Number.parseInt( f, 10 ) )
      .sort( ( a, b ) => a - b );
  }
  async readCompositionSchemeVersionRecord( classId, csvId ) {
    return this.#readJson( this.#csvFile( classId, csvId ) );
  }

  // ── Composition Scheme Versions: write ───────────────────────────────
  async createCompositionSchemeVersion( classId, record ) {
    const dir = this.#csvDir( classId );
    await fs.mkdir( dir, { recursive: true } );
    await this.#writeJson( path.join( dir, `${ record.id }.json` ), record );
  }
  async writeCompositionSchemeVersionRecord( classId, csvId, record ) {
    await this.#writeJson( this.#csvFile( classId, csvId ), record );
  }
  async deleteCompositionSchemeVersion( classId, csvId ) {
    await fs.rm( this.#csvFile( classId, csvId ), { force: true } );
  }

  // ── path helpers (with a traversal guard) ────────────────────────────
  #classDir( id ) {
    return path.join( this.entityClassesDir, this.#seg( id ) );
  }
  #traitsDir( classId ) {
    return path.join( this.#classDir( classId ), 'traits' );
  }
  #traitDir( classId, traitId ) {
    return path.join( this.#traitsDir( classId ), this.#seg( traitId ) );
  }
  // The directory that owns an `attribute-set-versions/` folder — a class, or
  // one level deeper, a trait.
  #ownerDir( owner ) {
    return owner.traitId
      ? this.#traitDir( owner.classId, owner.traitId )
      : this.#classDir( owner.classId );
  }
  #asvDir( owner ) {
    return path.join( this.#ownerDir( owner ), 'attribute-set-versions' );
  }
  #asvFile( owner, asvId ) {
    return path.join( this.#asvDir( owner ), `${ this.#seg( String( asvId ) ) }.json` );
  }
  // Composition Scheme Versions live under the class directly (class-only).
  #csvDir( classId ) {
    return path.join( this.#classDir( classId ), 'composition-scheme-versions' );
  }
  #csvFile( classId, csvId ) {
    return path.join( this.#csvDir( classId ), `${ this.#seg( String( csvId ) ) }.json` );
  }
  // A path segment must not escape its parent directory. The HTTP layer
  // validates id formats; this is defense-in-depth so the store is safe alone.
  // Raised as an ApolloError validation fault (400, not a bare Error → 500), so
  // even on the standalone path an unsafe segment renders as a clean validation
  // error — matching Apollo's no-500-on-validation rule (NTH-1).
  #seg( s ) {
    if ( ! s || s.includes( '/' ) || s.includes( '\\' ) || s.includes( '..' ) ) {
      throw ApolloError.validation( `unsafe path segment '${ s }'.` );
    }
    return s;
  }

  // ── internals ────────────────────────────────────────────────────────
  async #listSubdirs( dir ) {
    const entries = await fs.readdir( dir, { withFileTypes: true } ).catch( () => [] );
    return entries.filter( e => e.isDirectory() ).map( e => e.name ).sort();
  }
  async #writeIdentity( dir, record ) {
    await fs.mkdir( dir, { recursive: true } );
    await this.#writeJson( path.join( dir, 'identity.json' ), record );
  }
  // Read + parse a JSON file; ENOENT → null (absence is not an error here).
  async #readJson( file ) {
    try {
      return JSON.parse( await fs.readFile( file, 'utf8' ) );
    } catch ( err ) {
      if ( err.code === 'ENOENT' ) return null;
      throw err;
    }
  }
  // Write a record as pretty JSON (+ trailing newline) — human-readable,
  // git-friendly.
  async #writeJson( file, data ) {
    await fs.writeFile( file, JSON.stringify( data, null, 2 ) + '\n', 'utf8' );
  }
}
