// Wraps the I/O side of the resource lifecycle — the coreFunction
// calls that talk through to Apollo + the signal writes that publish
// results to ResourceCollection. Decouples the "where data comes
// from" concern from the "which mode the user is in" concern (which
// lives on the Hermes orchestrator).
//
// Method names follow the project-wide convention
// (`{verb}Single|All{ResourceName}`) so callsites name the cardinality
// at the receiver-line.
//
// Method contract:
//
//   - `loadAllResources` and `loadSingleResource` are **self-contained**:
//     each manages its own `loadingResource` + `resourceError` window.
//     Direct callers (nodeDidMount, Hermes.selectResource) just await;
//     no try/finally needed on their end.
//
//   - `updateSingleResource` is **bare**: returns the coreFunction's
//     promise, no loading/error mgmt. The save flow in `updateResource`
//     (inline kernel today; folded into `Hermes.saveResource` in T7)
//     owns `loadingResource` across the full PATCH → refresh-list →
//     refresh-single sequence so the Save button stays disabled
//     throughout.
//
// `createSingleResource` / `deleteSingleResource` are stubs ready for
// G7 / G8.
//

import HermesChild from './HermesChild.js';

class ResourceIO extends HermesChild {

  async loadAllResources() {
    this.kernel.setSignal( 'loadingResource', true );
    this.kernel.setSignal( 'resourceError', '' );
    try {
      const data = await this.kernel.callCoreFunction( 'fetchAllResources' );
      this.kernel.setSignal( 'indexData', data );
    } catch ( err ) {
      this.kernel.setSignal( 'resourceError', err.message || String( err ) );
    } finally {
      this.kernel.setSignal( 'loadingResource', false );
    }
  }

  // Fetches a single resource via the instance's `fetchSingleResource`
  // coreFunction. `id` is passed explicitly by the caller — we do NOT
  // read it back from `selectedResourceId` via `getSignal`, because
  // `getSignal` returns the (not-yet-flushed) React-state value, not
  // the optimistic cache. After Hermes.selectResource writes
  // `selectedResourceId` and then awaits loadSingleResource, a
  // `getSignal` here would still see the PREVIOUS selection — the bug
  // pattern G2 surfaced in diagnostics. Use `getOptimisticSignal` for
  // the no-arg fallback (future post-save refresh paths).
  async loadSingleResource( id = null ) {
    const targetId = id ?? this.kernel.getOptimisticSignal( 'selectedResourceId' );
    if ( ! targetId ) {
      this.kernel.setSignal( 'singleResourceData', null );
      return;
    }
    this.kernel.setSignal( 'loadingResource', true );
    this.kernel.setSignal( 'resourceError', '' );
    try {
      const data = await this.kernel.callCoreFunction( 'fetchSingleResource', targetId );
      this.kernel.setSignal( 'singleResourceData', data );
    } catch ( err ) {
      this.kernel.setSignal( 'resourceError', err.message || String( err ) );
    } finally {
      this.kernel.setSignal( 'loadingResource', false );
    }
  }

  // The PATCH itself. No loading/error mgmt — `updateResource` (the
  // orchestrator) wraps the full PATCH → refresh-list → refresh-single
  // sequence in its own try/finally so the Save button stays disabled
  // across all three steps.
  async updateSingleResource( id, values ) {
    return this.kernel.callCoreFunction( 'updateSingleResource', id, values );
  }

  // The POST itself. Like updateSingleResource, no loading/error
  // mgmt — `createResource` (the orchestrator method) wraps the
  // full POST → refresh-list → load-single sequence in its own
  // try/finally so the Save button stays disabled throughout.
  async createSingleResource( values ) {
    return this.kernel.callCoreFunction( 'createSingleResource', values );
  }

  // The DELETE itself. Like update/create, no loading/error mgmt —
  // `deleteResource` (the orchestrator method) wraps the full
  // DELETE → refresh-list sequence in its own try/finally so the
  // Confirm button stays disabled across both steps.
  async deleteSingleResource( id ) {
    return this.kernel.callCoreFunction( 'deleteSingleResource', id );
  }

}

export default ResourceIO;
