// EntityClassWorkbench root module. Renders the per-class identity
// strip, a horizontal tab strip for sub-managers, and a content area
// that dispatches off the active sub-manager.
//
// D7 shipped the shell. D9 mounts Hermes/Attribute inside the
// Attribute Set Versions content area; D10+ fills the others.
//
// Tab labels reflect the conceptual model's versioning layer (iota I3):
// "Attribute Set Versions" rather than "Attributes" because attributes
// live INSIDE an ASV, not at the class level. Same logic for
// "Composition Scheme Versions" vs "Composition." Traits, Relations,
// and Taxonomies are themselves first-class children of EntityClass —
// no version layer to surface, so their labels stay as-is.

const subManagers = [
  { id: 'attributes',  label: 'Attribute Set Versions'  },   // D9 — Hermes/Attribute inside the latest ASV
  { id: 'traits',      label: 'Traits'                  },   // T3.1 — Hermes/Trait (trait CRUD); version surface at T3.2/T3.3
  { id: 'composition', label: 'Composition Scheme Versions' }, // C3 — Chronos/CompositionSchemeVersion + Hermes/CompositionDirective
  { id: 'relations',   label: 'Relations'               },   // D10+ placeholder
  { id: 'taxonomies',  label: 'Taxonomies'              },   // D10+ placeholder
];

export default function Root( { _, App, Node, Component } ) {

  const currentSubManager = _.getSignal( 'currentSubManager' );
  const selectedTraitId   = _.getSignal( 'selectedTraitId' );

  const classId     = App.athene.currentClassId;
  const entityClass = classId
    ? App.athene.world.entityClasses.getSingle( classId )
    : null;
  const title       = entityClass?.displayName ?? classId ?? 'No class selected';

  // Content dispatch. The Traits tab is two levels (T3.2): the trait picker
  // (Hermes/Trait) until a trait is drilled into, then THAT trait's
  // version-management surface. Level 2 is a placeholder until T3.3 mounts the
  // Chronos/TraitAttributeSetVersion strip + Hermes/TraitAttribute editor. The
  // workbench owns this level structure (the entry button is a Hermes
  // affordance; the "← Back to Traits" exit is the workbench's).
  let content;
  if ( currentSubManager === 'attributes' ) {
    // Gate the attribute editor on a selected version. With zero ASVs there is
    // nothing to scope it to, so the editor is replaced by a "create your first
    // version" prompt in the right pane — and the Chronos rail's "+ New Version"
    // creates the first draft, which selects it, and Hermes then mounts.
    // selectedAttributeSetVersionId is a truthy id whenever ≥1 ASV exists and ''
    // when none (Chronos maintains that invariant), so the editor mounts/unmounts
    // only at that boundary — never per chip click — so this does not reintroduce
    // the morpheus-core#26 remount race (chip-to-chip re-scoping stays Pattern-Y
    // in-place, via Athene.setSelected…).
    const hasSelectedAsv = !! _.getSignal( 'selectedAttributeSetVersionId' );
    content = (
      <div className="version-surface">
        <Node id="Chronos" instance="AttributeSetVersion" />
        <div className="version-surface-main">
          { hasSelectedAsv
            ? <Node id="Hermes" instance="Attribute" />
            : <p className="workbench-empty-state">Create your first Attribute Set Version</p> }
        </div>
      </div>
    );
  } else if ( currentSubManager === 'traits' && selectedTraitId ) {
    const trait = entityClass?.traits.getSingle( selectedTraitId );
    // Level 2: the trait's version surface — the SAME composition as the
    // Attributes tab (Chronos version rail + Hermes editor), scoped one level
    // deeper to the selected trait. A full-width back/scope bar sits on top; the
    // rail + editor row fills the rest. The editor is gated on a selected TASV
    // exactly like the Attributes / Composition tabs: a freshly-drilled trait has
    // zero TASVs, so the "create your first version" prompt shows in the right
    // pane until the rail's "+ New Version" creates one.
    const hasSelectedTasv = !! _.getSignal( 'selectedTraitAttributeSetVersionId' );
    content = (
      <div className="trait-version-surface fade-in">
        <div className="trait-version-bar">
          <button
            type      = "button"
            className = "workbench-back"
            onClick   = { () => App.athene.setSelectedTraitId( '' ) }
          >
            ← Back to Traits
          </button>
          <span className="trait-version-scope">{ trait?.displayName ?? selectedTraitId }</span>
        </div>
        <div className="version-surface">
          <Node id="Chronos" instance="TraitAttributeSetVersion" />
          <div className="version-surface-main">
            { hasSelectedTasv
              ? <Node id="Hermes" instance="TraitAttribute" />
              : <p className="workbench-empty-state">Create your first Trait Attribute Set Version</p> }
          </div>
        </div>
      </div>
    );
  } else if ( currentSubManager === 'traits' ) {
    content = <Node id="Hermes" instance="Trait" />;
  } else if ( currentSubManager === 'composition' ) {
    // Same one-level shape as the Attributes tab (Chronos version rail + Hermes
    // editor), class-only (composition has no second selection level). A fresh
    // class has zero CSVs, so the directive editor is gated on a selected version
    // exactly like the Attributes tab: with none, the "create your first version"
    // prompt shows in the right pane and the rail's "+ New Version" creates the
    // first scheme version, which selects it → the editor then mounts. Editor
    // mounts/unmounts only at that boundary — never per chip click — so no
    // morpheus-core#26 remount race (chip-to-chip re-scoping stays Pattern-Y
    // in-place).
    const hasSelectedCsv = !! _.getSignal( 'selectedCompositionSchemeVersionId' );
    content = (
      <div className="version-surface">
        <Node id="Chronos" instance="CompositionSchemeVersion" />
        <div className="version-surface-main">
          { hasSelectedCsv
            ? <Node id="Hermes" instance="CompositionDirective" />
            : <p className="workbench-empty-state">Create your first Composition Scheme Version</p> }
        </div>
      </div>
    );
  } else {
    content = <div className="workbench-placeholder">Coming in delta D10+.</div>;
  }

  return (
    <div id="entity-class-workbench" className="fade-in">

      <Component id="PageHeaderAlpha" title={ title } />

      <nav className="workbench-tabs">
        { subManagers.map( sm => (
          <button
            key       = { sm.id }
            className = { `workbench-tab${ sm.id === currentSubManager ? ' is-active' : '' }` }
            onClick   = { () => _.setSignal( 'currentSubManager', sm.id ) }
          >
            { sm.label }
          </button>
        ) ) }
      </nav>

      {/* `key` on the active tab remounts the content area on every tab
          switch, replaying the .fade-in entry animation (a CSS animation only
          fires on mount) — the same fade used for surface transitions between
          Home / Registry / Workbench. Intra-tab changes (ASV chip selection,
          trait drill-in) keep the same key, so they don't re-fade. */}
      <main className="workbench-content fade-in" key={ currentSubManager }>{ content }</main>

    </div>
  );
}
