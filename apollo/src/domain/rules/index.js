// The rule registry — the DECLARATIVE catalog binding each rule id to its
// enforcement. Two readers:
//   1. the domain call sites, which import the predicates by name; and
//   2. the binding test (../../../test/rules-binding.test.js), which asserts this
//      registry is in bijection with the Tier-1 model + Tier-2 prose under
//      ../../../../rules/, by id.
//
// `style` ∈ predicate | derivation | declarative | store-guard. A `predicate`
// throws on violation; a `derivation` computes the governed value; `declarative`
// rules are enforced by the route ajv schemas and `store-guard` rules by the
// FileStore — neither has a domain predicate (predicate: null), and the binding
// test checks each rule according to its style.

import { assertVersionDraft, assertVersionNonEmpty } from './lifecycle.js';
import {
  assertIdAvailable, assertMemberIdUnique, assertDerivableId, mintNextVersionId,
} from './identity.js';
import { isSelfComposition, assertNoSelfComposition, deriveDirectiveId } from './composition.js';
import { assertExists } from './existence.js';

export {
  assertVersionDraft, assertVersionNonEmpty,
  assertIdAvailable, assertMemberIdUnique, assertDerivableId, mintNextVersionId,
  isSelfComposition, assertNoSelfComposition, deriveDirectiveId,
  assertExists,
};

export const RULE_REGISTRY = {
  'R-LIFE-01':  { domain: 'LIFE',  style: 'predicate',   predicate: assertVersionDraft,      title: 'Committed versions are terminal (immutability)' },
  'R-LIFE-02':  { domain: 'LIFE',  style: 'predicate',   predicate: assertVersionNonEmpty,   title: 'Commit requires a non-empty member set' },
  'R-IDENT-01': { domain: 'IDENT', style: 'predicate',   predicate: assertIdAvailable,       title: 'Entity-class id is unique' },
  'R-IDENT-02': { domain: 'IDENT', style: 'predicate',   predicate: assertIdAvailable,       title: 'Trait id is unique within its class' },
  'R-IDENT-03': { domain: 'IDENT', style: 'predicate',   predicate: assertMemberIdUnique,    title: 'Member id is unique within its version' },
  'R-IDENT-04': { domain: 'IDENT', style: 'predicate',   predicate: assertDerivableId,       title: 'An entity class has a derivable, non-empty id' },
  'R-IDENT-05': { domain: 'IDENT', style: 'declarative', predicate: null,                    title: 'Entity identity is frozen across updates' },
  'R-IDENT-06': { domain: 'IDENT', style: 'derivation',  predicate: mintNextVersionId,       title: 'Version ids are server-minted, monotone, and ordered' },
  'R-COMP-01':  { domain: 'COMP',  style: 'predicate',   predicate: assertNoSelfComposition, title: 'No self-composition' },
  'R-COMP-02':  { domain: 'COMP',  style: 'derivation',  predicate: deriveDirectiveId,       title: "A directive's id is server-derived and deterministic" },
  'R-EXIST-01': { domain: 'EXIST', style: 'predicate',   predicate: assertExists,            title: 'A targeted resource must exist' },
  'R-SAFE-01':  { domain: 'SAFE',  style: 'store-guard', predicate: null,                    title: 'A persisted id is a filesystem-safe path segment' },
};

// Deliberate non-invariants — recorded so the binding test can confirm the model
// and the code agree on what is intentionally NOT enforced. (FileStore.#seg
// realises R-SAFE-01; the route schemas realise R-IDENT-05 + the boundary rules.)
export const NON_INVARIANTS = [ 'N-COMP-01', 'N-COMP-02', 'N-COMP-03' ];
