// Domain LIFE — version-lifecycle invariants. Pure predicates: the single
// definition each enforcement point calls, so the rule can never diverge between
// call sites. Canonical model: ../../../../rules/RULES.formal.md (LIFE).

import { ApolloError } from '../../errors.js';

// R-LIFE-01 — Committed versions are terminal (immutability). A committed version
// admits no transition — re-commit, member write, or delete. Throws 409.
// `version` exposes `isCommitted` + `id`; `label` names the version kind.
export function assertVersionDraft( version, label ) {
  if ( version.isCommitted ) {
    throw ApolloError.conflict( `${ label } ${ version.id } is committed and immutable.` );
  }
}

// R-LIFE-02 — Commit requires a non-empty member set. Throws 400. `label` and
// `memberNoun` are the (lower-case) version kind and its member kind.
export function assertVersionNonEmpty( members, label, memberNoun ) {
  if ( members.length === 0 ) {
    throw ApolloError.validation(
      `Cannot commit an empty ${ label }. Add at least one ${ memberNoun } first.`,
    );
  }
}
