// Right-pane content when (mode === 'delete') && (status === 'error').
// Rendered when the DELETE attempt threw. The resource still exists
// (the failed DELETE didn't change server state), so "Back to view"
// returns to the detail view — selectedResourceId is still set.

export default function DeleteOnError( { _, Hermes } ) {

  const systemMessage = _.getSignal( 'systemMessage' );
  const resourceError = _.getSignal( 'resourceError' );
  const message       = systemMessage || resourceError || 'An unknown error occurred.';

  return (
    <div className="hermes-status-screen hermes-status-screen--error">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">✗</span>
        <h2 className="dev-heading-alpha">Delete failed</h2>
      </header>

      <p className="hermes-status-message">
        { message }
      </p>

      <div className="hermes-status-actions">
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.discardChanges() }
        >
          Back to view
        </button>
        <button
          type      = "button"
          className = "hermes-action-button hermes-action-button--danger"
          onClick   = { () => Hermes.deleteResource() }
        >
          Try again
        </button>
      </div>

    </div>
  );
}
