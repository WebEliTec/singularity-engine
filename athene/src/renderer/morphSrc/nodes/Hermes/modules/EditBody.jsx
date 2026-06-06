// Right-pane content when (mode === 'edit' | 'create') with status
// 'normal' or 'evaluate'. Iterates the visible `inputElements` (those
// whose displayConditions match the current mode) and renders one
// HermesInput per field, bound to EditingDraft.
//
// Save / Discard affordances live in the mode header (EditHeader /
// CreateHeader); EditBody is purely the form surface. Save failures
// route to EditOnError / CreateOnError — no inline error box here.
//
// G7: reused across both edit and create modes. The displayConditions
// filter (via Hermes.getVisibleInputElements) is what makes this work
// — id renders during create (when its displayConditions.mode includes
// 'create') and disappears during edit (when it doesn't).

export default function EditBody( { _, Component, Hermes, EditingDraft } ) {

  const evaluation     = _.getSignal( 'singleResourceDataEvaluation' );
  const visibleFields  = Hermes.getVisibleInputElements();

  return (
    <div className="hermes-edit-body">
      <div className="hermes-edit-fields">
        { Object.entries( visibleFields ).map( ( [ fieldId, config ] ) => (
          <Component
            id       = "HermesInput"
            key      = { fieldId }
            fieldId  = { fieldId }
            config   = { config }
            value    = { EditingDraft.getFieldValue( fieldId ) ?? '' }
            errors   = { evaluation?.[ fieldId ] }
            onChange = { value => EditingDraft.updateField( fieldId, value ) }
          />
        ) ) }
      </div>
    </div>
  );
}
