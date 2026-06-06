// The agent that validates the working copy against the instance's
// `inputElements.constraints`. Pure JS — no DOM walking — so the
// evaluation is decoupled from render order and can run before the
// form has even painted.
//
// Constraint vocabulary (G5):
//   - required  : non-empty after trim
//   - minLength : value length ≥ N
//   - maxLength : value length ≤ N
//   - pattern   : named regex from the `namedPatterns` registry
//
// Constraint shape mirrors CMH's `inputElements[fieldId].constraints`
// so a config copied from CMH works here unchanged.
//
// Kernel method names (`evaluateEditingDraft`, `evaluateField`,
// `hasEvaluationErrors`, `clearEvaluation`) are unchanged from the
// pre-T4 kernel fragment — only the home moved (kernel fragment →
// HermesChild class). Call sites switch from `this.kernel.evaluateEditingDraft()`
// to `this.hermes.validator.evaluateEditingDraft()` (or via the
// `Validator` moduleProp inside modules).
//

import HermesChild from './HermesChild.js';

// Named regex registry — referenced from inputElements via
// `constraints.pattern: 'smallLettersAndUnderscores'`. Stays as a
// module-private constant (not a kernel/class method) because it's
// pure data: no `this`, no signals, no per-call state. Extend here
// when a host needs a new named pattern.
const namedPatterns = {
  smallLettersAndUnderscores: {
    regex:   /^[a-z_]+$/,
    message: 'Only small letters and underscores are allowed.',
  },
  smallLettersAndUnderscoresAndNumbers: {
    regex:   /^[a-z0-9_]+$/,
    message: 'Only lowercase letters, numbers, and underscores are allowed.',
  },
  // Machine-key casing for ids (entity-class + attribute) — matches Apollo's
  // id validation (route segments + create body) so UI-minted ids are accepted.
  kebabCase: {
    regex:   /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    message: 'Only lowercase letters, numbers, and single hyphens are allowed (kebab-case).',
  },
};

class Validator extends HermesChild {

  // Runs an evaluation pass over the entire working copy. Iterates
  // the configured inputElements, delegates each field to
  // `evaluateField` (a sibling method on this class), assembles an
  // errors map keyed by fieldId, writes it to the
  // `singleResourceDataEvaluation` signal, and returns the map so
  // callers (e.g. `updateResource` in the inline kernel) can branch
  // synchronously on emptiness without re-reading the signal.
  evaluateEditingDraft() {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const errors = {};
    for ( const fieldId of Object.keys( inputElements ) ) {
      // Honor mode-based displayConditions — fields the current mode
      // hides (e.g. EntityClass's id during edit) shouldn't gate
      // saves, even when their constraints would otherwise fail.
      if ( ! this.hermes.shouldDisplayField( fieldId ) ) { continue; }
      const fieldErrors = this.evaluateField( fieldId );
      if ( fieldErrors.length > 0 ) {
        errors[ fieldId ] = fieldErrors;
      }
    }
    this.kernel.setSignal( 'singleResourceDataEvaluation', errors );
    return errors;
  }

  // Evaluates one field against its constraints. Returns an array
  // of error messages (empty array if the field is valid). Pulls
  // config + value via `this.kernel` so it's callable in isolation —
  // module-level handlers that want to validate a single field on
  // blur (future gamma) can call this directly.
  evaluateField( fieldId ) {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const draft         = this.kernel.getOptimisticSignal( 'singleResourceDataWorkingCopy' );
    const config        = inputElements[ fieldId ];
    if ( ! config ) { return []; }

    const value       = draft?.[ fieldId ] ?? '';
    const stringValue = typeof value === 'string' ? value : String( value );
    const constraints = config?.constraints ?? {};
    const errors      = [];

    if ( constraints.required && stringValue.trim() === '' ) {
      errors.push( 'This field is required.' );
    }

    if ( constraints.minLength != null && stringValue.length < constraints.minLength ) {
      errors.push( `Must be at least ${ constraints.minLength } characters.` );
    }

    if ( constraints.maxLength != null && stringValue.length > constraints.maxLength ) {
      errors.push( `Must be at most ${ constraints.maxLength } characters.` );
    }

    if ( constraints.pattern ) {
      const rule = namedPatterns[ constraints.pattern ];
      if ( ! rule ) {
        errors.push( `Unknown pattern "${ constraints.pattern }" — not in the registry.` );
      } else if ( stringValue !== '' && ! rule.regex.test( stringValue ) ) {
        // Pattern errors don't fire on empty values — `required`
        // owns the emptiness message, stacking both confuses the
        // user. CMH did the same.
        errors.push( rule.message );
      }
    }

    return errors;
  }

  // True if the current evaluation map has any field errors.
  // Useful for modules wanting a single boolean (e.g. disabling a
  // Save button based on validity rather than just dirtiness).
  hasEvaluationErrors() {
    const evaluation = this.kernel.getOptimisticSignal( 'singleResourceDataEvaluation' );
    return Object.keys( evaluation ?? {} ).length > 0;
  }

  // Clears the evaluation map. Called on edit-mode entry, on
  // discard, and after a successful save — anywhere we want a
  // fresh slate.
  clearEvaluation() {
    this.kernel.setSignal( 'singleResourceDataEvaluation', {} );
  }

}

export default Validator;
