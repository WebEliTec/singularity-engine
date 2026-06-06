// Chronos root module. Vertical version-rail column: the lifecycle control
// panel (ActionRow — create / commit / delete-draft, plus the inline
// delete-confirm sub-state) on top, the scrollable version list (VersionList)
// below. Sits as the left column of a version tab; the co-mounted Hermes editor
// fills the space to its right.

export default function Root( { Module } ) {
  return (
    <div className="chronos">
      <Module id="ActionRow" />
      <Module id="VersionList" />
    </div>
  );
}
