// World — the root aggregate: the whole modeled domain. Owns the entity-class
// registry and is the entry point the HTTP layer talks to. The server-side
// mirror of Athene's client World tree (same names/shape, separate code).
//
// It composes over a Store (the persistence seam) — it never touches the
// filesystem itself. It is the ORCHESTRATION layer: cross-aggregate existence
// checks (R-EXIST-01), the full-class walk, version id-minting (R-IDENT-06), the
// no-self-composition rule (R-COMP-01, a cross-aggregate rule), and store
// sequencing. The lifecycle transitions live on the version entities
// (`AttributeSetVersion` / `CompositionSchemeVersion`) as PURE, record-returning
// operations; World loads → calls the transition → persists. Every invariant
// these layers enforce is DEFINED ONCE in ./rules/ (the registry) and called
// from the enforcement point — see ../../../rules/RULES.formal.md. (Identity CRUD
// for entity classes + traits stays here — it's collection-scoped and
// store-coupled: a clash check needs a store read.)
//
// T1: the attribute-set lifecycle is generalized over an OWNER — a class
// (`{ classId }`) or a trait (`{ classId, traitId }`) — since a Trait owns
// Attribute Set Versions exactly as a class does. Trait identity CRUD mirrors
// entity-class CRUD.

import { EntityClass }             from './EntityClass.js';
import { Trait }                   from './Trait.js';
import { AttributeSetVersion }     from './AttributeSetVersion.js';
import { CompositionSchemeVersion } from './CompositionSchemeVersion.js';
import { ApolloError }             from '../errors.js';
import {
  assertExists, assertIdAvailable, assertDerivableId, mintNextVersionId,
  assertNoSelfComposition, isSelfComposition,
} from './rules/index.js';

export class World {
  constructor( store ) {
    this.store = store;
  }

