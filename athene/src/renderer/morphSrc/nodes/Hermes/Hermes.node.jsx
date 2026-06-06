// Hermes — generic CRUD UI engine. Port of content-management-hub's
// `systems/hermes/` to a morpheus node. One node, many instances; each
// instance describes a resource family (collection meta, class meta,
// async actions for CRUD, optional inputElements). The body modules
// stay shared across instances; only data + actions differ.
//
// G1 scope: index mode (view-only). Signals + kernel methods + modules
// for view/edit/create/delete land in G2 onward. coreFunctionSchemas
// for the full CRUD verb set are declared from day one so the contract
// is visible to consumers; only `fetchAllResources` is exercised in G1.
//
// Method-naming follows the project-wide convention:
//   - {verb}Single{SingleResourceName} — one instance
//   - {verb}Multiple{SingleResourceName} — a subset of instances
//   - {verb}All{PluralResourceName} — every instance
//
// Theta migrates the domain logic from inline kernel methods +
// kernel fragments into a class hierarchy under `inc/`. `kernel.hermes`
// holds a `Hermes` orchestrator constructed in `kernelDidInitialize`;
// the inline kernel block stays empty — every verb lives on the
// orchestrator (mode transitions, state-machine accessors,
// selectResource, saveResource) or on one of its sub-entities
// (ResourceCollection, EditingDraft, Validator, ResourceIO).

import Hermes from './inc/Hermes.js';

// Resolves the AttributeSetVersion the Attribute instance should
// operate on. Reads the selected ASV id from the workbench's signal
// (via Athene's accessor pair, epsilon E2); falls back to the latest
// ASV when no selection is yet set (initial workbench mount before
// Chronos defaults the selection). Both paths return the same ASV
// object on first mount because the default IS the latest — the
// fallback is purely about ordering between Hermes mount and Chronos
// defaulting, not about diverging behavior.
function _resolveSelectedAsv( kernel, entityClass ) {
  const selectedAsvId = kernel.app.athene.getSelectedAttributeSetVersionId();
  return selectedAsvId
    ? entityClass.attributeSetVersions.getSingle( selectedAsvId )
    : entityClass.attributeSetVersions.getLatest();
}

// The level-2 analog for the TraitAttribute instance (T3.3): resolves the Trait
// Attribute Set Version to operate on, inside the drilled-into trait. Reads the
// selected trait (Athene.getSelectedTraitId) + the selected TASV
// (Athene.getSelectedTraitAttributeSetVersionId), falling back to the trait's
// latest TASV when nothing is selected yet — or when a stale id from a
// previously-open trait doesn't exist here. Returns null if no trait is
// selected / loaded.
function _resolveSelectedTasv( kernel, entityClass ) {
  const athene = kernel.app.athene;
  const trait  = entityClass?.traits.getSingle( athene.getSelectedTraitId() );
  if ( ! trait ) return null;
  const tasvs  = trait.traitAttributeSetVersions;
  const tasvId = athene.getSelectedTraitAttributeSetVersionId();
  return tasvId ? ( tasvs.getSingle( tasvId ) ?? tasvs.getLatest() ) : tasvs.getLatest();
}

// Write-path variants of the two resolvers (MF-4). The read paths tolerate a
// null version (an empty class/trait → empty attribute list), but a
// CREATE/UPDATE/DELETE needs a real version to write into. A class/trait with no
// version yet (creation auto-seeds none) would otherwise null-deref on
// `.attributes` — so resolve-or-throw a clean, user-facing Error that Hermes
// surfaces in its create/edit error screen, instead of a raw "Cannot read
// properties of null" TypeError.
//
// NOTE: this is only the CRASH guard. The affordance half — hiding the "New"
// pivot / disabling edit when there's no draft version — is deferred frontend
// work (FE-2 in development/deferred_frontend_security.md).
function _requireSelectedAsv( kernel, entityClass ) {
  const asv = _resolveSelectedAsv( kernel, entityClass );
  if ( ! asv ) throw new Error( 'No version available — create a draft version first.' );
  return asv;
}

function _requireSelectedTasv( kernel, entityClass ) {
  const tasv = _resolveSelectedTasv( kernel, entityClass );
  if ( ! tasv ) throw new Error( 'No version available — create a draft version first.' );
  return tasv;
}

// Composition analog of _resolveSelectedAsv (C3). The CompositionDirective
// instance operates on the directives inside the SELECTED Composition Scheme
// Version. Class-only (no trait axis), so this is the exact ASV shape: read the
// selected CSV id from the workbench signal (Athene accessor), falling back to
// the latest CSV when nothing's selected yet (initial mount before Chronos
// defaults it). Returns null when the class has no CSV (a fresh class starts
// with zero — the read paths tolerate null → empty directive list).
function _resolveSelectedCsv( kernel, entityClass ) {
  const selectedCsvId = kernel.app.athene.getSelectedCompositionSchemeVersionId();
  return selectedCsvId
    ? entityClass.compositionSchemeVersions.getSingle( selectedCsvId )
    : entityClass.compositionSchemeVersions.getLatest();
}

// Write-path guard (the CRASH guard, mirroring _requireSelectedAsv). A
// create/update/delete needs a real CSV to write into; a class with no scheme
// version yet would otherwise null-deref. Resolve-or-throw a clean, user-facing
// Error that Hermes surfaces in its create/edit error screen.
function _requireSelectedCsv( kernel, entityClass ) {
  const csv = _resolveSelectedCsv( kernel, entityClass );
  if ( ! csv ) throw new Error( 'No version available — create a draft version first.' );
  return csv;
}

