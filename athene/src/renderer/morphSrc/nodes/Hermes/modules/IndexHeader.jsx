// Right-pane header when mode === 'index'. Displays the
// collection plural as the primary heading with the resource class
// singular as an eyebrow above it for typographic rhythm, and a
// count of registered resources as side meta. The "New {singular}"
// entry point lives in the rail (ResourceList) rather than here —
// see the Create pivot.

export default function IndexHeader( { _, ResourceCollection } ) {

  const collectionMeta = _.getCoreData( 'resourceCollectionMeta' );
  const classMeta      = _.getCoreData( 'resourceClassMeta' );

  const plural   = collectionMeta?.plural ?? 'Resources';
  const singular = classMeta?.singular    ?? 'Resource';

  return (
    <header className="hermes-mode-header hermes-mode-header--index">
      <div className="hermes-mode-titling">
        <span className="hermes-mode-eyebrow">{ singular } collection</span>
        <h2 className="dev-heading-alpha">{ plural }</h2>
      </div>
      <span className="hermes-mode-meta">
        <span className="hermes-mode-meta-value">{ ResourceCollection.getResourceCount() }</span>
        <span className="hermes-mode-meta-label">registered</span>
      </span>
    </header>
  );
}
