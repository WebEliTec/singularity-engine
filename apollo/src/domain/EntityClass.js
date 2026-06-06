// EntityClass — a TYPE of thing modeled (plugin, theme, …). Its stable
// identity lives in identity.json (never its mutable state); its attribute
// schema is versioned as a sequence of Attribute Set Versions.
//
// The server-side mirror of Athene's client-side EntityClass — same name and
// shape, separate code (no shared module; the contract is the only coupling).

import { AttributeSetVersion }     from './AttributeSetVersion.js';
import { CompositionSchemeVersion } from './CompositionSchemeVersion.js';

export class EntityClass {
  // `asvRecords` is empty for a meta-only load (the registry list) and
  // populated for a full walk. `traits` (already-walked Trait instances) and
  // `csvRecords` (the class's Composition Scheme Versions) are likewise
  // populated only for a full walk.
  constructor( record, asvRecords = [], traits = [], csvRecords = [] ) {
    this.record               = record;
    this.attributeSetVersions = asvRecords
      .map( r => new AttributeSetVersion( r ) )
      .sort( ( a, b ) => a.id - b.id );
    this.traits                    = traits;
    this.compositionSchemeVersions = csvRecords
      .map( r => new CompositionSchemeVersion( r ) )
      .sort( ( a, b ) => a.id - b.id );
  }

  get id() {
    return this.record.id;
  }

  // Class meta only — for GET /entity-classes (the registry).
  toMeta() {
    const r = this.record;
    return {
      id:            r.id,
      singular:      r.singular,
      plural:        r.plural,
      description:   r.description   ?? '',
      profileImgUrl: r.profileImgUrl ?? null,
    };
  }

  // The full walk — meta + nested ASVs (each with embedded attributes). One
  // canonical nested shape (Apollo Decision #2), so the client reads the
  // whole class tree from a single GET.
  toWalk() {
    return {
      ...this.toMeta(),
      attributeSetVersions:     this.attributeSetVersions.map( asv => asv.toContract() ),
      traits:                   this.traits.map( t => t.toWalk() ),
      compositionSchemeVersions: this.compositionSchemeVersions.map( csv => csv.toContract() ),
    };
  }
}