const node = {

  metaData: {
    description: 'A generic workbench for one kind of record: it lists every record on the left and lets the user view, create, edit, and delete a record in the pane on the right.',
  },

  /* Node-level configuration — overrides the framework's default
  /* lookup paths. Modules live in `/modules` (a focused subdirectory)
  /* rather than directly under the node folder so the top-level
  /* layout reads cleanly: `inc/` (OOP layer), `modules/` (UI), and
  /* `Hermes.node.jsx` (declarations).
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  config: {
    defaultPaths: {
      modules: '/modules',
    },
  },

  /* Signals — the state machine. Mirrors HermesProvider's useState
  /* set in content-management-hub. The full set lands here; only the
  /* ones G1 touches are exercised today.
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  signals: {

    mode:               { type: 'string',  default: 'index'   },  // 'index' | 'view' | 'edit' | 'create' | 'delete'
    status:             { type: 'string',  default: 'normal'  },  // 'normal' | 'evaluate' | 'success' | 'error' | 'confirm'
    selectedResourceId: { type: 'string',  default: ''        },

    indexData:                     { type: 'array',  default: [] },
    singleResourceData:            { type: 'object', default: null },
    singleResourceDataWorkingCopy: { type: 'object', default: {} },
    singleResourceDataEvaluation:  { type: 'object', default: {} },

    loadingResource: { type: 'boolean', default: false },
    resourceError:   { type: 'string',  default: ''    },
    systemMessage:   { type: 'string',  default: ''    },

    // Async dependent-select options cache (dependent-fields capability). Keyed
    // by field id → { dep, options, loading, error }: the resolved option set for
    // a `dynamicOptionsAsync` field at its current dependency value. Written by
    // Hermes.loadAsyncFieldOptions (fired on a trigger change); read SYNCHRONOUSLY
    // by getVisibleInputElements so the render never awaits. Single-entry per
    // field (overwrite on dependency change).
    dynamicOptionsCache: { type: 'object', default: {} },

  },

  /* Resource meta — overridden per instance. Defaults are placeholders
  /* that make it obvious when an instance forgot to configure itself.
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  coreDataSchemas: {
    resourceCollectionMeta: {
      type:        'object',
      required:    true,
      description: 'Describes the collection: { collectionId, singular, plural, resourceLabel }. Drives the index header + plural references throughout the UI.',
    },
    resourceClassMeta: {
      type:        'object',
      required:    true,
      description: 'Describes the resource class: { id, singular, plural }. Drives single-resource labels.',
    },
  },

  coreData: {
    resourceCollectionMeta: {
      collectionId:  'resource_collection',
      singular:      'Resource Collection',
      plural:        'Resource Collections',
      resourceLabel: null,
    },
    resourceClassMeta: {
      id:       'resource_class',
      singular: 'Resource Class',
      plural:   'Resource Classes',
    },
  },

  /* CRUD verb contract — every instance overrides the actions it needs.
  /* The base implementations all throw, so a missing override surfaces
  /* immediately rather than silently failing.
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  coreFunctionSchemas: {
    fetchAllResources: {
      params:      [],
      returns:     'array',
      async:       true,
      description: 'Returns the full list of resources for this Hermes instance. Each element should expose at minimum an `id` and a `displayName` (or comparable label) that ResourceList can render. Called by `ResourceIO.loadAllResources` on mount and on every return-to-index.',
    },
    fetchSingleResource: {
      params:      [ { name: 'resourceId', type: 'string' } ],
      returns:     'object',
      async:       true,
      description: 'Returns the full data for one resource. Called when the user selects a row from ResourceList. G2.',
    },
    createSingleResource: {
      params:      [ { name: 'values', type: 'object' } ],
      returns:     'object',
      async:       true,
      description: 'Creates a new resource from the working copy. G7.',
    },
    updateSingleResource: {
      params:      [ { name: 'resourceId', type: 'string' }, { name: 'values', type: 'object' } ],
      returns:     'object',
      async:       true,
      description: 'Updates an existing resource. G4.',
    },
    deleteSingleResource: {
      params:      [ { name: 'resourceId', type: 'string' } ],
      returns:     'void',
      async:       true,
      description: 'Deletes a resource by id. G8.',
    },
    registerKernel: {
      params:      [],
      returns:     'void',
      async:       false,
      description: 'Per-instance kernel-init hook, called once from kernelDidInitialize after the Hermes orchestrator is attached. Default no-op; instances needing cross-node coordination override it to register their kernel with Athene (e.g. Attribute / TraitAttribute, for the selection-driven in-place scope refresh).',
    },
    unregisterKernel: {
      params:      [],
      returns:     'void',
      async:       false,
      description: 'Per-instance teardown hook, called once from nodeWillUnmount (MF-1) — the symmetric partner of registerKernel. Instances that registered with Athene override this to unregister (identity-guarded), so a racing async continuation never pokes this torn-down kernel.',
    },
    resolveFieldOptions: {
      params:      [ { name: 'fieldId', type: 'string' } ],
      returns:     'array',
      async:       false,
      description: 'SYNCHRONOUS options provider for a data-driven select input (C3). Called by getVisibleInputElements for any inputElement marked `dynamicOptions: true`, to source its `options: [{value,label}]` at render time from live domain state instead of a baked enum. Default returns []. Instances with a data-driven select override it (e.g. CompositionDirective returns the live entity-class list for the `subClassId` sub-class picker). Must stay synchronous — it runs inside the synchronous render pass; read already-warm state, never await.',
    },
    resolveFieldOptionsAsync: {
      params:      [ { name: 'fieldId', type: 'string' }, { name: 'dependencyValue', type: 'string' } ],
      returns:     'array',
      async:       true,
      description: 'ASYNCHRONOUS options provider for a DEPENDENT select (the dependent-fields capability). Called by Hermes.loadAsyncFieldOptions when a `dynamicOptionsAsync` field\'s dependency changes — the dependency edge is declared once in the field\'s `displayConditions.dependsOn` — passing the new dependency value. Returns [{value,label}] for that value, typically after a fetch of COLD domain state (e.g. the traits of the chosen sub-class, via EntityClass.loadDetail). The result is cached in the dynamicOptionsCache signal + read back synchronously at render, so the render itself never awaits. Default returns []. Instances override it (e.g. CompositionDirective loads the sub-class\'s traits for `traitId`).',
    },
  },

  coreFunctions: {
    async fetchAllResources(kernel) {
      throw new Error( `[Hermes:${ kernel.instanceId }] No fetchAllResources configured. Override in the instance's coreFunctions block.` );
    },
    async fetchSingleResource(kernel, resourceId) {
      throw new Error( `[Hermes:${ kernel.instanceId }] No fetchSingleResource configured.` );
    },
    async createSingleResource(kernel, values) {
      throw new Error( `[Hermes:${ kernel.instanceId }] No createSingleResource configured.` );
    },
    async updateSingleResource(kernel, resourceId, values) {
      throw new Error( `[Hermes:${ kernel.instanceId }] No updateSingleResource configured.` );
    },
    async deleteSingleResource(kernel, resourceId) {
      throw new Error( `[Hermes:${ kernel.instanceId }] No deleteSingleResource configured.` );
    },
    // No-op default — instances that need cross-node wiring override this.
    registerKernel( kernel ) {},
    // No-op default — the teardown partner of registerKernel (MF-1).
    unregisterKernel( kernel ) {},
    // Default: no data-driven options. Instances with a `dynamicOptions` select
    // override this to return [{value,label}] for the given fieldId (C3).
    resolveFieldOptions( kernel, fieldId ) { return []; },
    // Default: no async dependent options. Instances with a `dynamicOptionsAsync`
    // field override this to fetch + return [{value,label}] for the dependency value.
    async resolveFieldOptionsAsync( kernel, fieldId, dependencyValue ) { return []; },
  },

  /* Options — behavioral config, instance-overridable (T3.1). `viewAction` is
  /* the generic "drill-in" capability: when an instance sets it, ViewHeader
  /* renders a button (view mode only) that calls the named coreFunction with
  /* the selected resource id. Default null ⇒ no button, so EntityClass /
  /* Attribute are unaffected. First consumer: the Trait instance.
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  optionSchemas: {
    viewAction: {
      type:        'object',
      default:     null,
      description: 'Optional drill-in action shown while viewing a selected resource — a button in ViewHeader (view mode only). Shape { label, coreFunction }: `label` is the button text; `coreFunction` names a coreFunction invoked as (kernel, selectedResourceId) on click. Default null ⇒ no button.',
    },
  },

  /* Lifecycle — initial index load on mount.
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  hooks: {
    // T1: bootstrap the OOP layer before signals are wired so modules
    // mounting in the initial render can already reach `kernel.hermes`
    // through their `Hermes` moduleProp.
    //
    // Epsilon E2: the Attribute instance also registers its kernel
    // with Athene so Chronos's selection → Hermes refresh path
    // (Athene.setSelectedAttributeSetVersionId → kernel.hermes.refreshScope)
    // can find it. Workaround for morpheus-core#26 — the cleaner
    // re-mount-on-key approach trips the async-unmount race.
    kernelDidInitialize(kernel) {
      kernel.hermes = new Hermes( kernel );
      // Each instance does its OWN init via the registerKernel coreFunction —
      // no instanceId branching here. Most instances use the no-op default;
      // Attribute / TraitAttribute override it to register with Athene.
      kernel.callCoreFunction( 'registerKernel' );
    },
    async nodeDidMount(kernel) {
      await kernel.hermes.resourceIO.loadAllResources();
    },
    // MF-1: symmetric teardown — each instance unregisters its own Athene slot
    // (no-op default; Attribute / TraitAttribute override unregisterKernel).
    nodeWillUnmount(kernel) {
      kernel.callCoreFunction( 'unregisterKernel' );
    },
  },

  // The full moduleProp surface for Hermes — modules destructure
  // whichever entities they need. The "Hermes" entry resolves to the
  // orchestrator itself (mode/status accessors + transition verbs).
  moduleProps: {
    Hermes:             'hermes',
    ResourceCollection: ( kernel ) => kernel.hermes.resourceCollection,
    EditingDraft:       ( kernel ) => kernel.hermes.editingDraft,
    Validator:          ( kernel ) => kernel.hermes.validator,
    ResourceIO:         ( kernel ) => kernel.hermes.resourceIO,
  },

  /* No inline kernel methods. Every verb lives on the `Hermes`
  /* orchestrator (mode transitions, state-machine accessors,
  /* selectResource, saveResource) or on one of its sub-entities
  /* (ResourceIO for I/O, Validator for evaluation, EditingDraft for
  /* the in-progress draft, ResourceCollection for the data model).
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  modules: {
    Root:            { isRoot: true, description: 'The overall two-pane layout: the list of records on the left and the content pane on the right.' },
    ResourceList:    { description: 'The list of all records on the left. Selecting a record opens it in the content pane; the list also has an Index pivot to return to the overview and a "New" pivot to start creating a record.' },
    ContentBody:     { description: 'The right-hand content pane that shows whichever screen matches the current activity: the overview, a record\'s details, the create or edit form, the delete confirmation, or a success/error result.' },
    IndexHeader:     { description: 'The heading at the top of the overview, naming this kind of record and showing how many exist.' },
    IndexBody:       { description: 'The overview screen shown before any record is selected; it prompts the user to pick a record from the list to view it.' },
    ViewHeader:      { description: 'The heading shown while viewing one record; it names the record and offers Edit and Delete actions for it.' },
    ViewBody:        { description: 'The read-only details of the selected record, showing each of its fields and values.' },
    EditHeader:      { description: 'The heading shown while editing a record; it names the record and offers Save (enabled once a field changes) and Discard actions.' },
    EditBody:        { description: 'The editable form for a record, with one input per field; used for both editing an existing record and filling in a new one.' },
    EditOnSuccess:   { description: 'The confirmation shown after an edit is saved; it offers to keep editing the same record or return to its details.' },
    EditOnError:     { description: 'The screen shown when saving an edit fails; it shows the error and lets the user retry, go back to editing with their changes kept, or discard.' },
    CreateHeader:    { description: 'The heading shown while creating a new record; it offers Create (enabled once a field is filled in) and Discard actions.' },
    CreateOnSuccess: { description: 'The confirmation shown after a new record is created; it offers to create another or go to the new record\'s details.' },
    CreateOnError:   { description: 'The screen shown when creating a record fails (for example a duplicate id); it shows the error and lets the user retry, go back to the form, or discard.' },
    DeleteConfirm:   { description: 'A confirmation prompt shown before a record is deleted, with Cancel and Delete buttons.' },
    DeleteOnSuccess: { description: 'The confirmation shown after a record is deleted; it offers to return to the overview.' },
    DeleteOnError:   { description: 'The screen shown when deleting a record fails; it shows the error and lets the user retry or return to the record\'s details.' },
  },

  // Global components used by Hermes modules.
  //
  // PanelAlpha + ListAlpha: the rail's visual primitives, lifted at
  // delta D1. ResourceList composes them as <PanelAlpha><ListAlpha/></PanelAlpha>.
  //
  // HermesInput: polymorphic input dispatcher (G4). The concrete
  // renderers (HermesSimpleInput, etc.) are imported by HermesInput via
  // JS — no need to declare them as <Component>-rendered here.
  components: {
    PanelAlpha:  { isGlobal: true },
    ListAlpha:   { isGlobal: true },
    HermesInput: { isGlobal: true },
  },

  /* Per-resource instance config. EntityClass is the first; G9 adds
  /* Attribute. Each instance overrides:
  /*   - coreData (resource meta)
  /*   - coreFunctions (the actual CRUD I/O for this resource type)
  /*   - eventually: inputElements (field configs for edit/create)
  /* *** *** *** *** *** *** *** *** *** *** *** *** *** *** */

  instances: {

    EntityClass: {
      metaData: {
        description: 'Manages the registry of entity classes (the types of things modeled, such as plugin or theme): browse the classes and create, edit, or delete a class.',
      },
      coreData: {
        resourceCollectionMeta: {
          collectionId:  'content_class',
          singular:      'Entity Class',
          plural:        'Entity Classes',
          resourceLabel: null,
        },
        resourceClassMeta: {
          id:       'content_class',
          singular: 'Entity Class',
          plural:   'Entity Classes',
        },
        // G4 editable surface. Field IDs match the Laravel PATCH
        // handler's expected keys (`update_class_meta_data` reads
        // $data['singular'], $data['plural'], $data['description']
        // flat at the top level). camelCase and snake_case happen to
        // be identical for these three; future fields with truly
        // different casings would need a transform at the Apollo
        // boundary.
        //
        // Excluded from edit (intentional): id (primary key),
        // life_cycle_stage (has its own backend workflow), updated_at
        // / class_profile_img_url (server-managed). Add them to this
        // map when an editable workflow lands.
        inputElements: {
          // Identity field — create-only via displayConditions. EntityClass
          // uses client-supplied kebab ids (Apollo validates the kebab format
          // + duplicates → 409). Once created, the id is immutable, so the
          // field disappears in edit mode and is skipped by Validator (and the
          // PATCH payload, see Hermes.saveResource's visible-field filter).
          id: {
            label:     'ID',
            inputType: 'text',
            constraints: {
              required:  true,
              minLength: 2,
              pattern:   'kebabCase',
            },
            displayConditions: {
              mode: [ 'create' ],
            },
          },
          singular: {
            label:     'Singular',
            inputType: 'text',
            constraints: {
              required:  true,
              minLength: 2,
              pattern:   'smallLettersAndUnderscores',
            },
          },
          plural: {
            label:     'Plural',
            inputType: 'text',
            constraints: {
              required:  true,
              minLength: 2,
              pattern:   'smallLettersAndUnderscores',
            },
          },
          description: {
            label:     'Description',
            inputType: 'text',  // upgrade to 'richText' when that renderer lands
            constraints: {
              required: true,
            },
          },
        },
      },
      options: {
        // Drill-in from the class registry into this class's workbench (its
        // Attributes / Traits / Composition surface). ViewHeader renders the
        // button in view mode and calls the named coreFunction with the
        // selected class's id on click — mirrors the Trait instance's
        // "Manage Trait Versions" drill, one conceptual level up.
        viewAction: { label: 'Manage Entity Class', coreFunction: 'manageSingleEntityClass' },
      },
      coreFunctions: {
        // Returns the full list of EntityClass instances from the World
        // tree's EntityClasses collection. The collection handles
        // caching + the round-trip through Apollo; Hermes just gets a
        // fresh array every time it asks.
        async fetchAllResources(kernel) {
          await kernel.app.athene.world.entityClasses.loadAll();
          return kernel.app.athene.world.entityClasses.getAll();
        },
        // Returns the EntityClass instance for the given id.
        // `getSingle` is synchronous because `loadAll` has already
        // populated the Map — `fetchAllResources` runs on mount, so
        // the collection is always warm by the time the user can click
        // a row. Wrapping with `async` keeps the coreFunction signature
        // uniform across instances.
        async fetchSingleResource(kernel, id) {
          return kernel.app.athene.world.entityClasses.getSingle( id );
        },
        // PATCHes the editable meta fields for one EntityClass.
        // `values` is a flat object whose keys match the Laravel
        // handler's expectations ({ singular, plural, description }).
        // The collection handles the wire call + cache refresh; after
        // this resolves, `getSingle(id)` returns the post-save instance.
        async updateSingleResource(kernel, id, values) {
          return kernel.app.athene.world.entityClasses.updateSingle( id, values );
        },
        // POSTs a new EntityClass. `values` must include `id`
        // (client-supplied) plus singular, plural, description.
        // The collection handles the wire call + cache refresh; after
        // this resolves, `getSingle(values.id)` returns the newly-
        // created instance.
        async createSingleResource(kernel, values) {
          return kernel.app.athene.world.entityClasses.createSingle( values );
        },
        // DELETEs the EntityClass with the given id. The collection
        // handles the wire call + cache refresh; after this resolves,
        // the id is no longer in the Map (or in indexData once Hermes
        // runs its refresh).
        async deleteSingleResource(kernel, id) {
          return kernel.app.athene.world.entityClasses.deleteSingle( id );
        },
        // viewAction drill handler: navigate from the class registry into the
        // per-class workbench. Athene stashes the class id and flips Root's
        // surface to 'classWorkbench' (the same navigation Home's class list
        // uses), unmounting this registry surface and mounting the workbench.
        manageSingleEntityClass( kernel, classId ) {
          kernel.app.athene.goToEntityClassWorkbench( classId );
        },
      },
    },

    // Attribute — delta D9 read-only browsing; CRUD writes added next.
    // Class context comes from Athene.currentClassId (set by
    // Athene.goToEntityClassWorkbench(id) before the surface flip).
    // ASV scope: AttributeManager loads the latest ASV (highest
    // numbered id) at fetch time and writes target the same ASV.
    // Proper ASV picker UI lands with D8.
    Attribute: {
      metaData: {
        description: 'Manages the attributes (the fields, each with a label and a data type) inside the currently selected Attribute Set Version of an entity class: browse them and create, edit, or delete an attribute. Editing only works on a draft version; committed versions are immutable.',
      },
      coreData: {
        resourceCollectionMeta: {
          collectionId:  'attribute',
          singular:      'Attribute',
          plural:        'Attributes',
          resourceLabel: null,
        },
        resourceClassMeta: {
          id:       'attribute',
          singular: 'Attribute',
          plural:   'Attributes',
        },
        // Editable surface. Field IDs match the Laravel handler's
        // expected keys (snake_case at the top level — see
        // Class_Attribute_Manager.php). Type-specific extras
        // (string_type_min_length, selection_type, …) stay on the raw
        // record until a richer renderer pipeline lands.
        inputElements: {
          // Create-only id field — the attribute's client-supplied kebab
          // machine key (Apollo validates the format + uniqueness within the
          // ASV → 409). Same kebab convention as EntityClass's id.
          id: {
            label:     'ID',
            inputType: 'text',
            constraints: {
              required:  true,
              minLength: 2,
              pattern:   'kebabCase',
            },
            displayConditions: { mode: [ 'create' ] },
          },
          label: {
            label:     'Label',
            inputType: 'text',
            constraints: { required: true, minLength: 2 },
          },
          description: {
            label:     'Description',
            inputType: 'text',
            constraints: { required: true },
          },
          // Attribute data-type catalog. The field id is `dataType` — Apollo's
          // camelCase contract key. Apollo's slice-1 enum is these 13
          // config-free scalar types; `dynamicList` / `optionList` are deferred
          // (they need extra selection-config fields) and re-added when that
          // slice lands.
          dataType: {
            label:       'Data Type',
            inputType:   'select',
            constraints: { required: true },
            options: [
              { value: 'text',           label: 'Text'           },
              { value: 'richtext',       label: 'Richtext'       },
              { value: 'email',          label: 'Email'          },
              { value: 'url',            label: 'URL'            },
              { value: 'tel',            label: 'Tel'            },
              { value: 'boolean',        label: 'Boolean'        },
              { value: 'integer',        label: 'Integer'        },
              { value: 'float',          label: 'Float'          },
              { value: 'date',           label: 'Date'           },
              { value: 'time',           label: 'Time'           },
              { value: 'datetime-local', label: 'Datetime'       },
              { value: 'json',           label: 'JSON'           },
              { value: 'unixTimestamp',  label: 'Unix Timestamp' },
            ],
          },
        },
      },
      coreFunctions: {
        // Loads the entity class's full detail, then returns attributes
        // from the ASV Chronos has selected. Class id flows in from
        // Athene.currentClassId; ASV id flows from Athene's workbench-
        // signal accessor (epsilon E2). When no selection is yet set
        // (initial mount before Chronos's defaulting runs), fall back
        // to getLatest() — same data as Chronos will eventually pick
        // by default, so the brief pre-selection render shows
        // consistent content.
        async fetchAllResources(kernel) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          await entityClass.loadDetail();
          const asv = _resolveSelectedAsv( kernel, entityClass );
          return asv?.attributes.getAll() ?? [];
        },
        async fetchSingleResource(kernel, id) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          const asv = _resolveSelectedAsv( kernel, entityClass );
          return asv?.attributes.getSingle( id ) ?? null;
        },
        // Write paths — delegate to the Attributes collection at the
        // selected ASV. The collection's writes handle Apollo + refresh
        // (via entityClass.loadDetail) + re-acquire of the fresh
        // instance from the post-refresh tree.
        async createSingleResource(kernel, values) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedAsv( kernel, entityClass ).attributes.createSingle( values );
        },
        async updateSingleResource(kernel, id, values) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedAsv( kernel, entityClass ).attributes.updateSingle( id, values );
        },
        async deleteSingleResource(kernel, id) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedAsv( kernel, entityClass ).attributes.deleteSingle( id );
        },
        // Register with Athene for the ASV-selection-driven in-place scope
        // refresh (Pattern Y / morpheus-core#26).
        registerKernel( kernel ) {
          kernel.app.athene.registerHermesAttributeKernel( kernel );
        },
        unregisterKernel( kernel ) {
          kernel.app.athene.unregisterHermesAttributeKernel( kernel );
        },
      },
    },

    // Trait — T3.1. CRUD over the class's traits (class-scoped reusable roles
    // that grant extra attributes). Class context comes from
    // Athene.currentClassId, exactly like the Attribute instance. Identity is
    // { id, label, description }; the id is a create-only client-supplied kebab
    // key (immutable after create), mirroring EntityClass + Attribute.
    //
    // Opts into the generic `viewAction` capability: viewing a trait offers a
    // "Manage Trait Versions" button whose coreFunction promotes the selected
    // trait to the workbench's active trait — the level-1 → level-2 transition
    // of the two-level Traits tab. The version-management surface itself
    // (Chronos/TraitAttributeSetVersion + Hermes/TraitAttribute) and
    // Athene.setSelectedTraitId land in T3.2/T3.3; until then the action is a
    // safe, inert no-op (see manageTraitVersions).
    Trait: {
      metaData: {
        description: 'Manages the traits of an entity class — reusable roles (such as "sellable") that grant the class extra attributes: browse the traits and create, edit, or delete one. Each trait owns its own versioned attribute sets, edited from the trait\'s own version surface.',
      },
      coreData: {
        resourceCollectionMeta: {
          collectionId:  'trait',
          singular:      'Trait',
          plural:        'Traits',
          resourceLabel: null,
        },
        resourceClassMeta: {
          id:       'trait',
          singular: 'Trait',
          plural:   'Traits',
        },
        inputElements: {
          // Create-only kebab machine key — Apollo validates the format +
          // uniqueness within the class (409). Immutable after create, so it
          // disappears in edit mode (displayConditions) and is filtered out of
          // the PATCH payload by Hermes.saveResource's visible-field filter.
          id: {
            label:     'ID',
            inputType: 'text',
            constraints: { required: true, minLength: 2, pattern: 'kebabCase' },
            displayConditions: { mode: [ 'create' ] },
          },
          label: {
            label:     'Label',
            inputType: 'text',
            constraints: { required: true, minLength: 2 },
          },
          description: {
            label:     'Description',
            inputType: 'text',
            constraints: { required: true },
          },
        },
      },
      options: {
        // Opt into the drill-in capability. The coreFunction is named here and
        // invoked with the selected trait's id on click (see ViewHeader).
        viewAction: { label: 'Manage Trait Versions', coreFunction: 'manageTraitVersions' },
      },
      coreFunctions: {
        // Fetch / write paths delegate to the World tree's Traits collection
        // (verified in T2). fetchAll loads the class walk (which nests traits)
        // then returns them; the writes hit Apollo + refresh + re-acquire
        // inside the collection, so Hermes just gets fresh data on its next
        // fetch.
        async fetchAllResources( kernel ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          await entityClass.loadDetail();
          return entityClass.traits.getAll();
        },
        async fetchSingleResource( kernel, id ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return entityClass.traits.getSingle( id );
        },
        async createSingleResource( kernel, values ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return entityClass.traits.createSingle( values );
        },
        async updateSingleResource( kernel, id, values ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return entityClass.traits.updateSingle( id, values );
        },
        async deleteSingleResource( kernel, id ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return entityClass.traits.deleteSingle( id );
        },
        // The viewAction handler. Drills into level 2: promotes the selected
        // trait to the workbench's active trait. The workbench's Traits tab
        // dispatches on selectedTraitId — this reveals the trait's
        // version-management surface (T3.3 fills it with the Chronos strip +
        // attribute editor).
        async manageTraitVersions( kernel, traitId ) {
          kernel.app.athene.setSelectedTraitId( traitId );
        },
      },
    },

    // TraitAttribute — T3.3. The level-2 attribute editor of the Traits tab:
    // CRUD over the attributes inside the SELECTED TRAIT's SELECTED TASV.
    // Identical to the Attribute instance but scoped one level deeper, via
    // _resolveSelectedTasv (currentClassId + selectedTraitId +
    // selectedTraitAttributeSetVersionId). Same draft-only write rule — a
    // committed TASV's attributes are immutable (Apollo enforces it; the UI
    // surfaces the rejection). inputElements are identical to Attribute (a
    // trait-attribute IS an attribute), incl. the 13-type dataType enum.
    TraitAttribute: {
      metaData: {
        description: 'Manages the attributes (the fields, each with a label and a data type) inside the currently selected version of the trait the user has drilled into: browse them and create, edit, or delete an attribute. Editing only works on a draft version; committed versions are immutable.',
      },
      coreData: {
        resourceCollectionMeta: {
          collectionId:  'trait_attribute',
          singular:      'Attribute',
          plural:        'Attributes',
          resourceLabel: null,
        },
        resourceClassMeta: {
          id:       'trait_attribute',
          singular: 'Attribute',
          plural:   'Attributes',
        },
        inputElements: {
          id: {
            label:     'ID',
            inputType: 'text',
            constraints: { required: true, minLength: 2, pattern: 'kebabCase' },
            displayConditions: { mode: [ 'create' ] },
          },
          label: {
            label:     'Label',
            inputType: 'text',
            constraints: { required: true, minLength: 2 },
          },
          description: {
            label:     'Description',
            inputType: 'text',
            constraints: { required: true },
          },
          dataType: {
            label:       'Data Type',
            inputType:   'select',
            constraints: { required: true },
            options: [
              { value: 'text',           label: 'Text'           },
              { value: 'richtext',       label: 'Richtext'       },
              { value: 'email',          label: 'Email'          },
              { value: 'url',            label: 'URL'            },
              { value: 'tel',            label: 'Tel'            },
              { value: 'boolean',        label: 'Boolean'        },
              { value: 'integer',        label: 'Integer'        },
              { value: 'float',          label: 'Float'          },
              { value: 'date',           label: 'Date'           },
              { value: 'time',           label: 'Time'           },
              { value: 'datetime-local', label: 'Datetime'       },
              { value: 'json',           label: 'JSON'           },
              { value: 'unixTimestamp',  label: 'Unix Timestamp' },
            ],
          },
        },
      },
      coreFunctions: {
        async fetchAllResources( kernel ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          await entityClass.loadDetail();
          const tasv = _resolveSelectedTasv( kernel, entityClass );
          return tasv?.attributes.getAll() ?? [];
        },
        async fetchSingleResource( kernel, id ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          const tasv = _resolveSelectedTasv( kernel, entityClass );
          return tasv?.attributes.getSingle( id ) ?? null;
        },
        async createSingleResource( kernel, values ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedTasv( kernel, entityClass ).attributes.createSingle( values );
        },
        async updateSingleResource( kernel, id, values ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedTasv( kernel, entityClass ).attributes.updateSingle( id, values );
        },
        async deleteSingleResource( kernel, id ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedTasv( kernel, entityClass ).attributes.deleteSingle( id );
        },
        // Register with Athene for the TASV-selection-driven in-place scope
        // refresh (the level-2 analog of the Attribute instance's registration).
        registerKernel( kernel ) {
          kernel.app.athene.registerHermesTraitAttributeKernel( kernel );
        },
        unregisterKernel( kernel ) {
          kernel.app.athene.unregisterHermesTraitAttributeKernel( kernel );
        },
      },
    },

    // CompositionDirective — C3. The directive editor of the Composition tab:
    // CRUD over the Composition Directives inside the SELECTED Composition Scheme
    // Version (currentClassId + selectedCompositionSchemeVersionId, via
    // _resolveSelectedCsv). Class-only — the ASV/Attribute shape, not the trait
    // two-level drill.
    //
    // Genuinely new vs the attribute editors: (1) `subClassId` is a DATA-DRIVEN
    // select — its options are the live entity-class list, sourced at render time
    // via resolveFieldOptions (the one Hermes-engine change); (2) the directive
    // id is SERVER-DERIVED (subClassId[:traitId]), so there is NO `id` field and
    // create relies on Hermes.createResource's created?.id fallback; (3)
    // subClassId is create-only (frozen identity) — only cardinalityRules +
    // description are editable on update. The trait qualifier + isSupplementClass
    // are out of this slice (deferred / dropped — Composition beta §7).
    CompositionDirective: {
      metaData: {
        description: 'Manages the composition directives inside the currently selected Composition Scheme Version of an entity class — each directive declares that the class is composed of a sub-class, with a cardinality and a description: browse them and create, edit, or delete a directive. Editing only works on a draft version; committed versions are immutable.',
      },
      coreData: {
        resourceCollectionMeta: {
          collectionId:  'composition_directive',
          singular:      'Composition Directive',
          plural:        'Composition Directives',
          resourceLabel: null,
        },
        resourceClassMeta: {
          id:       'composition_directive',
          singular: 'Composition Directive',
          plural:   'Composition Directives',
        },
        inputElements: {
          // The sub-class picker — a DATA-DRIVEN select (options = the live
          // entity-class list, via resolveFieldOptions below). Create-only: it's
          // the identity-determining field (the directive id is derived from it),
          // frozen on update — exactly as the attribute editors freeze `id`.
          // There is NO free `id` field; the server derives the directive id.
          subClassId: {
            label:          'Sub-class',
            inputType:      'select',
            dynamicOptions: true,
            constraints:    { required: true },
            displayConditions: { mode: [ 'create' ] },
          },
          // The optional trait qualifier — a DEPENDENT select on subClassId. Its
          // options are the traits OF THE CHOSEN sub-class, loaded async (a
          // sub-class's traits aren't warm — they come from its loadDetail walk),
          // hence `dynamicOptionsAsync`. The dependency edge is declared ONCE, in
          // `displayConditions.dependsOn` ({ subClassId: ['*'] } — show once any
          // sub-class is picked); the engine derives the clear-on-change + the
          // async re-resolve from that same edge. Optional (no `required`) — a
          // directive may be unqualified; create-only / frozen identity, like
          // subClassId.
          traitId: {
            label:               'Trait (optional)',
            inputType:           'select',
            dynamicOptionsAsync: true,
            displayConditions: {
              mode:      [ 'create' ],
              dependsOn: { subClassId: [ '*' ] },
            },
          },
          cardinalityRules: {
            label:     'Cardinality',
            inputType: 'text',
            constraints: { required: true },
          },
          description: {
            label:     'Description',
            inputType: 'text',
            constraints: { required: true },
          },
        },
      },
      coreFunctions: {
        async fetchAllResources( kernel ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          await entityClass.loadDetail();
          const csv = _resolveSelectedCsv( kernel, entityClass );
          return csv?.compositionDirectives.getAll() ?? [];
        },
        async fetchSingleResource( kernel, id ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          const csv = _resolveSelectedCsv( kernel, entityClass );
          return csv?.compositionDirectives.getSingle( id ) ?? null;
        },
        async createSingleResource( kernel, values ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          // The trait qualifier is optional — omit it when unset/cleared so the
          // server derives the id as subClassId-only (an empty `traitId` would
          // also fail the backend's kebab pattern). When set, the id becomes
          // `subClassId:traitId`.
          const payload = { ...values };
          if ( ! payload.traitId ) delete payload.traitId;
          return _requireSelectedCsv( kernel, entityClass ).compositionDirectives.createSingle( payload );
        },
        async updateSingleResource( kernel, id, values ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedCsv( kernel, entityClass ).compositionDirectives.updateSingle( id, values );
        },
        async deleteSingleResource( kernel, id ) {
          const entityClass = kernel.app.athene.world.entityClasses.getSingle( kernel.app.athene.currentClassId );
          return _requireSelectedCsv( kernel, entityClass ).compositionDirectives.deleteSingle( id );
        },
        // The data-driven options provider for the subClassId select. SYNCHRONOUS
        // — reads the already-warm entity-class list (loaded by Home) and maps to
        // { value, label }. NOTE: this currently INCLUDES the host class, but
        // Apollo now REJECTS a self-referential subClassId (400 — a class cannot
        // compose itself). So picking the host 400s on submit; excluding it from
        // this list is a deferred frontend affordance fix (FE-3 in
        // deferred_frontend_security.md), per backend-security-first. The one
        // instance that overrides this hook.
        resolveFieldOptions( kernel, fieldId ) {
          if ( fieldId === 'subClassId' ) {
            return kernel.app.athene.world.entityClasses.getAll()
              .map( c => ( { value: c.id, label: c.displayName } ) );
          }
          return [];
        },
        // Async options for the `traitId` dependent select: the traits of the
        // chosen sub-class. A sub-class's traits are COLD — they come from its
        // loadDetail() walk, not the warm class-meta list — so this fetches.
        // loadDetail is idempotent; a throw here surfaces inline on the field
        // (the cache carries the error). Returns [] for an unknown sub-class.
        async resolveFieldOptionsAsync( kernel, fieldId, subClassId ) {
          if ( fieldId !== 'traitId' || ! subClassId ) return [];
          const subClass = kernel.app.athene.world.entityClasses.getSingle( subClassId );
          if ( ! subClass ) return [];
          await subClass.loadDetail();
          return subClass.traits.getAll().map( t => ( { value: t.id, label: t.displayName } ) );
        },
        // Register with Athene for the CSV-selection-driven in-place scope refresh
        // (Pattern Y / morpheus-core#26) — the class-only analog of the Attribute
        // instance's registration.
        registerKernel( kernel ) {
          kernel.app.athene.registerHermesCompositionDirectiveKernel( kernel );
        },
        unregisterKernel( kernel ) {
          kernel.app.athene.unregisterHermesCompositionDirectiveKernel( kernel );
        },
      },
    },

  },

};

export default node;
