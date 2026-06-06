// Right-pane content when (mode === 'create') && (status === 'error').
// Rendered after a failed POST. The draft is preserved so "Back to
// creating" or "Try again" picks up exactly where the user was.
//
// Common Laravel-side failures the server surfaces here:
//   - "Content class with the same ID already exists."  (duplicate id)
//   - "Invalid input provided. All fields are required." (validation —
//     although our client-side Validator should catch this before
//     a network call ever fires)
//   - Network errors (Laravel down, etc.)
//
// "Discard" sends the user back to the index (discardChanges' selection
// check: no selectedResourceId → enterIndexMode).

export default function CreateOnError( { _, Hermes } ) {

  const systemMessage = _.getSignal( 'systemMessage' );
  const resourceError = _.getSignal( 'resourceError' );
  const message       = systemMessage || resourceError || 'An unknown error occurred.';

  return (
    <div className="hermes-status-screen hermes-status-screen--error">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">✗</span>
        <h2 className="dev-heading-alpha">Create failed</h2>
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
          Back to creating
        </button>
        <button
          type      = "button"
          className = "hermes-action-button"
          onClick   = { () => Hermes.createResource() }
        >
          Try again
        </button>
      </div>

    </div>
  );
}
