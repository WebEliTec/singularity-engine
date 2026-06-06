// Kernel-aware facade over the Hermes signals that hold resource data.
// Reads `indexData` (the full list) and `singleResourceData` (the
// currently-fetched-detail) on demand and yields `Resource` wrappers.
// One singleton per Hermes mount, constructed by `Hermes.init()`.
//
// **No internal storage.** The signals remain the source of truth —
// signal reactivity, signal serialization, signal diffs all stay
// intact. ResourceCollection is the *view* layer, not the *storage*
// layer. This is what makes the T2 migration low-risk: every
// `setSignal('indexData', …)` call site stays exactly as it is.
//
// **Resource instances are transient.** `getAllResources()` constructs
// fresh wrappers on every call. Cheap (one prop, methods on the
// prototype) and avoids any identity concerns across renders. Modules
// treating Resource as a value, not a key — when React keys are
// needed, use `resource.getId()`.
//
// Vocabulary: items in the `indexData` signal are Athene-side domain
// objects (today: `EntityClass` instances), NOT raw wire-format
// records. "Record" stays reserved for the JSON shape Apollo deals in.
// Local variable naming here uses "item" / "items" — neutral, accurate.
// Method names follow the project-wide convention
// (`{verb}Single|All{ResourceName}`) so callsites name the cardinality.
//

import HermesChild from './HermesChild.js';
import Resource    from './Resource.js';

class ResourceCollection extends HermesChild {

  // The full collection — every item currently in the `indexData`
  // signal, wrapped. Returns a fresh array every call (no caching).
  getAllResources() {
    const items = this.kernel.getSignal( 'indexData' ) ?? [];
    return items.map( item => new Resource( item ) );
  }

  // Cheap length check that avoids constructing N Resource wrappers
  // just to read the count. Use this for "are there any rows yet?"
  // guards, not `getAllResources().length`.
  getResourceCount() {
    return ( this.kernel.getSignal( 'indexData' ) ?? [] ).length;
  }

  // O(N) lookup over the raw `indexData` array. Returns a Resource
  // when found, `null` when not. Doesn't throw on miss — most call
  // sites are speculative (post-save lookups, deep-link resolution).
  findSingleResource( id ) {
    if ( id == null ) { return null; }
    const items = this.kernel.getSignal( 'indexData' ) ?? [];
    const match = items.find( item => item?.id === id );
    return match ? new Resource( match ) : null;
  }

  forEach( fn ) {
    this.getAllResources().forEach( fn );
  }

  // Resource matching `selectedResourceId`. Returns `null` when
  // nothing is selected (e.g. fresh mount, post-discard). Kernel-aware
  // — combines item data with signal state.
  getSelectedResource() {
    const id = this.kernel.getSignal( 'selectedResourceId' );
    return id ? this.findSingleResource( id ) : null;
  }

  // The currently-fetched-detail. Distinct from `getSelectedResource()`
  // in principle: `selectedResourceId` is the user's click target,
  // `singleResourceData` is what the network fetch returned. In
  // practice they track each other (Hermes.selectResource sets both),
  // but the two-signal split exists so the view can stay rendered
  // during an in-flight refetch.
  getCurrentResource() {
    const item = this.kernel.getSignal( 'singleResourceData' );
    return item ? new Resource( item ) : null;
  }

}

export default ResourceCollection;
