// Single-line text input renderer (`inputType: 'text'`). Bound purely
// to props — no internal state — so the working copy stays
// uncontested as source of truth.
//
// Lifts onChange's `event.target.value` for parent simplicity; the
// owning EditBody passes that straight into `updateWorkingCopyField`.
//
// G5: renders the validation error list below the input when EditBody
// passes one through. The `.has-errors` modifier on the wrapper lets
// the SCSS adjust the input chrome (red-ish border) when invalid.

export default function HermesSimpleInput( { fieldId, config, value, errors, onChange } ) {

  const hasErrors = Array.isArray( errors ) && errors.length > 0;

  return (
    <div className={ `hermes-input hermes-input--text${ hasErrors ? ' has-errors' : '' }` }>
      <label className="hermes-input-label" htmlFor={ fieldId }>
        { config?.label ?? fieldId }
      </label>
      <input
        id           = { fieldId }
        type         = "text"
        className    = "hermes-input-control"
        value        = { value ?? '' }
        onChange     = { e => onChange?.( e.target.value ) }
        aria-invalid = { hasErrors || undefined }
      />
      { hasErrors && (
        <ul className="hermes-input-errors">
          { errors.map( ( message, i ) => (
            <li key={ i }>{ message }</li>
          ) ) }
        </ul>
      ) }
    </div>
  );
}
