// Base class for everything Hermes constructs and holds — sub-
// entities (Lifecycle, WorkingCopy, ResourceIO, Validation in later
// theta steps) all extend this. Centralises the two pieces of
// binding boilerplate every child needs.
//
// `this.kernel` — a non-load-bearing convenience field so methods can
// write `this.kernel.foo()` instead of `this.hermes.kernel.foo()`. Set
// on every subclass for sibling-pattern consistency; not every
// subclass will read it on day one, but the cold reader writing new
// code in any subclass should be able to expect the same shape.
//
// `this.hermes` — load-bearing. Defined as a NON-enumerable property
// (rather than a plain assignment) so `JSON.stringify` on the
// diagnostics state doesn't recurse infinitely: every HermesChild
// holds a back-reference to Hermes, which holds references to every
// HermesChild, so enumerable would close a cycle the diagnostics
// layer would walk into. `writable: true` so test rigs can stub it;
// constructors never reassign in practice.
//
// Mirrors `JungChild` in some-morpheus-based-app exactly, by design.
class HermesChild {

  constructor( hermes ) {
    this.kernel = hermes.kernel;
    Object.defineProperty( this, 'hermes', { value: hermes, writable: true } );
  }

}

export default HermesChild;
