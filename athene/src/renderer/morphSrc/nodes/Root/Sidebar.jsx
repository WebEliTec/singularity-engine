// Persistent app-shell sidebar. Always visible on every page-node;
// collapsed by default (narrow icon-only strip), expands on toggle
// click to reveal labeled affordances.
//
// Only affordance for now: Home. Disabled when currentSurface === 'home'
// (you can't navigate to where you already are). Future surfaces add
// more affordances here as they land.
//
// State lives in Root's `sidebarExpanded` signal — module-local
// useState would work, but signals keep us consistent with the rest of
// the codebase (zero React hooks anywhere else) and let the kernel
// stay the single source of UI state.

export default function Sidebar( { _, App } ) {

  const isExpanded     = _.getSignal( 'sidebarExpanded' );
  const currentSurface = _.getSignal( 'currentSurface' );

  const toggleExpanded = () => _.setSignal( 'sidebarExpanded', ! isExpanded );

  const isOnHome     = currentSurface === 'home';
  const isOnRegistry = currentSurface === 'classRegistry';

  return (
    <aside className={ `sidebar${ isExpanded ? ' is-expanded' : '' }` }>

      <button
        className = "sidebar-toggle"
        onClick   = { toggleExpanded }
        aria-label = { isExpanded ? 'Collapse sidebar' : 'Expand sidebar' }
      >
        <span className="sidebar-toggle-glyph" aria-hidden="true">
          { isExpanded ? '‹' : '›' }
        </span>
      </button>

      <nav className="sidebar-nav">

        <button
          className = { `sidebar-affordance${ isOnHome ? ' is-current' : '' }` }
          onClick   = { () => ! isOnHome && App.athene.goToHome() }
          disabled  = { isOnHome }
        >
          <span className="sidebar-affordance-glyph" aria-hidden="true">⌂</span>
          <span className="sidebar-affordance-label">Home</span>
        </button>

        <button
          className = { `sidebar-affordance${ isOnRegistry ? ' is-current' : '' }` }
          onClick   = { () => ! isOnRegistry && App.athene.goToEntityClassRegistry() }
          disabled  = { isOnRegistry }
        >
          <span className="sidebar-affordance-glyph" aria-hidden="true">≡</span>
          <span className="sidebar-affordance-label">Manage Entity Classes</span>
        </button>

      </nav>

    </aside>
  );
}
