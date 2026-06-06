// Home — page-node. The brand-identity surface for the Singularity
// Engine: the only place the engine logo appears, and the
// class-list-as-navigation entry point into the rest of the app.
//
// D2: stub — engine brand + empty PanelAlpha placeholder.
// D3: PanelAlpha populates with real entity classes via a
//     `entityClassList` signal, loaded on nodeDidMount. Item clicks +
//     bottom "Manage Entity Classes" pivot stub to console.log; D4
//     wires real navigation through Athene.

const node = {

  metaData: {
    description: 'The landing page of the Singularity Engine, a knowledge-modeling app. It shows the engine name and a list of all entity classes (the types of things being modeled, such as plugin or theme); the user clicks a class to open its workbench, or opens the full registry to manage the set of classes.',
  },

  signals: {
    // Populated by nodeDidMount. The list is a snapshot of
    // world.entityClasses at mount time. D4+ may centralize this
    // (load once, share across page-nodes) once it actually matters.
    entityClassList: { type: 'array', default: [] },
  },

  hooks: {
    async nodeDidMount( kernel ) {
      await kernel.app.athene.world.entityClasses.loadAll();
      const classes = kernel.app.athene.world.entityClasses.getAll();
      kernel.setSignal( 'entityClassList', classes );
    },
  },

  modules: {
    Root: { isRoot: true, description: 'The home screen content: the engine name above a list of entity classes. The user clicks any class to open its workbench, or uses the "Manage Entity Classes" action to open the registry of all classes.' },
  },

  components: {
    SingularityLogoAnimated: { isGlobal: true },
    PanelAlpha:              { isGlobal: true },
    ListAlpha:               { isGlobal: true },
  },

};

export default node;
