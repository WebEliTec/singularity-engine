// Base class for everything Athene constructs and holds — Apollo,
// EntityClassManager, and the rest of the app-level OOP layer that
// grows on top of the appKernel. All children receive the parent
// `athene` in their constructor and need the same two pieces of
// binding boilerplate.
//
// `this.appKernel` — convenience field so methods can write
// `this.appKernel.foo()` instead of `this.athene.appKernel.foo()`. Set
// on every subclass for sibling-pattern consistency.
//
// `this.athene` — load-bearing. Defined as a NON-enumerable property
// (rather than a plain assignment) so `JSON.stringify` on the
// diagnostics state doesn't recurse infinitely: every AtheneChild holds
// a back-reference to Athene, which holds references to every child, so
// enumerable would close a cycle DiagnosticsDev would walk into. The
// same protection that JungChild applies in the install-wp reference app.
// `writable: true` so test rigs can stub it; constructors never reassign
// in practice.

class AtheneChild {

  constructor( athene ) {
    this.appKernel = athene.appKernel;
    Object.defineProperty( this, 'athene', { value: athene, writable: true } );
  }

}

export default AtheneChild;
