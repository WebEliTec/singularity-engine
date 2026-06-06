// ListAlpha — global component (presentational)
//
// Clickable list of rows. Pivots above (optional), items in a <nav>,
// pivots below (optional). Pure props in, JSX out — see
// [[component-naming-convention]].
//
// Pivot shape : { glyph, label, isActive, onClick }
// Item  shape : { id, name, secondary?, isActive, onClick }
// emptyLabel  : optional text shown in place of the items <nav> when there are
//               no items (e.g. "No attributes available"). Omitted ⇒ nothing.

function PivotRow( { glyph, label, isActive, onClick } ) {
  return (
    <div
      className = { `list-alpha-pivot${ isActive ? ' is-active' : '' }` }
      onClick   = { onClick }
      role      = "button"
      tabIndex  = { 0 }
    >
      { glyph !== undefined && (
        <span className="list-alpha-pivot-glyph" aria-hidden="true">{ glyph }</span>
      ) }
      <span className="list-alpha-pivot-label">{ label }</span>
    </div>
  );
}

function ItemRow( { name, secondary, isActive, onClick } ) {
  return (
    <div
      className = { `list-alpha-item${ isActive ? ' is-active' : '' }` }
      onClick   = { onClick }
    >
      <span className="list-alpha-item-name">{ name }</span>
      { secondary !== undefined && (
        <span className="list-alpha-item-secondary">{ secondary }</span>
      ) }
    </div>
  );
}

export default function ListAlpha( { topPivots = [], items = [], bottomPivots = [], emptyLabel } ) {
  return (
    <>

      { topPivots.map( ( pivot, i ) => (
        <PivotRow key={ `top-${ i }` } { ...pivot } />
      ) ) }

      { items.length > 0 ? (
        <nav className="list-alpha-items">
          { items.map( item => (
            <ItemRow key={ item.id } { ...item } />
          ) ) }
        </nav>
      ) : emptyLabel !== undefined && (
        <p className="list-alpha-empty">{ emptyLabel }</p>
      ) }

      { bottomPivots.map( ( pivot, i ) => (
        <PivotRow key={ `bottom-${ i }` } { ...pivot } />
      ) ) }

    </>
  );
}
