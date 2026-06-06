// Value object wrapping a single resource. Pure data + thin
// accessors; not a HermesChild. Modules reach Resources through
// `ResourceCollection` — they never `new Resource(...)` themselves.
//
// Why a value object (not HermesChild): Resources are constructed on
// demand by ResourceCollection's read paths. Many wrappers per render
// is fine because no kernel ref means no cycle concerns, and the
// allocations are tiny (one property; all methods on the prototype).
// Same shape as Jung's `Coordinates` — pure value with statics +
// instance accessors.
//
// What `data` is: today, for the EntityClass instance, it's an
// `EntityClass` domain object from world.entityClasses (post-iota I1) —
// itself a wrapper exposing flat camelCase getters. Resource's
// accessors delegate through those getters via plain property access
// (`this.data[fieldId]`). The Attribute instance wraps Attribute
// domain objects the same way (relocated to world per I2).
//
// Vocabulary note: the wrapped value is deliberately `data`, not
// `record`. "Record" stays reserved for the raw wire-format JSON one
// layer further down (Apollo response → EntityClass constructor's
// `_raw`). Resource sits above that boundary — what it holds may
// already be a domain wrapper itself, so calling it a record would
// mislead.
class Resource {

  constructor( data ) {
    this.data = data;
  }

  getId() {
    return this.data?.id ?? null;
  }

  // Falls back to id when no displayName is exposed. For EntityClass
  // the `displayName` getter is the capitalized singular; for other
  // resource types without that getter, id is a safe last resort.
  getDisplayName() {
    return this.data?.displayName ?? this.data?.id ?? '';
  }

  // Per-field accessor. Delegates to whatever the underlying data
  // exposes — a class getter, a plain property, etc. Returns
  // `undefined` when the field isn't present; callers default at the
  // call site.
  getFieldValue( fieldId ) {
    return this.data?.[ fieldId ];
  }

}

export default Resource;
