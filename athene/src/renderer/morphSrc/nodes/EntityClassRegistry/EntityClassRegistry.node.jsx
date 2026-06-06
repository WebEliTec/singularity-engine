// EntityClassRegistry — page-node. The surface where the user adds,
// edits, and deletes entity classes themselves (the global CRUD).
// Thin by design: the architectural sleeve that makes "the
// CRUD-for-entity-classes surface" a dispatchable page rather than
// the Hermes engine instance directly mounted by Root.
//
// Internally it mounts <Node id="Hermes" instance="EntityClass" />
// below a PageHeaderAlpha identity strip (delta D6).

const node = {

  metaData: {
    description: 'The Entity Class Manager page, where the user manages the registry of entity classes (the types of things modeled, such as plugin or theme): list them and create, rename/edit, or delete a class.',
  },

  modules: {
    Root: { isRoot: true, description: 'The page that lists all entity classes and lets the user view, create, edit, and delete a class, shown beneath the "Entity Class Manager" heading.' },
  },

  components: {
    PageHeaderAlpha: { isGlobal: true },
  },

};

export default node;
