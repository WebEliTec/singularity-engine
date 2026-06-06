// Select / dropdown renderer (`inputType: 'select'`). Bound to props
// like the simple-input renderer — no internal state, the owning
// EditBody passes onChange straight through to updateWorkingCopyField.
//
// Options shape: `config.options` is an array of `{ value, label }`.
// An empty-value placeholder option appears at the top when the
// current value is empty (so the field reads "(none selected)" rather
// than defaulting to the first option silently).
//
// Dependent-field states (the dependent-fields capability): a
// `dynamicOptionsAsync` select carries `config.optionsLoading` while its
// options fetch (e.g. a sub-class's traits load) and `config.optionsError` if
// the fetch failed. Either way the select is disabled — there's nothing valid
// to pick yet — showing a "Loading…" placeholder or the error inline.

export default function HermesSelectInput( { fieldId, config, value, errors, onChange } ) {

  const loading          = !! config?.optionsLoading;
  const optionsError     = config?.optionsError ?? '';
  const validationErrors = Array.isArray( errors ) ? errors : [];
  const hasErrors        = validationErrors.length > 0 || !! optionsError;
  const options          = Array.isArray( config?.options ) ? config.options : [];
  const current          = value ?? '';

  // While async options load (or if they failed), the field has nothing valid to
  // offer — disable it and show the appropriate placeholder.
  const disabled    = loading || !! optionsError;
  const placeholder = loading ? 'Loading…' : 'Select…';

  return (
    <div className={ `hermes-input hermes-input--select${ hasErrors ? ' has-errors' : '' }${ loading ? ' is-loading' : '' }` }>
      <label className="hermes-input-label" htmlFor={ fieldId }>
        { config?.label ?? fieldId }
      </label>
      <select
        id           = { fieldId }
        className    = "hermes-input-control"
        value        = { current }
        disabled     = { disabled }
        onChange     = { e => onChange?.( e.target.value ) }
        aria-invalid = { hasErrors || undefined }
      >
        { current === '' && (
          <option value="" disabled>{ placeholder }</option>
        ) }
        { options.map( opt => (
          <option key={ opt.value } value={ opt.value }>{ opt.label }</option>
        ) ) }
      </select>
      { hasErrors && (
        <ul className="hermes-input-errors">
          { optionsError && <li>{ optionsError }</li> }
          { validationErrors.map( ( message, i ) => (
            <li key={ i }>{ message }</li>
          ) ) }
        </ul>
      ) }
    </div>
  );
}
