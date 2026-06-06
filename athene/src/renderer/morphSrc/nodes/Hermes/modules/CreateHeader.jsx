// Right-pane header when mode === 'create'. Discard / Save action
// cluster on the right; titling block on the left. The heading
// shows the typed-in id (or a placeholder until the user types) so
// the user has visual confirmation of the entity they're creating.
//
// Mirrors EditHeader shape; the differences are the verbs:
//   - Save button → Hermes.createResource() (vs saveResource for edit)
//   - Discard → discardChanges (mode-aware exit; from create with no
//     selection yet, this returns to index)
//
// Save stays enabled whenever the draft is dirty (any field has been
// typed into) — the actual gate for "is the draft savable" is the
// validation step inside createResource, which fails to status=
// 'evaluate' if any required field is missing.

export default function CreateHeader( { _, Hermes, EditingDraft } ) {

  const loading   = _.getSignal( 'loadingResource' );
  const classMeta = _.getCoreData( 'resourceClassMeta' );

  const singular  = classMeta?.singular ?? 'Resource';
  const draftedId = EditingDraft.getFieldValue( 'id' ) ?? '';
  const heading   = draftedId || `New ${ singular }`;
  const isDirty   = EditingDraft.isDirty();

  return (
    <header className="hermes-mode-header hermes-mode-header--create">

      <div className="hermes-mode-titling">
        <span className="hermes-mode-eyebrow">New { singular }</span>
        <h2 className="dev-heading-alpha">{ heading }</h2>
      </div>

      <div className="hermes-mode-actions">
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.discardChanges() }
          disabled  = { loading }
        >
          Discard
        </button>
        <button
          type      = "button"
          className = "hermes-action-button hermes-action-button--save"
          onClick   = { () => Hermes.createResource() }
          disabled  = { loading || ! isDirty }
        >
          { loading ? 'Saving…' : 'Create' }
        </button>
      </div>

    </header>
  );
}
