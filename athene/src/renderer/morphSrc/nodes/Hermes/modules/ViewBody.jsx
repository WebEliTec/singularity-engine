// Right-pane content when mode === 'view'. With the header extracted to
// ViewHeader (G3), ViewBody is just the labeled field list for the
// currently-selected resource.
//
// Config-driven (was hard-coded to the EntityClass field set): it renders the
// id plus each field the instance declares in `coreData.inputElements` that is
// visible in view mode — the SAME config the edit/create form uses. So every
// Hermes instance shows ITS OWN fields without touching this module:
// EntityClass → Singular / Plural / Description; Attribute → Label /
// Description / Data Type.

export default function ViewBody( { _, ResourceCollection } ) {

  const loading = _.getSignal( 'loadingResource' );
  const error   = _.getSignal( 'resourceError' );
  const current = ResourceCollection.getCurrentResource();

  if ( loading && ! current ) {
    return <div className="hermes-loading">Loading…</div>;
  }

  if ( error ) {
    return (
      <div className="morpheus-error-box">
        <span className="morpheus-error-corner" />
        <strong>Error</strong>
        <p>{ error }</p>
      </div>
    );
  }

  if ( ! current ) {
    return <p className="hermes-index-prompt">No resource selected.</p>;
  }

  // Fields to show: every declared input element visible in view mode (a field
  // is view-visible unless its displayConditions.mode excludes 'view' — which
  // is how the create-only `id` is filtered; the id is shown separately below).
  const inputElements = _.getCoreData( 'inputElements' ) ?? {};
  const viewFields = Object.entries( inputElements ).filter( ( [ , cfg ] ) => {
    const modes = cfg?.displayConditions?.mode;
    return ! modes || modes.includes( 'view' );
  } );

  // Build the <dl> children as a flat keyed list so <dt>/<dd> stay direct
  // children of <dl> (the CSS targets them directly).
  const rows = [
    <dt key="id-label">ID</dt>,
    <dd key="id-value"><span className="path">{ current.getId() }</span></dd>,
  ];

  for ( const [ fieldId, cfg ] of viewFields ) {
    const label = cfg?.label ?? fieldId;
    const raw   = current.getFieldValue( fieldId );
    rows.push( <dt key={ `${ fieldId }-label` }>{ label }</dt> );

    if ( fieldId === 'description' ) {
      // Description may carry HTML (EntityClass) — render it as markup; plain
      // text (Attribute) renders unchanged.
      rows.push(
        <dd
          key={ `${ fieldId }-value` }
          className="hermes-field-html"
          dangerouslySetInnerHTML={{ __html: raw || '<em>No description.</em>' }}
        />,
      );
      continue;
    }

    // For a select, show the chosen option's human label (e.g. dataType
    // 'text' → 'Text'); otherwise the raw value, or '—' when empty.
    const option  = Array.isArray( cfg?.options ) ? cfg.options.find( o => o.value === raw ) : null;
    const display = option ? option.label : ( raw === '' || raw == null ? '—' : String( raw ) );
    rows.push( <dd key={ `${ fieldId }-value` }>{ display }</dd> );
  }

  return <dl className="hermes-fields">{ rows }</dl>;
}
