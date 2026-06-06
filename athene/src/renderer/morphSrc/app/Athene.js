import Apollo from './apollo/Apollo.js';
import World  from './world/World.js';

// Top-level app-kernel orchestrator. The single entry point for every
// app-level concept the Singularity Engine adds on top of the appKernel
// — Apollo (the HTTP boundary to the world model), World (the domain
// tree the user is authoring), navigation (which page-node Root mounts),
// and whatever else lands here as the engine grows.
//
// Athene/World split: Athene is **infrastructure** (Apollo, navigation,
// the runtime concerns of making the tool work). World is **the domain**
// (the model the user is shaping — EntityClasses, relations, taxonomies,
// and everything nested inside). Established at phase I1 (the
// World-OOP-tree beta) — see
// development/beta_implementation_plan_world_oop_tree.md.
//
// Instantiated once in `appKernelDidInitialize` and stashed on the
// appKernel as `appKernel.athene`. Modules reach it via the `App` prop
// (`App.athene.…`) or — preferred — through node-level `moduleProps`
// that hoist specific surfaces (`Athene`, `World`, …) into the module's
// own destructure shape.
//
// Infrastructure children extend `AtheneChild` (Apollo). Domain entities
// extend `WorldChild` (every node in the World tree). Two bases, two
// roles. Apollo MUST be constructed before World — collection writes
// reach for `this.apollo` via the WorldChild back-reference.
//
// Navigation (delta D4): Athene holds a reference to Root's kernel,
// registered by Root's `kernelDidInitialize`. The `goTo*` methods flip
// Root's `currentSurface` signal — Root.jsx re-renders, dispatching to
// the new page-node.

class Athene {

  constructor( appKernel ) {
    this.appKernel = appKernel;
    this.init();
  }

