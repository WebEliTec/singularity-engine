// Domain EXIST — referential existence. Canonical model:
// ../../../../rules/RULES.formal.md (EXIST).

import { ApolloError } from '../../errors.js';

// R-EXIST-01 — A targeted resource must exist. Returns the resource when present
// (so callers can use the looked-up value); throws 404 otherwise. `subject` +
// `location` assemble the message: "<subject> not found[ <location>]."
export function assertExists( resource, subject, location = '' ) {
  if ( ! resource ) {
    throw ApolloError.notFound( `${ subject } not found${ location ? ' ' + location : '' }.` );
  }
  return resource;
}
