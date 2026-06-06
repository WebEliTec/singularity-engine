// Home root module. Renders the engine brand (logo + title) above a
// PanelAlpha populated with the live entity-class list. Click handlers
// call into Athene's goTo* methods which flip Root's currentSurface
// signal — Root.jsx re-renders into the new page-node.
//
// File name is `Root.jsx` per morpheus convention — the node declares
// `modules: { Root: { isRoot: true } }`, and module resolution is by
// filename.

export default function Root( { _, App, Component } ) {

  const classes = _.getSignal( 'entityClassList' );

  const items = classes.map( cls => ( {
    id:        cls.id,
    name:      cls.displayName,
    secondary: cls.id,
    isActive:  false,
    onClick:   () => App.athene.goToEntityClassWorkbench( cls.id ),
  } ) );

  // Panel header affordance — drops the user into the Entity Class Registry
  // (the class-management surface). Lifted out of the list's bottom pivot into
  // PanelAlpha's own header-action slot.
  const manageAction = {
    glyph:   '≡',
    label:   'Manage Entity Classes',
    onClick: () => App.athene.goToEntityClassRegistry(),
  };

  return (
    <div id="home" className="fade-in">

      <header className="engine-brand">
        <Component id="SingularityLogoAnimated" width="200px" height="200px" />
        <h1 className="engine-brand-title">Singularity Engine</h1>
      </header>

      <main className="home-body">
        <Component
          id           = "PanelAlpha"
          eyebrow      = "Entity Classes"
          count        = { classes.length }
          headerAction = { manageAction }
        >
          <Component
            id    = "ListAlpha"
            items = { items }
          />
        </Component>
      </main>

    </div>
  );
}
