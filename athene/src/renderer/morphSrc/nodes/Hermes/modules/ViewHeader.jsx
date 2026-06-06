// Right-pane header when mode === 'view'. Shows the resource
// class singular as an eyebrow + the resource's own displayName as the
// primary heading. Two action affordances: Edit (G4) enters edit
// mode; Delete (G8) enters the delete-confirm flow.
//
// Drill action (T3.1): an OPTIONAL button rendered only when the instance
// declares a `viewAction` option ({ label, coreFunction }) — the generic
// "drill into a deeper surface" affordance, view-mode only, calling the named
// coreFunction with the selected resource's id. Placed LAST in the action row
// (the right side), set off from the Edit/Delete mutate actions by a pipe
// separator. Default null ⇒ no button (Attribute unaffected). Consumers: the
// EntityClass instance ("Open Workbench →" → the per-class workbench) and the
// Trait instance ("Manage Trait Versions" → its version surface).
//
// Returning to index mode lives in the rail's Index pivot (G3), so
// there's no back button here — keeping the header focused on the
// per-resource action surface.

export default function ViewHeader( { _, Hermes, ResourceCollection } ) {

  const current    = ResourceCollection.getCurrentResource();
  const loading    = _.getSignal( 'loadingResource' );
  const classMeta  = _.getCoreData( 'resourceClassMeta' );
  const viewAction = _.getOption( 'viewAction' );   // null unless the instance opts in

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = current?.getDisplayName() || ( loading ? '…' : '—' );
  const canEdit      = !! current && ! loading;

  return (
    <header className="hermes-mode-header hermes-mode-header--view">
      <div className="hermes-mode-titling">
        <span className="hermes-mode-eyebrow">{ singular }</span>
        <h2 className="dev-heading-alpha">{ resourceName }</h2>
      </div>
      <div className="hermes-mode-actions">
        <button
          type      = "button"
          className = "hermes-action-button hermes-action-button--danger"
          onClick   = { () => Hermes.enterDeleteMode() }
          disabled  = { ! canEdit }
        >
          Delete
        </button>
        <button
          type      = "button"
          className = "hermes-action-button hermes-action-button--edit"
          onClick   = { () => Hermes.enterEditMode() }
          disabled  = { ! canEdit }
        >
          Edit
        </button>
        { viewAction && (
          <>
            <span className="hermes-action-separator" aria-hidden="true">|</span>
            <button
              type      = "button"
              className = "hermes-action-button hermes-action-button--drill"
              onClick   = { () => _.callCoreFunction( viewAction.coreFunction, current.getId() ) }
              disabled  = { ! canEdit }
            >
              { viewAction.label }<span className="hermes-action-arrow">→</span>
            </button>
          </>
        ) }
      </div>
    </header>
  );
}
