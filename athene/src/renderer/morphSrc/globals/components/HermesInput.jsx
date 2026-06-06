// Polymorphic input dispatcher for Hermes edit/create forms. Looks
// at `config.inputType` and renders the matching concrete component.
// Inputs are global components (`globals/components/`) — they have no
// kernel access and bind purely to props. The owning module
// (EditBody / future CreateBody) wires onChange to the kernel's
// `updateWorkingCopyField` method.
//
// G4 supported only `text`. Delta D9 (Attribute CRUD) adds `select`
// for dropdown / option-list fields like attribute_data_type. Other
// inputType values fall through to HermesUnsupportedInput so the gap
// is visible at runtime rather than silently absent.

import HermesSimpleInput      from './HermesSimpleInput.jsx';
import HermesSelectInput      from './HermesSelectInput.jsx';
import HermesUnsupportedInput from './HermesUnsupportedInput.jsx';

export default function HermesInput( { fieldId, config, value, errors, onChange } ) {

  switch ( config?.inputType ) {

    case 'text':
      return (
        <HermesSimpleInput
          fieldId  = { fieldId }
          config   = { config }
          value    = { value }
          errors   = { errors }
          onChange = { onChange }
        />
      );

    case 'select':
      return (
        <HermesSelectInput
          fieldId  = { fieldId }
          config   = { config }
          value    = { value }
          errors   = { errors }
          onChange = { onChange }
        />
      );

    default:
      return (
        <HermesUnsupportedInput
          fieldId = { fieldId }
          config  = { config }
        />
      );

  }
}
