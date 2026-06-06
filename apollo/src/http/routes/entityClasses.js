// Slice-1 entity-class routes. A1 = READ path; A2 = class CRUD; A3 = ASV
// lifecycle; A4 = attribute CRUD; T1 = traits (class-scoped roles + their
// Attribute Set Versions + trait-attributes).
//
// The ASV + attribute endpoints exist twice — once under a class and once under
// a trait — and both call the SAME owner-parameterized World methods, passing
// `{ classId }` (class) or `{ classId, traitId }` (trait). A trait's ASV is a
// class's ASV one level down, so they share the contract + the implementation.

import { ok }          from '../envelope.js';
import { ApolloError } from '../../errors.js';

// ── Param schemas (format contract + path-traversal guard) ──────────────
const CLASS_ID = { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' };
const TRAIT_ID = { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' };
const ATTR_ID  = { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' };
const ASV_ID   = { type: 'string', pattern: '^[1-9][0-9]*$' };
const CSV_ID   = { type: 'string', pattern: '^[1-9][0-9]*$' };
// A composition-directive id is the deterministic natural key: a kebab
// `subClassId`, optionally followed by `:` + a kebab `traitId`. Clients
// percent-encode the `:` as `%3A` in the path; find-my-way decodes it back
// before this pattern validates the segment.
const DIRECTIVE_ID = { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)?$' };

const classIdParams = { type: 'object', required: [ 'id' ],                       properties: { id: CLASS_ID } };
const asvParams     = { type: 'object', required: [ 'id', 'asvId' ],              properties: { id: CLASS_ID, asvId: ASV_ID } };
const attrParams    = { type: 'object', required: [ 'id', 'asvId', 'attrId' ],    properties: { id: CLASS_ID, asvId: ASV_ID, attrId: ATTR_ID } };

const traitParams     = { type: 'object', required: [ 'id', 'tid' ],                     properties: { id: CLASS_ID, tid: TRAIT_ID } };
const traitAsvParams  = { type: 'object', required: [ 'id', 'tid', 'asvId' ],            properties: { id: CLASS_ID, tid: TRAIT_ID, asvId: ASV_ID } };
const traitAttrParams = { type: 'object', required: [ 'id', 'tid', 'asvId', 'attrId' ],  properties: { id: CLASS_ID, tid: TRAIT_ID, asvId: ASV_ID, attrId: ATTR_ID } };

const csvParams       = { type: 'object', required: [ 'id', 'csvId' ],                properties: { id: CLASS_ID, csvId: CSV_ID } };
const directiveParams = { type: 'object', required: [ 'id', 'csvId', 'directiveId' ], properties: { id: CLASS_ID, csvId: CSV_ID, directiveId: DIRECTIVE_ID } };

// ── Body schemas ────────────────────────────────────────────────────────
// `additionalProperties: false` rejects stray keys (server.js disables ajv's
// removeAdditional, so an unknown field is a loud 400); `id` is absent from
// every update body, so the stable identity can't be reassigned over the wire.
const classMetaProps = {
  singular:      { type: 'string', minLength: 1 },
  plural:        { type: 'string', minLength: 1 },
  description:   { type: 'string' },
  profileImgUrl: { type: [ 'string', 'null' ] },
};
const createClassBody = {
  type: 'object', required: [ 'singular', 'plural' ], additionalProperties: false,
  properties: { id: CLASS_ID, ...classMetaProps },
};
const updateClassBody = {
  type: 'object', minProperties: 1, additionalProperties: false, properties: classMetaProps,
};

// Trait identity: a client-supplied kebab `id` + a `label` (the role name) +
// optional `description`. No singular/plural — a trait is named, not pluralized.
const traitMetaProps = {
  label:       { type: 'string', minLength: 1 },
  description: { type: 'string' },
};
const createTraitBody = {
  type: 'object', required: [ 'id', 'label' ], additionalProperties: false,
  properties: { id: TRAIT_ID, ...traitMetaProps },
};
const updateTraitBody = {
  type: 'object', minProperties: 1, additionalProperties: false, properties: traitMetaProps,
};

// Slice-1 attribute data types — the config-free scalar types. `dynamicList` /
// `optionList` are deferred (they need extra selection-config). Shared by class
// AND trait attributes (a trait-attribute IS an attribute).
const DATA_TYPES = [
  'text', 'richtext', 'email', 'url', 'tel', 'boolean', 'integer', 'float',
  'date', 'time', 'datetime-local', 'json', 'unixTimestamp',
];
const attrProps = {
  label:       { type: 'string', minLength: 1 },
  dataType:    { type: 'string', enum: DATA_TYPES },
  description: { type: 'string' },
  isRequired:  { type: 'boolean' },
};
const attrCreateBody = {
  type: 'object', required: [ 'id', 'label', 'dataType' ], additionalProperties: false,
  properties: { id: ATTR_ID, ...attrProps },
};
const attrUpdateBody = {
  type: 'object', minProperties: 1, additionalProperties: false, properties: attrProps,
};

// Composition directive: a rule "this sub-class goes here, optionally qualified
// by a trait of that sub-class, with this cardinality + description". The id is
// SERVER-DERIVED (subClassId or subClassId:traitId), so it's absent from the
// create body; subClassId/traitId are the id source, so they're FROZEN — absent
// from the update body too. `cardinalityRules` is stored verbatim (string|null);
// grammar-validation lives in the C3 input only (C1 accepts any string).
const directiveProps = {
  subClassId:       CLASS_ID,
  traitId:          TRAIT_ID,
  cardinalityRules: { type: [ 'string', 'null' ] },
  description:      { type: 'string', minLength: 1 },
};
const createDirectiveBody = {
  type: 'object', required: [ 'subClassId', 'cardinalityRules', 'description' ], additionalProperties: false,
  properties: directiveProps,
};
const updateDirectiveBody = {
  type: 'object', minProperties: 1, additionalProperties: false,
  properties: { cardinalityRules: directiveProps.cardinalityRules, description: directiveProps.description },
};

// Fastify plugin. `opts.world` is the World aggregate, injected from server.js.
export default async function entityClassRoutes( app, { world } ) {

  // ════════════════════════════ Entity classes ════════════════════════════
  app.get( '/entity-classes', async () => ok( await world.listEntityClasses() ) );

  app.get( '/entity-classes/:id', { schema: { params: classIdParams } }, async ( req ) => {
    const cls = await world.getEntityClass( req.params.id );
    if ( ! cls ) throw ApolloError.notFound( `Entity class '${ req.params.id }' not found.` );
    return ok( cls );
  } );

  app.post( '/entity-classes', { schema: { body: createClassBody } }, async ( req, reply ) => {
    const meta = await world.createEntityClass( req.body );
    reply.code( 201 );
    return ok( meta, 'Entity class created.' );
  } );

  app.patch( '/entity-classes/:id', { schema: { params: classIdParams, body: updateClassBody } }, async ( req ) =>
    ok( await world.updateEntityClass( req.params.id, req.body ), 'Entity class updated.' ) );

  app.delete( '/entity-classes/:id', { schema: { params: classIdParams } }, async ( req ) =>
    ok( await world.deleteEntityClass( req.params.id ), 'Entity class deleted.' ) );

  // ═══════════════════ Class Attribute Set Versions (A3) ═══════════════════
  // owner = { classId }
  app.get( '/entity-classes/:id/attribute-set-versions', { schema: { params: classIdParams } }, async ( req ) =>
    ok( await world.listAttributeSetVersions( { classId: req.params.id } ) ) );

  app.post( '/entity-classes/:id/attribute-set-versions', { schema: { params: classIdParams } }, async ( req, reply ) => {
    const asv = await world.createAttributeSetVersion( { classId: req.params.id } );
    reply.code( 201 );
    return ok( asv, 'Draft attribute set version created.' );
  } );

  app.post( '/entity-classes/:id/attribute-set-versions/:asvId/commit', { schema: { params: asvParams } }, async ( req ) =>
    ok( await world.commitAttributeSetVersion( { classId: req.params.id }, req.params.asvId ), 'Attribute set version committed.' ) );

  app.delete( '/entity-classes/:id/attribute-set-versions/:asvId', { schema: { params: asvParams } }, async ( req ) =>
    ok( await world.deleteAttributeSetVersion( { classId: req.params.id }, req.params.asvId ), 'Draft attribute set version deleted.' ) );

  // ═══════════════════ Class attributes (A4) ═══════════════════
  app.post( '/entity-classes/:id/attribute-set-versions/:asvId/attributes', { schema: { params: asvParams, body: attrCreateBody } }, async ( req, reply ) => {
    const attribute = await world.createAttribute( { classId: req.params.id }, req.params.asvId, req.body );
    reply.code( 201 );
    return ok( attribute, 'Attribute created.' );
  } );

  app.patch( '/entity-classes/:id/attribute-set-versions/:asvId/attributes/:attrId', { schema: { params: attrParams, body: attrUpdateBody } }, async ( req ) =>
    ok( await world.updateAttribute( { classId: req.params.id }, req.params.asvId, req.params.attrId, req.body ), 'Attribute updated.' ) );

  app.delete( '/entity-classes/:id/attribute-set-versions/:asvId/attributes/:attrId', { schema: { params: attrParams } }, async ( req ) =>
    ok( await world.deleteAttribute( { classId: req.params.id }, req.params.asvId, req.params.attrId ), 'Attribute deleted.' ) );

  // ════════════════════════════ Traits (T1) ════════════════════════════
  app.get( '/entity-classes/:id/traits', { schema: { params: classIdParams } }, async ( req ) =>
    ok( await world.listTraits( req.params.id ) ) );

  app.post( '/entity-classes/:id/traits', { schema: { params: classIdParams, body: createTraitBody } }, async ( req, reply ) => {
    const meta = await world.createTrait( req.params.id, req.body );
    reply.code( 201 );
    return ok( meta, 'Trait created.' );
  } );

  app.get( '/entity-classes/:id/traits/:tid', { schema: { params: traitParams } }, async ( req ) => {
    const trait = await world.getTrait( req.params.id, req.params.tid );
    if ( ! trait ) throw ApolloError.notFound( `Trait '${ req.params.tid }' not found in entity class '${ req.params.id }'.` );
    return ok( trait );
  } );

  app.patch( '/entity-classes/:id/traits/:tid', { schema: { params: traitParams, body: updateTraitBody } }, async ( req ) =>
    ok( await world.updateTrait( req.params.id, req.params.tid, req.body ), 'Trait updated.' ) );

  app.delete( '/entity-classes/:id/traits/:tid', { schema: { params: traitParams } }, async ( req ) =>
    ok( await world.deleteTrait( req.params.id, req.params.tid ), 'Trait deleted.' ) );

  // ═══════════════ Trait Attribute Set Versions (owner = { classId, traitId }) ═══════════════
  const traitOwner = ( req ) => ( { classId: req.params.id, traitId: req.params.tid } );

  app.get( '/entity-classes/:id/traits/:tid/attribute-set-versions', { schema: { params: traitParams } }, async ( req ) =>
    ok( await world.listAttributeSetVersions( traitOwner( req ) ) ) );

  app.post( '/entity-classes/:id/traits/:tid/attribute-set-versions', { schema: { params: traitParams } }, async ( req, reply ) => {
    const asv = await world.createAttributeSetVersion( traitOwner( req ) );
    reply.code( 201 );
    return ok( asv, 'Draft attribute set version created.' );
  } );

  app.post( '/entity-classes/:id/traits/:tid/attribute-set-versions/:asvId/commit', { schema: { params: traitAsvParams } }, async ( req ) =>
    ok( await world.commitAttributeSetVersion( traitOwner( req ), req.params.asvId ), 'Attribute set version committed.' ) );

  app.delete( '/entity-classes/:id/traits/:tid/attribute-set-versions/:asvId', { schema: { params: traitAsvParams } }, async ( req ) =>
    ok( await world.deleteAttributeSetVersion( traitOwner( req ), req.params.asvId ), 'Draft attribute set version deleted.' ) );

  // ═══════════════ Trait attributes ═══════════════
  app.post( '/entity-classes/:id/traits/:tid/attribute-set-versions/:asvId/attributes', { schema: { params: traitAsvParams, body: attrCreateBody } }, async ( req, reply ) => {
    const attribute = await world.createAttribute( traitOwner( req ), req.params.asvId, req.body );
    reply.code( 201 );
    return ok( attribute, 'Attribute created.' );
  } );

  app.patch( '/entity-classes/:id/traits/:tid/attribute-set-versions/:asvId/attributes/:attrId', { schema: { params: traitAttrParams, body: attrUpdateBody } }, async ( req ) =>
    ok( await world.updateAttribute( traitOwner( req ), req.params.asvId, req.params.attrId, req.body ), 'Attribute updated.' ) );

  app.delete( '/entity-classes/:id/traits/:tid/attribute-set-versions/:asvId/attributes/:attrId', { schema: { params: traitAttrParams } }, async ( req ) =>
    ok( await world.deleteAttribute( traitOwner( req ), req.params.asvId, req.params.attrId ), 'Attribute deleted.' ) );

  // ═══════════════ Composition Scheme Versions (C1, class-only) ═══════════════
  // A class owns CSVs directly (no trait variant — contrast the ASV endpoints).
  // The version lifecycle mirrors the ASV block; the embedded leaf is a
  // Composition Directive, not an Attribute.
  app.get( '/entity-classes/:id/composition-scheme-versions', { schema: { params: classIdParams } }, async ( req ) =>
    ok( await world.listCompositionSchemeVersions( req.params.id ) ) );

  app.post( '/entity-classes/:id/composition-scheme-versions', { schema: { params: classIdParams } }, async ( req, reply ) => {
    const csv = await world.createCompositionSchemeVersion( req.params.id );
    reply.code( 201 );
    return ok( csv, 'Draft composition scheme version created.' );
  } );

  app.post( '/entity-classes/:id/composition-scheme-versions/:csvId/commit', { schema: { params: csvParams } }, async ( req ) =>
    ok( await world.commitCompositionSchemeVersion( req.params.id, req.params.csvId ), 'Composition scheme version committed.' ) );

  app.delete( '/entity-classes/:id/composition-scheme-versions/:csvId', { schema: { params: csvParams } }, async ( req ) =>
    ok( await world.deleteCompositionSchemeVersion( req.params.id, req.params.csvId ), 'Draft composition scheme version deleted.' ) );

  // ═══════════════ Composition Directives (embedded in a draft CSV) ═══════════════
  // id is server-derived (subClassId[:traitId]); :directiveId carries the `:`
  // form (clients send it %3A-encoded). Writes go through the draft guard.
  app.post( '/entity-classes/:id/composition-scheme-versions/:csvId/directives', { schema: { params: csvParams, body: createDirectiveBody } }, async ( req, reply ) => {
    const directive = await world.createCompositionDirective( req.params.id, req.params.csvId, req.body );
    reply.code( 201 );
    return ok( directive, 'Composition directive created.' );
  } );

  app.patch( '/entity-classes/:id/composition-scheme-versions/:csvId/directives/:directiveId', { schema: { params: directiveParams, body: updateDirectiveBody } }, async ( req ) =>
    ok( await world.updateCompositionDirective( req.params.id, req.params.csvId, req.params.directiveId, req.body ), 'Composition directive updated.' ) );

  app.delete( '/entity-classes/:id/composition-scheme-versions/:csvId/directives/:directiveId', { schema: { params: directiveParams } }, async ( req ) =>
    ok( await world.deleteCompositionDirective( req.params.id, req.params.csvId, req.params.directiveId ), 'Composition directive deleted.' ) );
}