  init() {
    this.apollo = new Apollo( this );
    this.world  = new World( this );
    // Populated by Root.kernelDidInitialize. Until then, the goTo*
    // methods cannot run — but they aren't called before mount either.
    this.rootKernel      = null;
    // Populated by EntityClassWorkbench.kernelDidInitialize. The
    // workbench owns per-tab selection signals (selectedAttributeSet-
    // VersionId, etc.); Athene's getter/setter pair below routes
    // access through this reference so Chronos (writer) and Hermes
    // (reader) both reach the same signal without owning a back-ref.
    // Named for the SPECIFIC workbench it holds — an object workbench
    // (managing an entity object's structure) will land its own
    // `objectWorkbenchKernel` slot alongside this one.
    // Cleared on the workbench's unmount via unregisterEntityClassWorkbenchKernel
    // (identity-guarded, MF-1) — so while it isn't mounted the getters return
    // safe defaults and the setters `?.` no-op.
    this.entityClassWorkbenchKernel = null;
    // Populated by Hermes.kernelDidInitialize when the instance is
    // 'Attribute'. Lets setSelectedAttributeSetVersionId imperatively
    // refresh Hermes's resource list when Chronos flips the ASV scope
    // — the "in-place refresh" workaround for morpheus-core#26 (the
    // async-unmount race that breaks the cleaner re-mount-on-key
    // approach). Cleared on that node's unmount via
    // unregisterHermesAttributeKernel (identity-guarded, MF-1); once null the
    // setter's `?.` no-ops, so a racing async continuation never pokes a
    // torn-down kernel.
    this.hermesAttributeKernel  = null;
    // T3.3: the Hermes/TraitAttribute kernel (level 2 of the Traits tab). Same
    // Pattern-Y role as hermesAttributeKernel — setSelectedTraitAttributeSet-
    // VersionId refreshes its scope in place when the trait's TASV selection
    // changes. Cleared on unmount via unregisterHermesTraitAttributeKernel
    // (identity-guarded, MF-1).
    this.hermesTraitAttributeKernel = null;
    // C3: the Hermes/CompositionDirective kernel (the Composition tab's directive
    // editor). Same Pattern-Y role as hermesAttributeKernel, class-only:
    // setSelectedCompositionSchemeVersionId refreshes its scope in place when the
    // CSV selection changes. Cleared on unmount via
    // unregisterHermesCompositionDirectiveKernel (identity-guarded, MF-1).
    this.hermesCompositionDirectiveKernel = null;
    // Per-instance Chronos kernels, keyed by Chronos instance id
    // (e.g., 'AttributeSetVersion'). Registered during Chronos's
    // kernelDidInitialize. Lets selection-setter methods write a
    // mirror of the selected version id INTO Chronos's own signal
    // so its VersionList re-renders on change — morpheus only
    // re-renders modules whose own signals change, and reading the
    // workbench's signal indirectly through this accessor pair
    // wouldn't trigger a re-render in Chronos. The workbench's signal
    // remains the canonical source-of-truth; the Chronos signal is
    // a render-side mirror. Each entry is cleared on its node's unmount via
    // unregisterChronosKernel (identity-guarded, MF-1).
    this.chronosKernels         = new Map();
    // Set by goToEntityClassWorkbench(id). The workbench page-node
    // reads this on render to know which class it's scoped to.
    this.currentClassId  = null;
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  registerRootKernel( kernel ) {
    this.rootKernel = kernel;
  }

  // -------------------------------------------------------------------------
  // Workbench coordination (epsilon E2)
  //
  // The workbench owns per-tab selection signals. Athene holds a
  // reference to its kernel so Chronos (writer) and Hermes (reader)
  // can both reach those signals without each carrying a back-ref to
  // the workbench. Cross-node coordination routes through Athene in
  // the same shape as navigation — one less morpheus primitive to
  // learn; consistent vocabulary.
  // -------------------------------------------------------------------------

  registerEntityClassWorkbenchKernel( kernel ) {
    this.entityClassWorkbenchKernel = kernel;
  }

  // Identity-guarded unregister on the workbench's unmount (MF-1). Same root
  // cause as the chronos/hermes slots: an action in flight when the user leaves
  // the workbench (→ Home) would otherwise resolve into a setter that pokes the
  // torn-down workbench kernel. Once null, the setters'/accessors' `?.` no-op.
  unregisterEntityClassWorkbenchKernel( kernel ) {
    if ( this.entityClassWorkbenchKernel === kernel ) this.entityClassWorkbenchKernel = null;
  }

  // Called by Hermes.kernelDidInitialize for the `Attribute` instance.
  // Stored so setSelectedAttributeSetVersionId can imperatively
  // refresh the Hermes scope when the ASV selection changes —
  // workaround for morpheus-core#26. If a different page-node mounts
  // its own Hermes/Attribute later, the latest registration wins
  // (the previous kernel has already unmounted at that point).
  registerHermesAttributeKernel( kernel ) {
    this.hermesAttributeKernel = kernel;
  }

  // T3.3 sibling of the above, for the level-2 trait-attribute editor.
  registerHermesTraitAttributeKernel( kernel ) {
    this.hermesTraitAttributeKernel = kernel;
  }

  // C3 sibling, for the Composition tab's directive editor.
  registerHermesCompositionDirectiveKernel( kernel ) {
    this.hermesCompositionDirectiveKernel = kernel;
  }

  // Unregister on unmount (MF-1). IDENTITY-GUARDED: a node clears its slot only
  // if the slot STILL points at this exact kernel — so when the surface
  // remounts (a newer kernel has already registered into the slot), the older
  // kernel's teardown is a no-op and never clobbers the live one (mount/unmount
  // order-independent). Once the slot is null, the setSelected* setters'
  // existing `?.` makes any racing async continuation a safe no-op — it never
  // pokes the torn-down kernel. Called from the Hermes instances' nodeWillUnmount
  // (via the unregisterKernel coreFunction) and Chronos's nodeWillUnmount.
  unregisterHermesAttributeKernel( kernel ) {
    if ( this.hermesAttributeKernel === kernel ) this.hermesAttributeKernel = null;
  }

  unregisterHermesTraitAttributeKernel( kernel ) {
    if ( this.hermesTraitAttributeKernel === kernel ) this.hermesTraitAttributeKernel = null;
  }

  unregisterHermesCompositionDirectiveKernel( kernel ) {
    if ( this.hermesCompositionDirectiveKernel === kernel ) this.hermesCompositionDirectiveKernel = null;
  }

  // Called by Chronos.kernelDidInitialize for each instance. Keyed by
  // instance id ('AttributeSetVersion', and later 'CompositionScheme-
  // Version' etc.) so the setSelected* methods know which Chronos to
  // mirror into. Replacing an existing registration is safe — Chronos
  // unmounts cleanly when its workbench tab is hidden.
  registerChronosKernel( instanceId, kernel ) {
    this.chronosKernels.set( instanceId, kernel );
  }

  // Identity-guarded unregister (MF-1) — see unregisterHermes*Kernel above.
  // Deletes the instance's slot only if it still points at this exact kernel,
  // so a remounted newer kernel is never evicted by the older one's teardown.
  unregisterChronosKernel( instanceId, kernel ) {
    if ( this.chronosKernels.get( instanceId ) === kernel ) this.chronosKernels.delete( instanceId );
  }

  getSelectedAttributeSetVersionId() {
    return this.entityClassWorkbenchKernel?.getSignal( 'selectedAttributeSetVersionId' ) ?? '';
  }

  // Flips up to THREE things in sequence:
  //   1. Workbench's selectedAttributeSetVersionId signal (canonical
  //      source-of-truth; what Hermes reads on its next fetch).
  //   2. Chronos/AttributeSetVersion's selectedVersionId mirror signal
  //      (so its VersionList re-renders with the new is-active chip —
  //      morpheus only re-renders modules whose own signals change).
  //   3. Hermes/Attribute's in-place scope refresh (workaround for
  //      morpheus-core#26 — keying the Hermes mount on the signal trips
  //      morpheus's async-unmount race) — ONLY when asvId is truthy. An
  //      empty asvId means the last draft was just deleted; the workbench
  //      mounts Hermes/Attribute only while a version is selected, so it is
  //      now unmounting — refreshing it would fire async work on an
  //      about-to-unmount kernel (the morpheus-core#29 self-poke). Same
  //      reasoning as setSelectedTraitId's raw clear below.
  setSelectedAttributeSetVersionId( asvId ) {
    this.entityClassWorkbenchKernel?.setSignal( 'selectedAttributeSetVersionId', asvId );
    this.chronosKernels.get( 'AttributeSetVersion' )?.setSignal( 'selectedVersionId', asvId );
    if ( asvId ) this.hermesAttributeKernel?.hermes?.refreshScope();
  }

  // ── Trait selection (T3.2) — drives the two-level Traits tab ──────────────
  // The Traits tab is two levels: pick a trait (level 1, Hermes/Trait), then
  // manage that trait's versions (level 2). `selectedTraitId` is the canonical
  // workbench signal the tab dispatches on — '' ⇒ the picker, a trait id ⇒ that
  // trait's version surface. Hermes/Trait's viewAction button drills in via
  // setSelectedTraitId; the workbench's "← Back to Traits" clears it.
  //
  // T3.3 grows the setter to also mirror into Chronos/TraitAttributeSetVersion
  // + refresh Hermes/TraitAttribute, exactly as the ASV setter above does, once
  // the level-2 engines exist.
  getSelectedTraitId() {
    return this.entityClassWorkbenchKernel?.getSignal( 'selectedTraitId' ) ?? '';
  }

  // Drilling into a different trait — or "← Back to Traits" (traitId '') —
  // changes selectedTraitId, which re-renders the workbench and UNMOUNTS the
  // level-2 surface. So we clear only the CANONICAL TASV signal here, with a raw
  // setSignal — deliberately NOT routing through setSelectedTraitAttributeSet-
  // VersionId. The level-2 Chronos mirror + Hermes scope are discarded with that
  // unmount and re-default on the next drill-in (Chronos's fetchAllVersions); the
  // mirror-aware setter would instead fire refreshScope on the about-to-unmount
  // editor → a self-poke on a torn-down kernel (morpheus-core#29). This is why
  // review finding SF-1's "use the setter" suggestion is intentionally not
  // applied — the raw clear is correct and safe for every real path.
  setSelectedTraitId( traitId ) {
    this.entityClassWorkbenchKernel?.setSignal( 'selectedTraitId', traitId );
    this.entityClassWorkbenchKernel?.setSignal( 'selectedTraitAttributeSetVersionId', '' );
  }

  getSelectedTraitAttributeSetVersionId() {
    return this.entityClassWorkbenchKernel?.getSignal( 'selectedTraitAttributeSetVersionId' ) ?? '';
  }

  // The level-2 analog of setSelectedAttributeSetVersionId — flips the same
  // things one level deeper: the canonical workbench signal, the
  // Chronos/TraitAttributeSetVersion mirror (so its chip strip re-renders), and
  // — ONLY when tasvId is truthy — the Hermes/TraitAttribute in-place scope
  // refresh (Pattern Y / morpheus-core#26). An empty tasvId means the last draft
  // was just deleted; the workbench mounts the editor only while a version is
  // selected, so it is now unmounting — refreshing it would self-poke an
  // about-to-unmount kernel (morpheus-core#29). (The drill-out / "Back to Traits"
  // path clears this signal raw, via setSelectedTraitId, for the same reason.)
  setSelectedTraitAttributeSetVersionId( tasvId ) {
    this.entityClassWorkbenchKernel?.setSignal( 'selectedTraitAttributeSetVersionId', tasvId );
    this.chronosKernels.get( 'TraitAttributeSetVersion' )?.setSignal( 'selectedVersionId', tasvId );
    if ( tasvId ) this.hermesTraitAttributeKernel?.hermes?.refreshScope();
  }

  // ── Composition Scheme Version selection (C3) — drives the Composition tab ──
  // Class-only, so this is the exact shape of the ASV accessor pair (NOT the
  // two-level trait machinery): the Composition tab is one level (Chronos/CSV
  // strip + Hermes/CompositionDirective editor), like the Attributes tab.
  getSelectedCompositionSchemeVersionId() {
    return this.entityClassWorkbenchKernel?.getSignal( 'selectedCompositionSchemeVersionId' ) ?? '';
  }

  // Flips the same things as setSelectedAttributeSetVersionId, one family over:
  // the canonical workbench signal, the Chronos/CompositionSchemeVersion mirror
  // (so its chip strip re-renders), and — ONLY when csvId is truthy — the
  // Hermes/CompositionDirective in-place scope refresh (Pattern Y /
  // morpheus-core#26). An empty csvId means the last draft was just deleted; the
  // workbench mounts the directive editor only while a version is selected, so it
  // is now unmounting — refreshing it would self-poke an about-to-unmount kernel
  // (morpheus-core#29). Mirrors setSelectedAttributeSetVersionId.
  setSelectedCompositionSchemeVersionId( csvId ) {
    this.entityClassWorkbenchKernel?.setSignal( 'selectedCompositionSchemeVersionId', csvId );
    this.chronosKernels.get( 'CompositionSchemeVersion' )?.setSignal( 'selectedVersionId', csvId );
    if ( csvId ) this.hermesCompositionDirectiveKernel?.hermes?.refreshScope();
  }

  goToHome() {
    this.rootKernel.setSignal( 'currentSurface', 'home' );
  }

  goToEntityClassRegistry() {
    this.rootKernel.setSignal( 'currentSurface', 'classRegistry' );
  }

  // Stashes the class id so the workbench knows which class it's
  // scoped to, then flips the surface. The workbench page-node reads
  // `this.currentClassId` at render time.
  goToEntityClassWorkbench( id ) {
    this.currentClassId = id;
    this.rootKernel.setSignal( 'currentSurface', 'classWorkbench' );
  }

}

export default Athene;
