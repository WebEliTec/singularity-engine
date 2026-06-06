// Right pane — dispatches the appropriate modules based on the
// (mode × status) state machine. Mode picks the surface (index,
// view, edit, create, …); status overlays it when an operation is
// in a non-normal phase (evaluate / success / error / confirm).
//
// G3 introduced the header/body split per mode. G6 added the edit
// status overlay (EditOnSuccess / EditOnError). G7 adds the
// symmetric create-mode flow + reuses EditBody for the form surface:
//
//   mode='edit'   normal/evaluate → EditHeader   + EditBody
//   mode='edit'   success         → EditOnSuccess
//   mode='edit'   error           → EditOnError
//   mode='create' normal/evaluate → CreateHeader + EditBody
//   mode='create' success         → CreateOnSuccess
//   mode='create' error           → CreateOnError
//
// EditBody handles both edit + create modes by filtering inputElements
// through Hermes.getVisibleInputElements (which respects each field's
// displayConditions). The EntityClass `id` field is create-only:
// rendered during create, skipped during edit.

export default function ContentBody( { Hermes, Module } ) {

  const showEditForm = Hermes.modeIs( 'edit' )
    && ! Hermes.statusIs( 'success' )
    && ! Hermes.statusIs( 'error' );

  const showCreateForm = Hermes.modeIs( 'create' )
    && ! Hermes.statusIs( 'success' )
    && ! Hermes.statusIs( 'error' );

  return (
    <section className="hermes-content-body">
      <div className="hermes-content-inner">

        { Hermes.modeIs( 'index' ) && (
          <>
            <Module id="IndexHeader" />
            <Module id="IndexBody"   />
          </>
        ) }

        { Hermes.modeIs( 'view' ) && (
          <>
            <Module id="ViewHeader" />
            <Module id="ViewBody"   />
          </>
        ) }

        { showEditForm && (
          <>
            <Module id="EditHeader" />
            <Module id="EditBody"   />
          </>
        ) }

        { Hermes.modeIs( 'edit' ) && Hermes.statusIs( 'success' ) && (
          <Module id="EditOnSuccess" />
        ) }

        { Hermes.modeIs( 'edit' ) && Hermes.statusIs( 'error' ) && (
          <Module id="EditOnError" />
        ) }

        { showCreateForm && (
          <>
            <Module id="CreateHeader" />
            <Module id="EditBody"     />
          </>
        ) }

        { Hermes.modeIs( 'create' ) && Hermes.statusIs( 'success' ) && (
          <Module id="CreateOnSuccess" />
        ) }

        { Hermes.modeIs( 'create' ) && Hermes.statusIs( 'error' ) && (
          <Module id="CreateOnError" />
        ) }

        { Hermes.modeIs( 'delete' ) && Hermes.statusIs( 'confirm' ) && (
          <Module id="DeleteConfirm" />
        ) }

        { Hermes.modeIs( 'delete' ) && Hermes.statusIs( 'success' ) && (
          <Module id="DeleteOnSuccess" />
        ) }

        { Hermes.modeIs( 'delete' ) && Hermes.statusIs( 'error' ) && (
          <Module id="DeleteOnError" />
        ) }

      </div>
    </section>
  );
}
