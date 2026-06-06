import Athene from './app/Athene.js';

// App-level documentation — every markdown file under ./documentation/
// becomes a sidebar doc in the devApp's Documentation view. The glob is
// authored here because Vite resolves import.meta.glob statically at the
// call site; the framework just consumes the resulting { docId: markdown }
// map (appResourceRegistry → documentation).
const documentationModules = import.meta.glob( './documentation/*.md', { query: '?raw', import: 'default', eager: true } );
const documentation = Object.fromEntries(
  Object.entries( documentationModules )
    .map( ( [ path, content ] ) => {
      // docId = the filename without extension. Guarded so a future glob
      // broadening (nested dirs, other extensions) can't turn a non-match
      // into a load-time crash — unmatched paths are simply dropped.
      const match = path.match( /([^/]+)\.md$/ );
      return match ? [ match[ 1 ], content ] : null;
    } )
    .filter( Boolean )
);

const app = {

  documentation,

  metaData: {
    appName: 'athene',
    // Agent-facing app description (β2 SEE layer — read by the harvester
    // appKernel.getCurrentAppUiStructure() and projected to the LLM). Written
    // plainly for an LLM that will operate the app on the user's behalf.
    appDescription: 'Athene is the control surface for the Singularity Engine, a knowledge-modeling system. The user defines entity classes (the types of things being modeled — e.g. plugin, theme) and gives each class a versioned attribute schema: attributes grouped into Attribute Set Versions that move through a draft → committed lifecycle. The app is a thin front end over a world-model backend (Apollo); from here you browse and manage entity classes, edit the attributes of a class, and create / commit / delete schema versions.',
  },

  constants: {
    // Apollo base URL. A5 cutover (2026-05-29): flipped from the legacy
    // Laravel content-creation-center (:8000) to the node + Fastify
    // world-model backend (singularity-engine/apollo, :8001).
    apolloBaseUrl: 'http://localhost:8001',
  },

  // App-wide brand mark + Hermes input components + Panel/List
  // primitives — loaded from morphSrc/globals/components/. Future views
  // consume via `{ isGlobal: true }` in their node's `components` block.
  //
  // PanelAlpha + ListAlpha are visual primitives lifted at delta D1 —
  // the sidebar-style box with header (PanelAlpha) and the inner
  // clickable list (ListAlpha). Hermes consumes them via its rail
  // adapter; Home (D3) and the per-class management surface (D6+)
  // will compose them differently.
  //
  // Hermes inputs live globally (rather than node-scoped to Hermes)
  // because the catalog will be substantial — text, richText, select,
  // comboBox, booleanCheckbox, radioButtons, dynamicList, jsonEditor,
  // staticText, calendar pickers, etc. — and any future engine that
  // wants the same input vocabulary (not just Hermes) can pull them
  // in without copying.
  globalComponents: {
    SingularityLogoAnimated: {},
    PanelAlpha:              {},
    ListAlpha:               {},
    PageHeaderAlpha:         {},
    HermesInput:             {},
    HermesSimpleInput:       {},
    HermesSelectInput:       {},
    HermesUnsupportedInput:  {},
  },

  nodes: {
    // Root — pure dispatcher post-delta D2. Reads a (D4-pending) signal
    // and mounts exactly one page-node sibling. Holds no surface chrome.
    Root: {
      isRoot: true,
    },
    // Home — page-node. The brand-identity surface (engine logo +
    // class-list-as-navigation). The only place the logo appears.
    Home: {},
    // EntityClassRegistry — page-node. Wraps Hermes/EntityClass —
    // the surface for adding/editing/deleting entity classes themselves.
    EntityClassRegistry: {},
    // EntityClassWorkbench — page-node. The per-class surface,
    // scoped to whichever class the user clicked in Home. Hosts the
    // sub-managers (Attributes, Traits, Composition, Relations,
    // Taxonomies). Class id comes from Athene.currentClassId.
    EntityClassWorkbench: {},
    // Hermes — generic CRUD UI engine, one instance per resource
    // family. Currently mounted by EntityClassRegistry as the
    // `EntityClass` instance. Future page-nodes mount additional
    // instances (Attribute under EntityClassWorkbench, etc.).
    Hermes: {},
    // Chronos — generic version-management engine, peer to Hermes.
    // One instance per versioned-entity family (AttributeSetVersion
    // lands at epsilon E1; CompositionSchemeVersion at E4; the rest
    // at E5+). Mounted inside workbench tabs alongside whichever
    // Hermes instance handles the contents of the picked version.
    Chronos: {},
    // EntityClassExplorer — retained for comparison during G1; not
    // mounted (no longer root, no consumer references it). Slated for
    // removal in G2 once Hermes/EntityClass demonstrably covers its
    // surface end-to-end.
    EntityClassExplorer: {},
  },

  hooks: {
    appKernelDidInitialize( appKernel ) {
      appKernel.athene = new Athene( appKernel );

      // AI control layer (β4): wire the agent transport to the secure
      // main-process LLM bridge (window.athene.llm). The transport holds no
      // key — the key lives only in the Electron main process
      // (ANTHROPIC_API_KEY). With this set, the AgentConsole panel can run a
      // live turn with no console setup. (Prometheus later swaps in here.)
      appKernel.agentTransport?.setLlmCall( ( request ) => window.athene.llm( request ) );
    },
  },

  // AI control layer (β1 experimentation) — agent-callable navigation intents.
  // Each runs with `this` = the app kernel (bound by the executor) + the
  // validated args object; they orchestrate Athene's navigation, driving the
  // exact same UI change the Sidebar produces. Invoked only via
  // appKernel.callAgentMethod(intentId, args). Paired by id with
  // agentApiSchemas. See morpheus/design/ai-control-layer/.
  agentApi: {
    goToHome() {
      this.athene.goToHome();
      return { surface: 'home' };
    },
    goToEntityClasses() {
      this.athene.goToEntityClassRegistry();
      return { surface: 'classRegistry' };
    },
    openEntityClass({ classId }) {
      this.athene.goToEntityClassWorkbench( classId );
      return { surface: 'classWorkbench', classId };
    },
  },

  agentApiSchemas: {
    goToHome: {
      description: 'Take the user to the Home screen (the brand surface with entity-class navigation).',
      returns: { type: 'object', description: 'The surface now shown.' },
    },
    goToEntityClasses: {
      description: 'Show the list of entity classes the user can manage (the Entity Class Registry).',
      returns: { type: 'object', description: 'The surface now shown.' },
    },
    openEntityClass: {
      description: 'Open the management workbench for a specific entity class.',
      params: {
        classId: { type: 'string', required: true, description: 'The id of the entity class to open.' },
      },
      returns: { type: 'object', description: 'The surface now shown and the class id opened.' },
    },
  },

};

export default app;
