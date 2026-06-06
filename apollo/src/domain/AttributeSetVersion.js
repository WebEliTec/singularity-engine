// AttributeSetVersion — a SPEC version: the file IS its content (its set of
// attributes). Draft → committed lifecycle. (Composite versions — class /
// world versions, which bind child-version-ids — arrive in later slices.)
//
// It wraps a raw store record and applies its lifecycle + embedded-attribute
// transitions as PURE, record-returning operations — the entity never touches
// the store; the World aggregate loads it, calls a transition, and persists the
// returned record. The INVARIANTS those transitions enforce (R-LIFE-01/02,
// R-IDENT-03, R-EXIST-01) are defined once in ./rules/ and called here, so the
// rule logic is single-sourced across every call site. See
// ../../../rules/RULES.formal.md.

import {
  assertVersionDraft, assertVersionNonEmpty, assertMemberIdUnique, assertExists,
} from './rules/index.js';

const LABEL = 'Attribute set version';

export class AttributeSetVersion {
  constructor( record ) {
    this.record = record;
  }

  get id()          { return this.record.id; }
  get isDraft()     { return this.record.lifeCycleStage === 'draft'; }
  get isCommitted() { return this.record.lifeCycleStage === 'committed'; }

  // The embedded attribute set — always an array (never a missing key), so the
  // attribute transitions can read it unconditionally.
  get attributes() {
    return Array.isArray( this.record.attributes ) ? this.record.attributes : [];
  }

  // ── lifecycle transitions (pure: assert + return a NEW record; World persists) ──

  // Commit the draft → committed: R-LIFE-01 (must be a draft) then R-LIFE-02
  // (must hold ≥1 attribute). The clock is injected so the entity stays pure.
  commit( nowIso ) {
    assertVersionDraft( this, LABEL );
    assertVersionNonEmpty( this.attributes, 'attribute set version', 'attribute' );
    return { ...this.record, lifeCycleStage: 'committed', committedAt: nowIso() };
  }

  // The immutability guard (R-LIFE-01) — used by delete and by every embedded-
  // attribute write below.
  assertDraft() {
    assertVersionDraft( this, LABEL );
  }

  // ── embedded attribute transitions (pure) ────────────────────────────
  // Each returns { record, attribute } (or a bare record for removal); the
  // entity guards draft (R-LIFE-01) + the attribute invariant, World persists.
  addAttribute( { id, label, dataType, description = '', isRequired = false } ) {
    this.assertDraft();
    assertMemberIdUnique( this.attributes, id, 'Attribute', 'attribute set version' );
    const attribute = { id, label, dataType, description, isRequired };
    return { record: { ...this.record, attributes: [ ...this.attributes, attribute ] }, attribute };
  }
  updateAttribute( attrId, patch ) {
    this.assertDraft();
    const attributes = this.attributes.slice();
    const idx        = attributes.findIndex( a => a.id === attrId );
    assertExists( idx === -1 ? null : attributes[ idx ],
      `Attribute '${ attrId }'`, `in attribute set version ${ this.id }` );
    // `id` is the frozen identity — never reassigned (the route body omits it).
    const attribute = { ...attributes[ idx ], ...patch, id: attrId };
    attributes[ idx ] = attribute;
    return { record: { ...this.record, attributes }, attribute };
  }
  removeAttribute( attrId ) {
    this.assertDraft();
    assertExists( this.attributes.some( a => a.id === attrId ) || null,
      `Attribute '${ attrId }'`, `in attribute set version ${ this.id }` );
    return { ...this.record, attributes: this.attributes.filter( a => a.id !== attrId ) };
  }

  // Contract shape (camelCase). Attributes are stored camelCase already, so they
  // pass through; the array guard keeps the client's shape stable even for an
  // empty draft (always [], never a missing key or an id-keyed object).
  toContract() {
    const r = this.record;
    return {
      id:             r.id,
      lifeCycleStage: r.lifeCycleStage,
      createdAt:      r.createdAt   ?? null,
      committedAt:    r.committedAt ?? null,
      attributes:     Array.isArray( r.attributes ) ? r.attributes : [],
    };
  }
}