  // ── Entity classes: read ─────────────────────────────────────────────
  async listEntityClasses() {
    const ids     = await this.store.listEntityClassIds();
    const classes = await Promise.all( ids.map( id => this.#loadClass( id, { walk: false } ) ) );
    return classes.filter( Boolean ).map( c => c.toMeta() );
  }
  async getEntityClass( id ) {
    const cls = await this.#loadClass( id, { walk: true } );
    return cls ? cls.toWalk() : null;
  }

  // ── Entity classes: write ────────────────────────────────────────────
  async createEntityClass( { id: providedId, singular, plural, description = '', profileImgUrl = null } ) {
    const id = providedId ?? slugify( singular );
    assertDerivableId( id, singular );                                    // R-IDENT-04
    assertIdAvailable( await this.store.readEntityClassRecord( id ),      // R-IDENT-01
      `An entity class with id '${ id }'` );
    const record = { id, singular, plural, description, profileImgUrl };
    await this.store.createEntityClass( id, record );
    return new EntityClass( record ).toMeta();
  }
  async updateEntityClass( id, patch ) {
    const record  = await this.#requireClass( id );
    const updated = { ...record, ...patch, id: record.id };
    await this.store.writeEntityClassRecord( id, updated );
    return new EntityClass( updated ).toMeta();
  }
  async deleteEntityClass( id ) {
    await this.#requireClass( id );
    await this.store.deleteEntityClass( id );
    return { id };
  }

  // ── Traits (class-scoped roles; identity CRUD mirrors entity classes) ─
  async listTraits( classId ) {
    await this.#requireClass( classId );
    const ids    = await this.store.listTraitIds( classId );
    const traits = await Promise.all( ids.map( tid => this.#loadTrait( classId, tid, { walk: false } ) ) );
    return traits.filter( Boolean ).map( t => t.toMeta() );
  }
  async getTrait( classId, traitId ) {
    await this.#requireClass( classId );
    const trait = await this.#loadTrait( classId, traitId, { walk: true } );
    return trait ? trait.toWalk() : null;
  }
  // Trait id is client-supplied (kebab, validated at the route), frozen, unique
  // within the class — a trait is named (label), not pluralized, so there's no
  // singular to derive from.
  async createTrait( classId, { id, label, description = '' } ) {
    await this.#requireClass( classId );
    assertIdAvailable( await this.store.readTraitRecord( classId, id ),   // R-IDENT-02
      `A trait with id '${ id }'`, `in entity class '${ classId }'` );
    const record = { id, label, description };
    await this.store.createTrait( classId, id, record );
    return new Trait( record ).toMeta();
  }
  async updateTrait( classId, traitId, patch ) {
    await this.#requireClass( classId );
    const record  = await this.#requireTrait( classId, traitId );
    const updated = { ...record, ...patch, id: record.id };
    await this.store.writeTraitRecord( classId, traitId, updated );
    return new Trait( updated ).toMeta();
  }
  async deleteTrait( classId, traitId ) {
    await this.#requireClass( classId );
    await this.#requireTrait( classId, traitId );
    await this.store.deleteTrait( classId, traitId );
    return { id: traitId };
  }

  // ── Attribute Set Versions (owner = class | trait): read ─────────────
  async listAttributeSetVersions( owner ) {
    await this.#requireOwner( owner );
    const records = await this.store.listAttributeSetVersionRecords( owner );
    return records
      .map( r => new AttributeSetVersion( r ) )
      .sort( ( a, b ) => a.id - b.id )
      .map( asv => asv.toContract() );
  }

  // ── Attribute Set Versions: lifecycle ────────────────────────────────
  async createAttributeSetVersion( owner ) {
    await this.#requireOwner( owner );
    const ids    = await this.store.listAttributeSetVersionIds( owner );
    const nextId = mintNextVersionId( ids );                              // R-IDENT-06
    const record = {
      id:             nextId,
      lifeCycleStage: 'draft',
      createdAt:      nowIso(),
      committedAt:    null,
      attributes:     [],
    };
    await this.store.createAttributeSetVersion( owner, record );
    return new AttributeSetVersion( record ).toContract();
  }
  async commitAttributeSetVersion( owner, asvId ) {
    await this.#requireOwner( owner );
    const asv       = await this.#requireAsv( owner, asvId );
    const committed = asv.commit( nowIso );                 // entity owns the commit invariants
    await this.store.writeAttributeSetVersionRecord( owner, asvId, committed );
    return new AttributeSetVersion( committed ).toContract();
  }
  async deleteAttributeSetVersion( owner, asvId ) {
    await this.#requireOwner( owner );
    const asv = await this.#requireAsv( owner, asvId );
    asv.assertDraft();                                      // entity owns the immutability guard
    await this.store.deleteAttributeSetVersion( owner, asvId );
    return { id: asv.id };
  }

  // ── Attributes (embedded in a draft ASV) ─────────────────────────────
  // World loads + persists; the ASV entity owns the draft-guard + attribute
  // invariants and returns the new record (+ the affected attribute).
  async createAttribute( owner, asvId, body ) {
    await this.#requireOwner( owner );
    const asv = await this.#requireAsv( owner, asvId );
    const { record, attribute } = asv.addAttribute( body );
    await this.store.writeAttributeSetVersionRecord( owner, asvId, record );
    return attribute;
  }
  async updateAttribute( owner, asvId, attrId, patch ) {
    await this.#requireOwner( owner );
    const asv = await this.#requireAsv( owner, asvId );
    const { record, attribute } = asv.updateAttribute( attrId, patch );
    await this.store.writeAttributeSetVersionRecord( owner, asvId, record );
    return attribute;
  }
  async deleteAttribute( owner, asvId, attrId ) {
    await this.#requireOwner( owner );
    const asv    = await this.#requireAsv( owner, asvId );
    const record = asv.removeAttribute( attrId );
    await this.store.writeAttributeSetVersionRecord( owner, asvId, record );
    return { id: attrId };
  }

  // ── Composition Scheme Versions (class-only): read ───────────────────
  // A class owns CSVs directly (never a trait), so these take a plain classId,
  // not an owner — the one structural difference from the ASV block above.
  async listCompositionSchemeVersions( classId ) {
    await this.#requireClass( classId );
    const records = await this.store.listCompositionSchemeVersionRecords( classId );
    return records
      .map( r => new CompositionSchemeVersion( r ) )
      .sort( ( a, b ) => a.id - b.id )
      .map( csv => csv.toContract() );
  }

  // ── Composition Scheme Versions: lifecycle ───────────────────────────
  async createCompositionSchemeVersion( classId ) {
    await this.#requireClass( classId );
    const ids    = await this.store.listCompositionSchemeVersionIds( classId );
    const nextId = mintNextVersionId( ids );                              // R-IDENT-06
    const record = {
      id:                    nextId,
      lifeCycleStage:        'draft',
      createdAt:             nowIso(),
      committedAt:           null,
      compositionDirectives: [],
    };
    await this.store.createCompositionSchemeVersion( classId, record );
    return new CompositionSchemeVersion( record ).toContract();
  }
  async commitCompositionSchemeVersion( classId, csvId ) {
    await this.#requireClass( classId );
    const csv = await this.#requireCsv( classId, csvId );
    // Defense-in-depth for the no-self-composition rule: a CSV must never be
    // committed (→ immutable) while it holds a self-referential directive.
    // createCompositionDirective already blocks ADDING one; this gate catches any
    // that predate the rule or were written outside the API (the same belt-and-
    // suspenders stance as FileStore's path guard). No-op for clean data.
    const self = csv.compositionDirectives.find( d => isSelfComposition( classId, d.subClassId ) );  // R-COMP-01
    if ( self ) {
      throw ApolloError.validation(
        `Cannot commit: composition directive '${ self.id }' composes the class with itself ('${ classId }'). Remove it first.`,
      );
    }
    const committed = csv.commit( nowIso );
    await this.store.writeCompositionSchemeVersionRecord( classId, csvId, committed );
    return new CompositionSchemeVersion( committed ).toContract();
  }
  async deleteCompositionSchemeVersion( classId, csvId ) {
    await this.#requireClass( classId );
    const csv = await this.#requireCsv( classId, csvId );
    csv.assertDraft();
    await this.store.deleteCompositionSchemeVersion( classId, csvId );
    return { id: csv.id };
  }

  // ── Composition Directives (embedded in a draft CSV) ─────────────────
  // World loads + persists; the CSV entity owns the draft-guard, the
  // deterministic id derivation, dup-detection, and the frozen identity.
  async createCompositionDirective( classId, csvId, body ) {
    await this.#requireClass( classId );
    const csv = await this.#requireCsv( classId, csvId );
    // No self-composition (R-COMP-01) — a cross-aggregate rule (it relates the
    // directive to its OWNING class), so it lives at the World layer, not on the
    // CSV entity (which has no host-class reference). Enforced here AND at the
    // commit-gate above; both call the shared `assertNoSelfComposition` /
    // `isSelfComposition`, so the two checks can never drift apart.
    assertNoSelfComposition( classId, body.subClassId );
    const { record, directive } = csv.addDirective( body );
    await this.store.writeCompositionSchemeVersionRecord( classId, csvId, record );
    return directive;
  }
  async updateCompositionDirective( classId, csvId, directiveId, patch ) {
    await this.#requireClass( classId );
    const csv = await this.#requireCsv( classId, csvId );
    const { record, directive } = csv.updateDirective( directiveId, patch );
    await this.store.writeCompositionSchemeVersionRecord( classId, csvId, record );
    return directive;
  }
  async deleteCompositionDirective( classId, csvId, directiveId ) {
    await this.#requireClass( classId );
    const csv    = await this.#requireCsv( classId, csvId );
    const record = csv.removeDirective( directiveId );
    await this.store.writeCompositionSchemeVersionRecord( classId, csvId, record );
    return { id: directiveId };
  }

  // ── internals ────────────────────────────────────────────────────────
  // A full class walk loads the class's own ASVs AND every trait (each walked
  // with its own ASVs); meta-only loads carry neither.
  async #loadClass( id, { walk } ) {
    const record = await this.store.readEntityClassRecord( id );
    if ( ! record ) return null;
    if ( ! walk ) return new EntityClass( record );
    const asvRecords = await this.store.listAttributeSetVersionRecords( { classId: id } );
    const csvRecords = await this.store.listCompositionSchemeVersionRecords( id );
    const traitIds   = await this.store.listTraitIds( id );
    const traits     = await Promise.all( traitIds.map( tid => this.#loadTrait( id, tid, { walk: true } ) ) );
    return new EntityClass( record, asvRecords, traits.filter( Boolean ), csvRecords );
  }
  async #loadTrait( classId, traitId, { walk } ) {
    const record = await this.store.readTraitRecord( classId, traitId );
    if ( ! record ) return null;
    const asvRecords = walk ? await this.store.listAttributeSetVersionRecords( { classId, traitId } ) : [];
    return new Trait( record, asvRecords );
  }

  async #requireClass( classId ) {
    return assertExists( await this.store.readEntityClassRecord( classId ),  // R-EXIST-01
      `Entity class '${ classId }'` );
  }
  async #requireTrait( classId, traitId ) {
    return assertExists( await this.store.readTraitRecord( classId, traitId ),  // R-EXIST-01
      `Trait '${ traitId }'`, `in entity class '${ classId }'` );
  }
  // Asserts the owner exists — the class always, and the trait too when present.
  async #requireOwner( owner ) {
    await this.#requireClass( owner.classId );
    if ( owner.traitId ) {
      await this.#requireTrait( owner.classId, owner.traitId );
    }
  }
  async #requireAsv( owner, asvId ) {
    const record = assertExists( await this.store.readAttributeSetVersionRecord( owner, asvId ),  // R-EXIST-01
      `Attribute set version ${ asvId }`, `in ${ ownerLabel( owner ) }` );
    return new AttributeSetVersion( record );
  }
  async #requireCsv( classId, csvId ) {
    const record = assertExists( await this.store.readCompositionSchemeVersionRecord( classId, csvId ),  // R-EXIST-01
      `Composition scheme version ${ csvId }`, `in entity class '${ classId }'` );
    return new CompositionSchemeVersion( record );
  }
}

// ISO-8601 timestamp for createdAt / committedAt.
const nowIso = () => new Date().toISOString();

// Human label for an owner, for not-found messages.
function ownerLabel( owner ) {
  return owner.traitId
    ? `trait '${ owner.traitId }' of entity class '${ owner.classId }'`
    : `entity class '${ owner.classId }'`;
}

// kebab-case slug from a display name: lowercase, non-alphanumeric runs → '-',
// trimmed. "WP Add-on" → "wp-add-on". Returns '' if nothing usable remains.
function slugify( value ) {
  return String( value ?? '' )
    .trim()
    .toLowerCase()
    .replace( /[^a-z0-9]+/g, '-' )
    .replace( /^-+|-+$/g, '' );
}
