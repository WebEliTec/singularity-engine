// Domain IDENT — identity & uniqueness invariants. Canonical model:
// ../../../../rules/RULES.formal.md (IDENT).

import { ApolloError } from '../../errors.js';

// R-IDENT-01 / R-IDENT-02 — An id must be available (no existing record holds it).
// `existing` is the store-read record (or null); `subject` + `location` assemble
// the message ("<subject> already exists[ <location>].") Throws 409.
export function assertIdAvailable( existing, subject, location = '' ) {
  if ( existing ) {
    throw ApolloError.conflict( `${ subject } already exists${ location ? ' ' + location : '' }.` );
  }
}

// R-IDENT-03 — A member's id is unique within its version. Throws 409.
// `memberNoun` is the capitalised member kind; `label` the version kind.
export function assertMemberIdUnique( members, id, memberNoun, label ) {
  if ( members.some( m => m.id === id ) ) {
    throw ApolloError.conflict(
      `${ memberNoun } with id '${ id }' already exists in this ${ label }.`,
    );
  }
}

// R-IDENT-04 — An entity class must end up with a derivable, non-empty id.
// `id` is the supplied-or-derived id (a derived id is the slugified singular).
// Throws 400.
export function assertDerivableId( id, singular ) {
  if ( ! id ) {
    throw ApolloError.validation( `Could not derive a valid id from singular '${ singular }'.` );
  }
}

// R-IDENT-06 — Version ids are server-minted: max(existing)+1, or 1 when none.
// The minting IS the rule (a pure derivation — nothing to throw; the client
// never supplies a version id). `existingIds` is the list of current ids.
export function mintNextVersionId( existingIds ) {
  return existingIds.length ? Math.max( ...existingIds ) + 1 : 1;
}
