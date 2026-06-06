// Base class for every node in the World tree — World itself, every
// collection (EntityClasses, AttributeSetVersions, Attributes, …), and
// every singular domain entity (EntityClass, AttributeSetVersion,
// Attribute, …). Establishes two invariants every descendant gets for
// free:
//
//   1. A non-enumerable `parent` reference, so methods can walk up the
//      tree for context (e.g., AttributeSetVersion reading its parent
//      EntityClass id for an Apollo write URL). Non-enumerable to keep
//      cycles out of JSON serialization — Theta T2 established this
//      pattern for HermesChild's `hermes` reference for the same reason.
//
//   2. Non-enumerable shortcuts to Athene and Apollo regardless of the
//      caller's depth in the tree. `this.athene` always resolves, and
//      `this.apollo` is a convenience for the by-far-most-common reach.
//      Set once at construction; resolved by inspecting the parent —
//      if the parent is itself a WorldChild, we inherit its `athene`;
//      otherwise the parent IS Athene (this is only true for World).
//
// Subclasses just `super(parent)` and the back-references are wired.
//
// Naming distinguishes from AtheneChild (infra-side base, used by
// Apollo and any future framework-level service). WorldChild is for
// domain-tree entities; AtheneChild is for the infrastructure
// Athene orchestrates. Two bases, two roles.

class WorldChild {

  constructor( parent ) {

    // The parent is either Athene (for World) or another WorldChild
    // (for everything else). Resolving `athene` either way:
    //   - parent is a WorldChild → athene = parent.athene
    //   - parent is Athene itself → athene = parent
    const athene = parent instanceof WorldChild ? parent.athene : parent;

    Object.defineProperty( this, 'parent', {
      value:      parent,
      writable:   true,
      enumerable: false,
    } );

    Object.defineProperty( this, 'athene', {
      value:      athene,
      writable:   false,
      enumerable: false,
    } );

    Object.defineProperty( this, 'apollo', {
      value:      athene.apollo,
      writable:   false,
      enumerable: false,
    } );

  }

}

export default WorldChild;
