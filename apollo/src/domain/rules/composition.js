// Domain COMP — composition invariants. Canonical model:
// ../../../../rules/RULES.formal.md (COMP).

import { ApolloError } from '../../errors.js';

// R-COMP-01 — No self-composition (the pure rule predicate). A directive's
// sub-class must differ from its host class — regardless of any trait qualifier.
// Both enforcement points (add + commit-gate) call THIS, so the comparison can
// never diverge between them (the divergence this whole `rules/` model prevents).
export function isSelfComposition( hostClassId, subClassId ) {
  return subClassId === hostClassId;
}

// R-COMP-01 (add path) — throws 400 when a directive would compose its host.
export function assertNoSelfComposition( hostClassId, subClassId ) {
  if ( isSelfComposition( hostClassId, subClassId ) ) {
    throw ApolloError.validation(
      `A class cannot compose itself: '${ hostClassId }' cannot be its own composition partner.`,
    );
  }
}

// R-COMP-02 — A directive's id is the deterministic natural key: `subClassId`
// alone, or `subClassId:traitId` when trait-qualified. Server-derived, never
// client-supplied (`traitId == null` covers both null and undefined = ⊥).
export function deriveDirectiveId( subClassId, traitId ) {
  return traitId == null ? subClassId : `${ subClassId }:${ traitId }`;
}
