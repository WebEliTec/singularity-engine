// Right-pane content when (mode === 'delete') && (status === 'success').
// Rendered after a successful DELETE. The just-deleted resource's
// data lingers in singleResourceData (deleteResource leaves
// selectedResourceId + singleResourceData intact specifically so
// this screen can name the resource); enterIndexMode clears both
// as part of its normal signal resets when the user clicks
// "Back to index".

export default function DeleteOnSuccess( { _, Hermes, ResourceCollection } ) {

  const current   = ResourceCollection.getCurrentResource();
  const classMeta = _.getCoreData( 'resourceClassMeta' );

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = current?.getDisplayName() || 'The resource';

  return (
    <div className="hermes-status-screen hermes-status-screen--success">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">✓</span>
        <h2 className="dev-heading-alpha">Deleted</h2>
      </header>

      <p className="hermes-status-message">
        { singular } <strong>{ resourceName }</strong> has been deleted.
      </p>

      <div className="hermes-status-actions">
        <button
          type      = "button"
          className = "hermes-action-button"
          onClick   = { () => Hermes.enterIndexMode() }
        >
          Back to index
        </button>
      </div>

    </div>
  );
}
