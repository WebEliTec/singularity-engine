// Right-pane content when (mode === 'edit') && (status === 'error').
// Rendered by ContentBody.jsx after a save attempt threw (network
// failure, server-side rejection, etc.). The user's draft is
// preserved — their typed-in changes are still in EditingDraft, so
// "Back to editing" or "Try again" both pick up exactly where they
// left off.
//
// Reads the server-side message from `systemMessage` (set by
// Hermes.saveResource's catch) with a fallback to the lower-level
// `resourceError` if no systemMessage was captured.

export default function EditOnError( { _, Hermes } ) {

  const systemMessage = _.getSignal( 'systemMessage' );
  const resourceError = _.getSignal( 'resourceError' );
  const message       = systemMessage || resourceError || 'An unknown error occurred.';

  return (
    <div className="hermes-status-screen hermes-status-screen--error">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">✗</span>
        <h2 className="dev-heading-alpha">Save failed</h2>
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
          Discard
        </button>
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.setStatus( 'normal' ) }
        >
          Back to editing
        </button>
        <button
          type      = "button"
          className = "hermes-action-button"
          onClick   = { () => Hermes.saveResource() }
        >
          Try again
        </button>
      </div>

    </div>
  );
}
