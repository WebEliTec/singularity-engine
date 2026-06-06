// CompositionSchemeVersion — a SPEC version whose content is a class's set of
// Composition Directives (NOT attributes): "how this class is composed out of
// other classes." Draft → committed lifecycle, exactly as an Attribute Set
// Version, but the embedded leaf is a Composition Directive, not an Attribute.
//
// A class owns Composition Scheme Versions directly (class-only — a trait does
// not own them), so unlike the ASV entity there is no owner axis here.
//
// Like AttributeSetVersion, it applies its transitions as PURE, record-returning
// operations (the entity never touches the store — World loads it, calls a
// transition, and persists the returned record). The INVARIANTS they enforce
// (R-LIFE-01/02, R-IDENT-03, R-EXIST-01) and the directive-id derivation
// (R-COMP-02) are defined once in ./rules/ and called here. See
// ../../../rules/RULES.formal.md.

import {
  assertVersionDraft, assertVersionNonEmpty, assertMemberIdUnique, assertExists,
  deriveDirectiveId,
} from './rules/index.js';

const LABEL = 'Composition scheme version';

export class CompositionSchemeVersion {
  constructor( record ) {
    this.record = record;
  }

  get id()          { return this.record.id; }
  get isDraft()     { return this.record.lifeCycleStage === 'draft'; }
  get isCommitted() { return this.record.lifeCycleStage === 'committed'; }

  // The embedded directive list — always an array (never a missing key).
  get compositionDirectives() {
    return Array.isArray( this.record.compositionDirectives ) ? this.record.compositionDirectives : [];
  }

  // ── lifecycle transitions (pure: assert + return a NEW record; World persists) ──
  commit( nowIso ) {
    assertVersionDraft( this, LABEL );
    assertVersionNonEmpty( this.compositionDirectives, 'composition scheme version', 'composition directive' );
    return { ...this.record, lifeCycleStage: 'committed', committedAt: nowIso() };
  }
  assertDraft() {
    assertVersionDraft( this, LABEL );
  }

  // ── embedded directive transitions (pure) ────────────────────────────
  // The id is DERIVED from subClassId[:traitId] (R-COMP-02) — hence
  // subClassId/traitId are the frozen identity (the update body omits them;
  // re-target = delete + new).
  addDirective( { subClassId, traitId, cardinalityRules, description } ) {
    this.assertDraft();
    const id = deriveDirectiveId( subClassId, traitId );
    assertMemberIdUnique( this.compositionDirectives, id, 'Composition directive', 'composition scheme version' );
    // Omit traitId entirely when absent (keep the on-disk shape free of
    // `traitId: undefined`/null noise — an unqualified directive has no key).
    const directive = traitId == null
      ? { id, subClassId, cardinalityRules, description }
      : { id, subClassId, traitId, cardinalityRules, description };
    return { record: { ...this.record, compositionDirectives: [ ...this.compositionDirectives, directive ] }, directive };
  }
  updateDirective( directiveId, patch ) {
    this.assertDraft();
    const directives = this.compositionDirectives.slice();
    const idx        = directives.findIndex( d => d.id === directiveId );
    assertExists( idx === -1 ? null : directives[ idx ],
      `Composition directive '${ directiveId }'`, `in composition scheme version ${ this.id }` );
    // id / subClassId / traitId are frozen identity — the route body omits them,
    // so `...patch` only carries cardinalityRules / description; re-pin id.
    const directive = { ...directives[ idx ], ...patch, id: directiveId };
    directives[ idx ] = directive;
    return { record: { ...this.record, compositionDirectives: directives }, directive };
  }
  removeDirective( directiveId ) {
    this.assertDraft();
    assertExists( this.compositionDirectives.some( d => d.id === directiveId ) || null,
      `Composition directive '${ directiveId }'`, `in composition scheme version ${ this.id }` );
    return { ...this.record, compositionDirectives: this.compositionDirectives.filter( d => d.id !== directiveId ) };
  }

  // Contract shape (camelCase). Directives are stored camelCase already, so they
  // pass through; the array guard keeps the client's shape stable even for an
  // empty draft (always [], never a missing key or an id-keyed object).
  toContract() {
    const r = this.record;
    return {
      id:                    r.id,
      lifeCycleStage:        r.lifeCycleStage,
      createdAt:             r.createdAt   ?? null,
      committedAt:           r.committedAt ?? null,
      compositionDirectives: Array.isArray( r.compositionDirectives ) ? r.compositionDirectives : [],
    };
  }
}
