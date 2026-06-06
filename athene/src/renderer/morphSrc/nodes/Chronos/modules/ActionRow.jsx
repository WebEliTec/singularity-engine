// ActionRow — the lifecycle-action control panel atop the version list
// (E3). Always offers "+ New Version". When the SELECTED version is a
// draft, also offers "Commit" and "Delete Draft"; a committed version is
// immutable, so it shows no mutating actions. "Delete Draft" arms an
// inline confirm sub-state (Chronos's analog of Hermes's G8 delete
// confirm) rather than deleting on first click.
//
// Thin reactor: all orchestration (in-flight, error, confirm, the
// World-tree writes) lives in the kernel + the instance's coreFunctions.
// This module only reads signals and dispatches intent.

export default function ActionRow( { _ } ) {

  const versions   = _.getSignal( 'versionList' );
  const selectedId = _.getSignal( 'selectedVersionId' );
  const inFlight   = _.getSignal( 'actionInFlight' );
  const pendingId  = _.getSignal( 'pendingDeleteId' );
  const error      = _.getSignal( 'actionError' );

  const selected   = versions.find( v => v.id === selectedId ) ?? null;
  const isDraft    = selected?.lifeCycleStage === 'draft';
  const confirming = pendingId !== '' && pendingId === selectedId;

  return (
    <section className="chronos-actions">

      { error && (
        <div className="chronos-action-error" role="alert">{ error }</div>
      ) }

      { confirming ? (
        <div className="chronos-confirm">
          <span className="chronos-confirm-prompt">
            <span className="chronos-confirm-icon" aria-hidden="true">⚠</span>
            Delete draft <strong>v{ selectedId }</strong>? This cannot be undone.
          </span>
          <div className="chronos-confirm-actions">
            <button
              type      = "button"
              className = "chronos-btn chronos-btn--ghost"
              onClick   = { () => _.cancelDelete() }
              disabled  = { inFlight }
            >
              Cancel
            </button>
            <button
              type      = "button"
              className = "chronos-btn chronos-btn--danger"
              onClick   = { () => _.confirmDelete() }
              disabled  = { inFlight }
            >
              { inFlight ? 'Deleting…' : 'Delete Draft' }
            </button>
          </div>
        </div>
      ) : (
        <div className="chronos-action-buttons">
          <button
            type      = "button"
            className = "chronos-btn chronos-btn--primary"
            onClick   = { () => _.createVersion() }
            disabled  = { inFlight }
          >
            { inFlight ? 'Working…' : '+ New Version' }
          </button>

          { isDraft && (
            <>
              <button
                type      = "button"
                className = "chronos-btn chronos-btn--commit"
                onClick   = { () => _.commitSelected() }
                disabled  = { inFlight }
              >
                Commit
              </button>
              <button
                type      = "button"
                className = "chronos-btn chronos-btn--danger-ghost"
                onClick   = { () => _.requestDeleteSelected() }
                disabled  = { inFlight }
              >
                Delete Draft
              </button>
            </>
          ) }
        </div>
      ) }

    </section>
  );
}
