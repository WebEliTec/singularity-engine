// Chronos — generic version-management UI engine. The peer to Hermes:
// where Hermes handles CRUD over a *resource* family, Chronos handles
// the draft/committed lifecycle over a *versioned-entity* family.
// One node, many instances; each instance describes one of the engine's
// five versioning axes (deep dive §4):
//
//   - AttributeSetVersion           (E1 — lands here)
//   - CompositionSchemeVersion      (E4 — proves the engine pattern)
//   - TraitAttributeSetVersion      (E5+)
//   - ClassVersion                  (E5+)
//   - ClassObjectStructureVersion   (E5+)
//
// Each instance overrides:
//   - coreData (the version-family metadata)
//   - coreFunctions (binds the engine to its slice of the World tree —
//     post-iota each versioned-entity family is a collection there)
//
// E1 scope: read-only display of the version list. E2 added selection
// coordination through Athene. E3 adds lifecycle ACTIONS (create a new
// draft, commit a draft, delete a draft) — an action row beneath the
// strip whose generic orchestration (in-flight / error / confirm sub-
// state) lives in the kernel block, and whose World-tree binding lives
// in each instance's coreFunctions. The second instance (E4) layers on
// without reshaping any of this.

const node = {

  metaData: {
    description: 'A generic version-management engine for one kind of versioned schema: it shows every version of that schema as a strip of chips (each marked Draft or Committed) and lets the user select a version, start a new draft, commit a draft to make it permanent, or delete a draft. Committed versions are permanent and cannot be changed or removed.',
  },

  config: {
    defaultPaths: {
      modules: '/modules',
    },
  },

  signals: {

    // Loaded list of version objects for this instance + current scope
    // (e.g., all ASVs for the currently-selected EntityClass). Each
    // element is a domain object from the World tree, carrying its
    // own .id, .lifeCycleStage, .createdAt, etc.
    versionList:    { type: 'array',   default: [] },

    loadingVersions: { type: 'boolean', default: false },
    versionsError:   { type: 'string',  default: '' },

    // Mirror of the workbench's selectedVersionId for THIS Chronos
    // instance's family. VersionList reads this so the chip strip
    // re-renders on selection change — morpheus only re-renders
    // modules whose own signals change, so reading the workbench's
    // signal directly through Athene wouldn't trigger a re-render
    // here. The mirror is kept in sync by Athene's setSelected
    // method (writes both signals); the workbench's copy remains the
    // canonical source-of-truth that Hermes reads (it lives on a
    // longer-lived kernel for any future cross-tab persistence).
    selectedVersionId: { type: 'string', default: '' },

    // E3 — lifecycle-action UI state (generic across instances):
    //   actionInFlight  — a create/commit/delete is awaiting the server;
    //                     disables the action row + shows a pending label.
    //   pendingDeleteId — the version id awaiting delete confirmation.
    //                     Non-empty means the action row shows the inline
    //                     confirm for it — Chronos's analog of Hermes's
    //                     G8 delete-confirm sub-state. Cleared on
    //                     confirm or cancel.
    //   actionError     — last action failure message, kept distinct from
    //                     versionsError (which is the initial-fetch error).
    actionInFlight:  { type: 'boolean', default: false },
    pendingDeleteId: { type: 'string',  default: '' },
    actionError:     { type: 'string',  default: '' },

  },

  coreDataSchemas: {
    versionCollectionMeta: {
      type:        'object',
      required:    true,
      description: 'Describes the version family: { collectionId, singular, plural, collectionLabel }. Drives the strip header + chip labels.',
    },
  },

  coreData: {
    versionCollectionMeta: {
      collectionId:    'version_collection',
      singular:        'Version',
      plural:          'Versions',
      collectionLabel: 'Versions',
    },
  },

  coreFunctionSchemas: {
    fetchAllVersions: {
      params:      [],
      returns:     'array',
      async:       true,
      description: 'Returns the full list of versions for this instance at the current scope. Each element is a domain object exposing at minimum .id and .lifeCycleStage. Called by nodeDidMount and again after every lifecycle action.',
    },
    createNewVersion: {
      params:      [],
      returns:     'void',
      async:       true,
      description: 'Creates a new draft version for this instance at the current scope (empty-start; fork-from-latest-committed is a deferred follow-up — see the Chronos beta E5+), reloads versionList, and selects the new draft. Bound to the World tree in the instance block.',
    },
    commitVersion: {
      params:      [ { name: 'versionId', type: 'string', description: 'the version to commit (draft → committed)' } ],
      returns:     'void',
      async:       true,
      description: 'Commits the given draft version, reloads versionList, and keeps it selected (now committed).',
    },
    deleteDraftVersion: {
      params:      [ { name: 'versionId', type: 'string', description: 'the draft version to delete (committed versions are immutable)' } ],
      returns:     'void',
      async:       true,
      description: 'Deletes the given draft version, reloads versionList, and selects the latest remaining version.',
    },
    selectVersion: {
      params:      [ { name: 'versionId', type: 'string', description: 'the version to select' } ],
      returns:     'void',
      async:       false,
      description: 'Selects the given version — flips this instance\'s canonical workbench selection (and its mirror + co-mounted editor refresh) via the right Athene setter. Bound per instance so VersionList stays instance-agnostic (T3.3).',
    },
  },

  coreFunctions: {
    async fetchAllVersions( kernel ) {
      throw new Error( `[Chronos:${ kernel.instanceId }] No fetchAllVersions configured. Override in the instance's coreFunctions block.` );
    },
    async createNewVersion( kernel ) {
      throw new Error( `[Chronos:${ kernel.instanceId }] No createNewVersion configured. Override in the instance's coreFunctions block.` );
    },
    async commitVersion( kernel, versionId ) {
      throw new Error( `[Chronos:${ kernel.instanceId }] No commitVersion configured. Override in the instance's coreFunctions block.` );
    },
    async deleteDraftVersion( kernel, versionId ) {
      throw new Error( `[Chronos:${ kernel.instanceId }] No deleteDraftVersion configured. Override in the instance's coreFunctions block.` );
    },
    selectVersion( kernel, versionId ) {
      throw new Error( `[Chronos:${ kernel.instanceId }] No selectVersion configured. Override in the instance's coreFunctions block.` );
    },
  },

  // Generic action orchestration (E3) — instance-agnostic. The intent
  // methods are what ActionRow calls; runVersionAction wraps the
  // instance's coreFunction with in-flight + error handling so the
  // module stays a thin reactor. The destructive path is gated behind a
  // pendingDeleteId confirm sub-state (request → confirm/cancel).
  //
  // "Which version is selected" is read from THIS instance's own
  // `selectedVersionId` mirror signal (T3.3) — not a hardcoded Athene
  // accessor — so these methods serve every instance (AttributeSetVersion,
  // TraitAttributeSetVersion, …). The mirror equals the canonical workbench
  // selection (Athene's setter writes both), so this is behaviour-preserving
  // for the ASV instance while finally making the engine truly generic.
  kernel: {
    async runVersionAction( actionId, ...args ) {
      this.setSignal( 'actionError', '' );
      this.setSignal( 'actionInFlight', true );
      try {
        await this.callCoreFunction( actionId, ...args );
      } catch ( err ) {
        this.setSignal( 'actionError', err?.message ?? String( err ) );
      } finally {
        this.setSignal( 'actionInFlight', false );
      }
    },

    createVersion() {
      return this.runVersionAction( 'createNewVersion' );
    },

    commitSelected() {
      return this.runVersionAction( 'commitVersion', this.getSignal( 'selectedVersionId' ) );
    },

    // Destructive: arm the inline confirm rather than deleting immediately.
    requestDeleteSelected() {
      this.setSignal( 'pendingDeleteId', this.getSignal( 'selectedVersionId' ) );
    },

    cancelDelete() {
      this.setSignal( 'pendingDeleteId', '' );
    },

    async confirmDelete() {
      const id = this.getSignal( 'pendingDeleteId' );
      await this.runVersionAction( 'deleteDraftVersion', id );
      this.setSignal( 'pendingDeleteId', '' );
    },
  },

  hooks: {
    // Register this instance's kernel with Athene so the engine's
    // cross-node setter can write the mirror signal (see
    // selectedVersionId in `signals`). Each Chronos instance registers
    // itself under its instance id so Athene knows which kernel to
    // address when flipping selection.
    kernelDidInitialize( kernel ) {
      kernel.app.athene.registerChronosKernel( kernel.instanceId, kernel );
    },
    // MF-1: drop this kernel's Athene registration on unmount (identity-guarded
    // in Athene). A version action or fetch that resolves AFTER this surface is
    // torn down then finds an empty slot and no-ops via `?.`, instead of poking
    // this destroyed kernel's mirror signal (which would throw apiMisuse).
    nodeWillUnmount( kernel ) {
      kernel.app.athene.unregisterChronosKernel( kernel.instanceId, kernel );
    },
    async nodeDidMount( kernel ) {
      try {
        kernel.setSignal( 'loadingVersions', true );
        kernel.setSignal( 'versionsError', '' );
        const versions = await kernel.callCoreFunction( 'fetchAllVersions' );
        kernel.setSignal( 'versionList', Array.isArray( versions ) ? versions : [] );
      } catch ( err ) {
        kernel.setSignal( 'versionsError', err?.message ?? String( err ) );
        kernel.setSignal( 'versionList', [] );
      } finally {
        kernel.setSignal( 'loadingVersions', false );
      }
    },
  },

  modules: {
    Root:        { isRoot: true, description: 'The overall layout: the strip of version chips on top with the lifecycle action buttons directly beneath it.' },
    VersionList: { description: 'The horizontal strip of version chips. Each chip shows a version and whether it is a Draft or Committed; clicking a chip selects that version, which then opens it elsewhere in the workbench.' },
    ActionRow:   { description: 'The row of action buttons below the strip. It always offers creating a new draft version; when the selected version is a draft it also offers committing it or deleting it. Deleting a draft first shows an inline confirmation prompt before it is removed.' },
  },

  instances: {

    // AttributeSetVersion — versioning axis #1 in the deep dive. Scoped
    // to the EntityClass the workbench is currently inside (read from
    // Athene.currentClassId). Reads from iota's World tree:
    // world.entityClasses.getSingle(classId).attributeSetVersions.
    AttributeSetVersion: {
      metaData: {
        description: 'Manages the versions of the attribute schema for the entity class the user is currently working in: pick a version to view, start a new draft, commit a draft to lock it in, or delete a draft. Each version is one draft-or-committed revision of that class\'s set of attributes (its fields).',
      },
      coreData: {
        versionCollectionMeta: {
          collectionId:    'attribute_set_version',
          singular:        'Version',
          plural:          'Versions',
          collectionLabel: 'Attribute Set Versions',
        },
      },
      coreFunctions: {
        // Ensures the EntityClass's subtree is loaded, then returns the
        // ASV collection's contents. Both Chronos and Hermes/Attribute
        // mount in the same tab and both can trigger loadDetail —
        // a second call is cheap (one HTTP round-trip) and idempotent;
        // optimization can wait until it actually matters.
        //
        // Defaults selection on first load (E2): if no ASV is yet
        // selected for this workbench, pick the latest. Hermes/Attribute
        // reads the same signal — once this defaulting fires, Hermes
        // re-mounts (via the workbench's key prop) against the same
        // ASV it was already showing via its getLatest fallback, so
        // the data displayed stays consistent through the switch.
        async fetchAllVersions( kernel ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          await entityClass.loadDetail();
          const versions = entityClass.attributeSetVersions.getAll();
          // The selection to reflect: the existing canonical one, or — on first
          // load, when none is set — the latest, promoted to canonical (routed
          // through the setter so the co-mounted editor scopes to it).
          let selectedId = athene.getSelectedAttributeSetVersionId();
          if ( ! selectedId ) {
            const latest = entityClass.attributeSetVersions.getLatest();
            if ( latest ) {
              selectedId = latest.id;
              athene.setSelectedAttributeSetVersionId( latest.id );
            }
          }
          // MF-2: re-sync THIS freshly-mounted kernel's mirror so VersionList
          // highlights the active chip (a tab round-trip resets the mirror to ''
          // while the canonical selection persists). Sync from the LOCAL
          // selectedId — NOT a getSelected…() re-read: when the branch above just
          // set it, that getSignal still returns the pre-set '' in this same
          // execution cycle (the React-state timing trap), which would clobber the
          // mirror the setter just set to the latest version.
          kernel.setSignal( 'selectedVersionId', selectedId );
          return versions;
        },

        // E3 lifecycle actions — bound to iota's World tree
        // (entityClass.attributeSetVersions). Each writes through the
        // collection / version, then re-reads getAll() into versionList
        // (loadDetail() inside the World-tree write REPLACES the
        // collection's instances, so the old signal value is stale), and
        // routes selection through Athene — which mirrors into this
        // strip AND refreshes the co-mounted Hermes/Attribute scope.
        async createNewVersion( kernel ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          const created     = await entityClass.attributeSetVersions.createSingle();
          kernel.setSignal( 'versionList', entityClass.attributeSetVersions.getAll() );
          if ( created ) athene.setSelectedAttributeSetVersionId( created.id );
        },
        async commitVersion( kernel, versionId ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          const asv         = entityClass.attributeSetVersions.getSingle( versionId );
          if ( ! asv ) throw new Error( `Attribute Set Version ${ versionId } not found.` );
          await asv.commit();
          kernel.setSignal( 'versionList', entityClass.attributeSetVersions.getAll() );
          athene.setSelectedAttributeSetVersionId( versionId ); // stays selected, now committed
        },
        async deleteDraftVersion( kernel, versionId ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          const asv         = entityClass.attributeSetVersions.getSingle( versionId );
          if ( ! asv ) throw new Error( `Attribute Set Version ${ versionId } not found.` );
          await asv.deleteDraft();
          kernel.setSignal( 'versionList', entityClass.attributeSetVersions.getAll() );
          const latest = entityClass.attributeSetVersions.getLatest();
          athene.setSelectedAttributeSetVersionId( latest ? latest.id : '' );
        },
        // Chip selection — flips the ASV selection (was VersionList's inline
        // Athene call before T3.3 made the strip instance-agnostic).
        selectVersion( kernel, versionId ) {
          kernel.app.athene.setSelectedAttributeSetVersionId( versionId );
        },
      },
    },

    // TraitAttributeSetVersion — versioning axis #3 (deep dive §4); fulfils the
    // Chronos beta's E5. The level-2 version strip of the Traits tab: scoped to
    // the SELECTED TRAIT inside the current class (currentClassId +
    // selectedTraitId). Reads the T2 World tree:
    // …traits.getSingle(traitId).traitAttributeSetVersions.
    //
    // Re-acquire note: a TASV write runs entityClass.loadDetail(), which
    // REPLACES the Trait instances under entityClass.traits (the collection
    // object is stable, its members are fresh). So unlike the ASV instance —
    // whose collection hangs directly off the stable entityClass — the trait
    // must be RE-READ after each write. `tasvsOf()` re-reads the whole chain
    // every call, so it always returns the fresh collection.
    TraitAttributeSetVersion: {
      metaData: {
        description: 'Manages the versions of a trait\'s attribute schema — the attribute sets of the trait the user has drilled into: pick a version to view, start a new draft, commit a draft to lock it in, or delete a draft. Each version is one draft-or-committed revision of that trait\'s set of attributes.',
      },
      coreData: {
        versionCollectionMeta: {
          collectionId:    'trait_attribute_set_version',
          singular:        'Version',
          plural:          'Versions',
          collectionLabel: 'Trait Attribute Set Versions',
        },
      },
      coreFunctions: {
        async fetchAllVersions( kernel ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          await entityClass.loadDetail();
          const trait = entityClass.traits.getSingle( athene.getSelectedTraitId() );
          if ( ! trait ) return [];
          const tasvs = trait.traitAttributeSetVersions;
          let selectedId = athene.getSelectedTraitAttributeSetVersionId();
          if ( ! selectedId ) {
            const latest = tasvs.getLatest();
            if ( latest ) {
              selectedId = latest.id;
              athene.setSelectedTraitAttributeSetVersionId( latest.id );
            }
          }
          // MF-2: re-sync this kernel's mirror from the LOCAL selectedId, not a
          // getSelected…() re-read (stale within this cycle — see the
          // AttributeSetVersion instance above).
          kernel.setSignal( 'selectedVersionId', selectedId );
          return tasvs.getAll();
        },
        async createNewVersion( kernel ) {
          const athene  = kernel.app.athene;
          const traitId = athene.getSelectedTraitId();
          const tasvsOf = () => athene.world.entityClasses.getSingle( athene.currentClassId ).traits.getSingle( traitId ).traitAttributeSetVersions;
          const created = await tasvsOf().createSingle();
          kernel.setSignal( 'versionList', tasvsOf().getAll() );
          if ( created ) athene.setSelectedTraitAttributeSetVersionId( created.id );
        },
        async commitVersion( kernel, versionId ) {
          const athene  = kernel.app.athene;
          const traitId = athene.getSelectedTraitId();
          const tasvsOf = () => athene.world.entityClasses.getSingle( athene.currentClassId ).traits.getSingle( traitId ).traitAttributeSetVersions;
          const tasv    = tasvsOf().getSingle( versionId );
          if ( ! tasv ) throw new Error( `Trait Attribute Set Version ${ versionId } not found.` );
          await tasv.commit();
          kernel.setSignal( 'versionList', tasvsOf().getAll() );
          athene.setSelectedTraitAttributeSetVersionId( versionId ); // stays selected, now committed
        },
        async deleteDraftVersion( kernel, versionId ) {
          const athene  = kernel.app.athene;
          const traitId = athene.getSelectedTraitId();
          const tasvsOf = () => athene.world.entityClasses.getSingle( athene.currentClassId ).traits.getSingle( traitId ).traitAttributeSetVersions;
          const tasv    = tasvsOf().getSingle( versionId );
          if ( ! tasv ) throw new Error( `Trait Attribute Set Version ${ versionId } not found.` );
          await tasv.deleteDraft();
          kernel.setSignal( 'versionList', tasvsOf().getAll() );
          const latest = tasvsOf().getLatest();
          athene.setSelectedTraitAttributeSetVersionId( latest ? latest.id : '' );
        },
        selectVersion( kernel, versionId ) {
          kernel.app.athene.setSelectedTraitAttributeSetVersionId( versionId );
        },
      },
    },

    // CompositionSchemeVersion — versioning axis #3 (deep dive §4); fulfils the
    // Chronos beta's E4 (the long-pending second-engine milestone). The version
    // strip of the Composition tab: scoped to the EntityClass the workbench is
    // inside (currentClassId), exactly like the AttributeSetVersion instance —
    // composition is CLASS-ONLY (no trait axis), so this mirrors the ASV instance
    // (a stable collection off entityClass), not the trait re-acquire one. Reads
    // the C2 World tree:
    // world.entityClasses.getSingle(classId).compositionSchemeVersions.
    //
    // Empty-state: a fresh class has zero CSVs — the strip is empty and ActionRow
    // offers "+ New Version" to create the first scheme version (no special UI).
    CompositionSchemeVersion: {
      metaData: {
        description: 'Manages the versions of the composition scheme for the entity class the user is currently working in — how the class is composed of other classes: pick a version to view, start a new draft, commit a draft to lock it in, or delete a draft. Each version is one draft-or-committed revision of that class\'s set of composition directives.',
      },
      coreData: {
        versionCollectionMeta: {
          collectionId:    'composition_scheme_version',
          singular:        'Version',
          plural:          'Versions',
          collectionLabel: 'Composition Scheme Versions',
        },
      },
      coreFunctions: {
        async fetchAllVersions( kernel ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          await entityClass.loadDetail();
          const versions = entityClass.compositionSchemeVersions.getAll();
          // Default selection to latest on first load (routed through the setter so
          // the co-mounted directive editor scopes to it).
          let selectedId = athene.getSelectedCompositionSchemeVersionId();
          if ( ! selectedId ) {
            const latest = entityClass.compositionSchemeVersions.getLatest();
            if ( latest ) {
              selectedId = latest.id;
              athene.setSelectedCompositionSchemeVersionId( latest.id );
            }
          }
          // MF-2: re-sync this freshly-mounted kernel's mirror from the LOCAL
          // selectedId, not a getSelected…() re-read (stale within this cycle —
          // see the AttributeSetVersion instance above).
          kernel.setSignal( 'selectedVersionId', selectedId );
          return versions;
        },
        async createNewVersion( kernel ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          const created     = await entityClass.compositionSchemeVersions.createSingle();
          kernel.setSignal( 'versionList', entityClass.compositionSchemeVersions.getAll() );
          if ( created ) athene.setSelectedCompositionSchemeVersionId( created.id );
        },
        async commitVersion( kernel, versionId ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          const csv         = entityClass.compositionSchemeVersions.getSingle( versionId );
          if ( ! csv ) throw new Error( `Composition Scheme Version ${ versionId } not found.` );
          await csv.commit();
          kernel.setSignal( 'versionList', entityClass.compositionSchemeVersions.getAll() );
          athene.setSelectedCompositionSchemeVersionId( versionId ); // stays selected, now committed
        },
        async deleteDraftVersion( kernel, versionId ) {
          const athene      = kernel.app.athene;
          const entityClass = athene.world.entityClasses.getSingle( athene.currentClassId );
          const csv         = entityClass.compositionSchemeVersions.getSingle( versionId );
          if ( ! csv ) throw new Error( `Composition Scheme Version ${ versionId } not found.` );
          await csv.deleteDraft();
          kernel.setSignal( 'versionList', entityClass.compositionSchemeVersions.getAll() );
          const latest = entityClass.compositionSchemeVersions.getLatest();
          athene.setSelectedCompositionSchemeVersionId( latest ? latest.id : '' );
        },
        selectVersion( kernel, versionId ) {
          kernel.app.athene.setSelectedCompositionSchemeVersionId( versionId );
        },
      },
    },

  },

};

export default node;
