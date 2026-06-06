// VersionList — the version list (vertical, scrollable). One row per version,
// each showing the version's id + lifecycle-stage badge (Draft / Committed).
// Chip selection: click a chip → the instance's `selectVersion` coreFunction
// (T3.3), which flips that instance's canonical workbench signal + its mirror +
// the co-mounted editor refresh via the right Athene setter. Routing through a
// coreFunction (rather than a hardcoded Athene call) keeps this module
// instance-agnostic — the AttributeSetVersion and TraitAttributeSetVersion
// instances each bind their own setter. Per-chip lifecycle affordances (E3)
// layer on without reshape.

export default function VersionList( { _ } ) {

  const versions = _.getSignal( 'versionList' );
  const loading  = _.getSignal( 'loadingVersions' );
  const error    = _.getSignal( 'versionsError' );
  const meta     = _.getCoreData( 'versionCollectionMeta' );

  // Short header for the narrow rail — meta.plural is "Versions" for every
  // instance; the specific family name ("Composition Scheme Versions", …) is
  // already on the active workbench tab, so the long collectionLabel would only
  // wrap awkwardly here.
  const label      = meta?.plural ?? 'Versions';
  // Chronos's local mirror of "which version is currently selected" —
  // kept in sync by Athene's setSelected* methods when chip clicks
  // (or fetchAllVersions defaulting) flip the canonical workbench
  // signal. Reading the mirror here means VersionList re-renders on
  // selection change; reading the workbench signal indirectly through
  // Athene wouldn't, since morpheus only triggers re-render when a
  // module's OWN signals change.
  const selectedId = _.getSignal( 'selectedVersionId' );

  // Newest version first — highest id on top. The versionList array is ascending
  // by id (Apollo's walk + the collection's id-ordered Map), so a reverse gives
  // descending; copy first so the signal's array isn't mutated. The count +
  // loading checks below stay on the original array (order-independent).
  const ordered = [ ...versions ].reverse();

  if ( loading && versions.length === 0 ) {
    return (
      <section className="chronos-strip">
        <div className="chronos-strip-loading">Loading versions…</div>
      </section>
    );
  }

  if ( error ) {
    return (
      <section className="chronos-strip">
        <div className="morpheus-error-box">
          <span className="morpheus-error-corner" />
          <strong>Error</strong>
          <p>{ error }</p>
        </div>
      </section>
    );
  }

  return (
    <section className="chronos-strip">

      <header className="chronos-strip-header">
        <span className="chronos-strip-eyebrow">{ label }</span>
        <span className="chronos-strip-count">{ versions.length }</span>
      </header>

      <div className="chronos-strip-chips">
        { ordered.map( v => {
          const stage    = v.lifeCycleStage ?? 'unknown';
          const isActive = v.id === selectedId;
          return (
            <button
              key       = { v.id }
              type      = "button"
              className = { `chronos-chip chronos-chip--${ stage }${ isActive ? ' is-active' : '' }` }
              onClick   = { () => ! isActive && _.callCoreFunction( 'selectVersion', v.id ) }
              disabled  = { isActive }
            >
              <span className="chronos-chip-id">v{ v.id }</span>
              <span className={ `chronos-chip-stage chronos-chip-stage--${ stage }` }>
                { stage === 'draft' ? 'Draft' : stage === 'committed' ? 'Committed' : stage }
              </span>
            </button>
          );
        } ) }
      </div>

    </section>
  );
}
