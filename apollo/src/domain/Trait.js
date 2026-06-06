// Trait — a reusable role (mixin) a class adopts to gain extra attributes (and,
// later, eligibility to enter relations / attach data sources — the attribute
// facet is just the first). Class-scoped: it lives under its host class; its id
// need only be unique within that class.
//
// Identity-only (`{ id, label, description }`) — like an EntityClass, a Trait's
// lifecycle lives on the Attribute Set Versions it OWNS, not on the trait
// itself. Structurally a Trait is "an owner of Attribute Set Versions" one
// level below the class — which is why the ASV/attribute machinery is shared
// (a trait's ASV is byte-for-byte a class's ASV).

import { AttributeSetVersion } from './AttributeSetVersion.js';

export class Trait {
  // `asvRecords` is empty for a meta-only load (the trait list) and populated
  // for a full walk.
  constructor( record, asvRecords = [] ) {
    this.record               = record;
    this.attributeSetVersions = asvRecords
      .map( r => new AttributeSetVersion( r ) )
      .sort( ( a, b ) => a.id - b.id );
  }

  get id() {
    return this.record.id;
  }

  // Trait meta only — for GET /entity-classes/{id}/traits.
  toMeta() {
    const r = this.record;
    return {
      id:          r.id,
      label:       r.label,
      description: r.description ?? '',
    };
  }

  // Full walk — meta + nested ASVs (each with embedded attributes), mirroring
  // EntityClass.toWalk one level down.
  toWalk() {
    return {
      ...this.toMeta(),
      attributeSetVersions: this.attributeSetVersions.map( asv => asv.toContract() ),
    };
  }
}
