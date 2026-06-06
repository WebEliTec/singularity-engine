// App shell / root mount point. Pure dispatcher post-delta D2 — no
// logo, no brand chrome. Reads `currentSurface` (signal added D4) and
// mounts exactly one page-node sibling (Home, EntityClassRegistry,
// EntityClassWorkbench). The expandable sidebar (D5) lands in this
// node as global app shell, alongside the dispatch.

const node = {

  metaData: {
    description: 'The application shell for the Singularity Engine, a knowledge-modeling tool. It shows one main page at a time (the Home screen, the entity-class registry, or the entity-class workbench) with a persistent navigation sidebar and an AI chat dock alongside it.',
  },

  signals: {
    // Drives Root.jsx's dispatch. 'home' | 'classRegistry'.
    // 'classWorkbench' joins the enum with delta D6.
    currentSurface:  { type: 'string',  default: 'home' },
    // D5: sidebar expansion. Lives on Root (not Sidebar) because
    // Sidebar is a module of this node and uses Root's kernel.
    sidebarExpanded: { type: 'boolean', default: false  },
    // AI control layer (β4): the agent chat panel's state. Lives on Root
    // (like sidebarExpanded) because AgentConsole is a module of this node
    // and shares its kernel — and because the panel must persist while the
    // surface navigates beneath it. agentTranscript is the display view;
    // agentMessages is the raw Anthropic message history kept for multi-turn
    // continuity (fed back into sendTurn each turn).
    agentConsoleOpen: { type: 'boolean', default: false },
    agentInput:       { type: 'string',  default: ''    },
    agentBusy:        { type: 'boolean', default: false },
    agentTranscript:  { type: 'array',   default: []    },
    agentMessages:    { type: 'array',   default: []    },
  },

  hooks: {
    // Hands Athene a reference to this kernel so its goTo* methods can
    // flip currentSurface from anywhere in the app via App.athene.
    kernelDidInitialize( kernel ) {
      kernel.app.athene.registerRootKernel( kernel );
    },
  },

  modules: {
    Root:         { isRoot: true, description: 'The overall page layout: a navigation sidebar on the side, the currently selected page in the center, and a floating AI chat dock that stays in place as the user moves between pages.' },
    Sidebar:      { description: 'The navigation sidebar, always visible; it collapses to a narrow icon strip and expands to show labels. Lets the user jump to the Home screen or to the entity-class registry (where the types of things being modeled are managed).' },
    AgentConsole: { description: 'The AI chat dock where the user types a request in plain language; the assistant replies and can carry out actions in the app, such as navigating to a different page. It opens from a small launcher button and shows the actions it took beneath each reply.' },
  },

};

export default node;
