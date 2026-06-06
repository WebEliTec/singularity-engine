// PageHeaderAlpha — global component (presentational)
//
// Per-page-node identity strip. The engine logo sits on the left as a
// faded backdrop; the title overlays it with a mask-gradient fade.
// Adapted from devApp's centered Overview brand (see
// some-morpheus-based-app/morpheus/devApp/nodes/Overview/Root.jsx +
// _overview.scss) at a smaller scale, left-aligned, to read as a
// per-surface identity strip rather than a brand hero.
//
// Direct ES import of SingularityLogoAnimated — global components
// don't get the `Component` framework prop (props-only). See
// [[component-naming-convention]].

import SingularityLogoAnimated from './SingularityLogoAnimated.jsx';

export default function PageHeaderAlpha( { title } ) {
  return (
    <header className="page-header-alpha">
      <SingularityLogoAnimated width="100px" height="100px" />
      <h2 className="page-header-alpha-title">{ title }</h2>
    </header>
  );
}
