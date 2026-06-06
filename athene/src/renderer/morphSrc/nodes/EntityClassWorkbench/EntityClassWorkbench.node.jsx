// EntityClassWorkbench — page-node. The surface scoped to ONE
// EntityClass, where the user manages its internals (Attributes,
// Traits, Composition, Relations, Taxonomies).
//
// D7 ships the shell: PageHeaderAlpha (with the class's display name)
// + a horizontal tab strip + a content area dispatched off the active
// sub-manager. All five sub-managers render placeholders for now;
// Hermes/Attribute lands in D9, others in D10+.
//
// Class id source: the workbench reads `App.athene.currentClassId` at
// render time. Athene.goToEntityClassWorkbench(id) sets the id before
// flipping the surface, so by the time the workbench mounts the id is
// already in place.

const node = {

  metaData: {
    description: 'The workbench for one entity class (a type of thing being modeled), showing the class name and a row of tabs. The working tabs are Attribute Set Versions (pick a schema version and view or edit its attributes) and Traits (browse, create, edit, or delete the class\'s traits — reusable roles that grant extra attributes); the Composition, Relations, and Taxonomies tabs are placeholders that are not yet usable.',
  },

  signals: {
    // Active sub-manager — drives the content-area dispatch + the
    // active-tab styling. 'attributes' | 'traits' | 'composition' |
    // 'relations' | 'taxonomies'.
    currentSubManager: { type: 'string', default: 'attributes' },
    // Currently-selected ASV id for the Attributes sub-manager.
    // Default is empty until either Chronos's AttributeSetVersion
    // instance defaults it to getLatest() at fetch-completion (E2) or
    // a chip click sets it explicitly. Read by the workbench's Root.jsx
    // to drive Hermes/Attribute's mount key; read by Hermes/Attribute's
    // fetchAllResources (via Athene) to scope the attribute fetch.
    // Eventually one of N "selectedVersionId" signals — one per
    // versioning axis the workbench has tabs for (CSV at E4; trait
    // ASVs, class versions, etc. at E5+).
    selectedAttributeSetVersionId: { type: 'string', default: '' },
    // Two-level Traits tab (T3.2): which trait the user has drilled into.
    // '' ⇒ the trait picker (level 1, Hermes/Trait); a trait id ⇒ that trait's
    // version-management surface (level 2). Set by Hermes/Trait's viewAction
    // button via Athene.setSelectedTraitId; cleared by "← Back to Traits".
    selectedTraitId: { type: 'string', default: '' },
    // Level-2 TASV selection (T3.3): which Trait Attribute Set Version is
    // selected within the drilled-into trait. The trait analog of
    // selectedAttributeSetVersionId; read by Chronos/TraitAttributeSetVersion
    // (mirror) + Hermes/TraitAttribute (scope). Reset to '' whenever
    // selectedTraitId changes, then defaulted to the trait's latest.
    selectedTraitAttributeSetVersionId: { type: 'string', default: '' },
    // Composition tab (C3): which Composition Scheme Version is selected. The
    // class-only analog of selectedAttributeSetVersionId (composition is one
    // level, like the Attributes tab). Read by Chronos/CompositionSchemeVersion
    // (mirror) + Hermes/CompositionDirective (scope), both via Athene's accessor
    // pair. Defaulted to the latest CSV by Chronos on first fetch, or '' when the
    // class has no CSV yet.
    selectedCompositionSchemeVersionId: { type: 'string', default: '' },
  },

  hooks: {
    // Hand the workbench's kernel to Athene so its
    // get/setSelectedAttributeSetVersionId methods can reach this
    // signal from anywhere — Chronos's VersionList writes through this
    // path on chip clicks; Hermes/Attribute's coreFunctions read
    // through it to know which ASV to fetch attributes from.
    //
    // Mirrors how Root.kernelDidInitialize registers the root kernel
    // for navigation. New page-nodes that need this kind of
    // cross-node-from-Athene coordination follow the same pattern.
    kernelDidInitialize( kernel ) {
      kernel.app.athene.registerEntityClassWorkbenchKernel( kernel );
    },
    // MF-1: drop the registration on unmount (identity-guarded in Athene), so a
    // version action still in flight when the user leaves the workbench resolves
    // into a setter that no-ops via `?.` rather than poking this torn-down kernel.
    nodeWillUnmount( kernel ) {
      kernel.app.athene.unregisterEntityClassWorkbenchKernel( kernel );
    },
  },

  modules: {
    Root: { isRoot: true, description: 'The whole class workbench: a header with the class name, a tab strip for switching between Attribute Set Versions, Traits, Composition, Relations, and Taxonomies, and a content area that shows the active tab. The Attribute Set Versions and Traits tabs are functional; Composition, Relations, and Taxonomies show a "coming soon" placeholder.' },
  },

  components: {
    PageHeaderAlpha: { isGlobal: true },
  },

};

export default node;
