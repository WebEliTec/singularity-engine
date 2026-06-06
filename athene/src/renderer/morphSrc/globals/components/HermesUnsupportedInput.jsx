// Read-only fallback for inputTypes the current gamma slice doesn't
// implement yet. Surfaces the gap visibly — better than a blank slot
// or a silently-skipped field. As later gammas add inputType
// renderers, fields that fell through to this component will start
// rendering correctly without any host-side change.

export default function HermesUnsupportedInput( { fieldId, config } ) {
  return (
    <div className="hermes-input hermes-input--unsupported">
      <label className="hermes-input-label">{ config?.label ?? fieldId }</label>
      <div className="hermes-input-unsupported-note">
        Input type <code>{ config?.inputType ?? 'unknown' }</code> not supported yet
        (field <code>{ fieldId }</code>).
      </div>
    </div>
  );
}
