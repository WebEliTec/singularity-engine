// Right-pane content when mode === 'index'. With the header
// extracted to IndexHeader (G3), IndexBody focuses on the descriptive
// surface: it explains what selecting a row will do. Edit / create /
// delete affordances arrive in later gammas; the prompt updates then.

export default function IndexBody( { _ } ) {

  const classMeta       = _.getCoreData( 'resourceClassMeta' );
  const singularLowered = ( classMeta?.singular ?? 'resource' ).toLowerCase();

  return (
    <div className="hermes-index-body">
      <p className="hermes-index-prompt">
        Select a { singularLowered } from the list to view it.
        Edit / create / delete affordances arrive in later gammas.
      </p>
    </div>
  );
}
