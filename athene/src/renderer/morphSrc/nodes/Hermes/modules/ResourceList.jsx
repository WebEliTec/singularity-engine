// Left rail — navigation list of all resources for this Hermes
// instance. Thin adapter: reads signals + sub-entities, maps them to
// the `PanelAlpha` + `ListAlpha` global components' prop shapes.
//
// The visual primitives were lifted out of this module at delta D1 (see
// `globals/components/PanelAlpha.jsx`, `ListAlpha.jsx`). This file
// keeps only the Hermes-specific concerns: loading + error states, the
// Index/Create pivots' wiring, and the per-item selection handler.

export default function ResourceList( { _, Component, Hermes, ResourceCollection } ) {

  const loading        = _.getSignal( 'loadingResource' );
  const error          = _.getSignal( 'resourceError' );
  const selectedId     = _.getSignal( 'selectedResourceId' );
  const collectionMeta = _.getCoreData( 'resourceCollectionMeta' );
  const classMeta      = _.getCoreData( 'resourceClassMeta' );

  const plural   = collectionMeta?.plural ?? 'Resources';
  const singular = classMeta?.singular    ?? 'Resource';
  const count    = ResourceCollection.getResourceCount();

  if ( loading && count === 0 ) {
    return (
      <Component id="PanelAlpha" eyebrow={ plural }>
        <div className="hermes-loading">Loading…</div>
      </Component>
    );
  }

  if ( error ) {
    return (
      <Component id="PanelAlpha" eyebrow={ plural }>
        <div className="morpheus-error-box">
          <span className="morpheus-error-corner" />
          <strong>Error</strong>
          <p>{ error }</p>
        </div>
      </Component>
    );
  }

  const topPivots = [
    {
      glyph:    '≡',
      label:    'Index',
      isActive: Hermes.modeIs( 'index' ),
      onClick:  () => Hermes.enterIndexMode(),
    },
    {
      glyph:    '+',
      label:    `New ${ singular }`,
      isActive: Hermes.modeIs( 'create' ),
      onClick:  () => Hermes.enterCreateMode(),
    },
  ];

  const items = ResourceCollection.getAllResources().map( resource => {
    const id = resource.getId();
    return {
      id,
      name:      resource.getDisplayName(),
      secondary: id,
      isActive:  selectedId === id,
      onClick:   () => Hermes.selectResource( id ),
    };
  } );

  return (
    <Component id="PanelAlpha" eyebrow={ plural } count={ count }>
      <Component
        id         = "ListAlpha"
        topPivots  = { topPivots }
        items      = { items }
        emptyLabel = { `No ${ plural.toLowerCase() } available` }
      />
    </Component>
  );
}
