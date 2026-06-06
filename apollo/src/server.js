// Apollo — the Singularity Engine world-model backend.
//
// Node + Fastify over a file-based content-base. This wires the slice-1
// read path (Apollo beta, phase A1): the FileStore seam → the server-side
// World domain tree → the entity-class read routes, behind one envelope +
// error model. Write routes (A2–A4) register onto the same World aggregate.
//
// On-disk layout, walk shape, casing, and the World root are settled in
// VOCABULARY.md + development/beta_implementation_plan_apollo.md.

import Fastify from 'fastify';

import { FileStore }     from './store/FileStore.js';
import { World }         from './domain/World.js';
import entityClassRoutes from './http/routes/entityClasses.js';
import { fail }          from './http/envelope.js';
import { ApolloError }   from './errors.js';

// Env-overridable. Default 8001 so Apollo runs ALONGSIDE the legacy Laravel
// content-creation-center (localhost:8000) during the slice-by-slice
// cutover — Athene's `apolloBaseUrl` flips to this only at A5.
const PORT = Number( process.env.APOLLO_PORT ?? 8001 );
const HOST = process.env.APOLLO_HOST ?? '127.0.0.1';

const app = Fastify( {
  logger: true,
  // Reject unknown body fields (paired with our `additionalProperties: false`
  // schemas) instead of silently stripping them. Fastify's ajv defaults to
  // removeAdditional:true, which would turn a typo'd or forbidden field (e.g.
  // a PATCH trying to set `id`) into a silent no-op — we want a loud 400.
  ajv: { customOptions: { removeAdditional: false } },
} );

// CORS — Athene's renderer (Vite dev server at :5173, and the packaged
// Electron app) fetches this backend cross-origin, so every response needs an
// Access-Control-Allow-Origin header and preflight (OPTIONS) must be answered
// before routing. Permissive `*` / no credentials — mirrors the legacy CCC's
// config/cors.php; fine for a local single-user dev backend. (Swap in a
// stricter policy if Apollo is ever exposed beyond localhost.)
app.addHook( 'onRequest', async ( req, reply ) => {
  reply.header( 'Access-Control-Allow-Origin', '*' );
  if ( req.method === 'OPTIONS' ) {
    reply
      .header( 'Access-Control-Allow-Methods', '*' )
      .header( 'Access-Control-Allow-Headers', '*' )
      .header( 'Access-Control-Max-Age', '86400' )
      .code( 204 )
      .send();
    return reply;
  }
} );

// Compose the domain over the store seam. Swap FileStore for another Store
// implementation and nothing below this line changes.
const store = new FileStore();
const world = new World( store );

// Health / identity — infrastructural, not a domain resource, so they skip
// the {success, data, message} envelope the domain routes use.
app.get( '/health', async () => ( { status: 'ok', service: 'apollo' } ) );
app.get( '/', async () => ( {
  service:     'apollo',
  description: 'Singularity Engine — world-model backend',
  status:      'ok',
} ) );

// Domain routes (enveloped). `world` is injected so routes stay pure handlers.
app.register( entityClassRoutes, { world } );

// One error model for every route: an ApolloError renders as its status +
// code; Fastify's own schema-validation errors become a clean 400; anything
// else is an unexpected 500 (logged, never leaked).
app.setErrorHandler( ( err, req, reply ) => {
  if ( err instanceof ApolloError ) {
    return reply.code( err.statusCode ).send( fail( err.code, err.message ) );
  }
  if ( err.validation ) {
    return reply.code( 400 ).send( fail( 'validation_error', err.message ) );
  }
  // Fastify framework errors (e.g. a malformed JSON body —
  // FST_ERR_CTP_INVALID_JSON_BODY) carry a 4xx statusCode but no
  // `err.validation`. Honor that as a client error rather than letting it fall
  // through to a 500 (the contract forbids 500-on-validation). A genuine
  // internal bug has no statusCode and still becomes the 500 below.
  if ( Number.isInteger( err.statusCode ) && err.statusCode >= 400 && err.statusCode < 500 ) {
    const code = { 400: 'validation_error', 404: 'not_found', 409: 'conflict' }[ err.statusCode ] ?? 'bad_request';
    return reply.code( err.statusCode ).send( fail( code, err.message ) );
  }
  req.log.error( err );
  return reply.code( 500 ).send( fail( 'internal_error', 'An unexpected error occurred.' ) );
} );

// 404 for unknown routes, in the same envelope.
app.setNotFoundHandler( ( req, reply ) => {
  return reply.code( 404 ).send( fail( 'not_found', `No route for ${ req.method } ${ req.url }.` ) );
} );

const start = async () => {
  try {
    await app.listen( { port: PORT, host: HOST } );
  } catch ( err ) {
    app.log.error( err );
    process.exit( 1 );
  }
};

start();
