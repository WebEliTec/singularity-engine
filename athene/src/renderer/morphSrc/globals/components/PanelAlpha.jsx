// PanelAlpha — global component (presentational)
//
// Sidebar-style box: bordered chrome with a header row (eyebrow label,
// optional count chip, and an optional header action button) and arbitrary
// children rendered below. The first of the Panel variants — purpose-agnostic
// by design so any node can reuse the shape. See [[component-naming-convention]].
//
// showCount (optional, default false): gates the count chip — opt in with
// showCount={true} (alongside a `count`) to show the tally. Default false ⇒ a
// provided count stays hidden unless explicitly enabled.
//
// headerAction (optional): a labelled button hung on the right of the header,
// shaped { label, onClick, glyph? }. The consuming node supplies the callback
// directly — PanelAlpha is presentational, with no kernel access. Home uses it
// for "Manage Entity Classes"; default undefined ⇒ no button.

export default function PanelAlpha( { eyebrow, count, showCount = false, headerAction, children } ) {

  const showsCount = count !== undefined && showCount;
  const hasEnd     = showsCount || headerAction !== undefined;
  const hasHeader  = eyebrow !== undefined || hasEnd;

  return (
    <aside className="panel-alpha">

      { hasHeader && (
        <header className="panel-alpha-header">
          { eyebrow !== undefined && (
            <span className="panel-alpha-eyebrow">{ eyebrow }</span>
          ) }
          { hasEnd && (
            <div className="panel-alpha-header-end">
              { showsCount && (
                <span className="panel-alpha-count">{ count }</span>
              ) }
              { headerAction && (
                <button
                  type      = "button"
                  className = "panel-alpha-header-action"
                  onClick   = { headerAction.onClick }
                >
                  { headerAction.glyph !== undefined && (
                    <span className="panel-alpha-header-action-glyph" aria-hidden="true">{ headerAction.glyph }</span>
                  ) }
                  <span className="panel-alpha-header-action-label">{ headerAction.label }</span>
                </button>
              ) }
            </div>
          ) }
        </header>
      ) }

      { children }

    </aside>
  );
}
