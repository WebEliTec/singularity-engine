// EntityClassRegistry root module. Mounts the Hermes/EntityClass
// instance under a PageHeaderAlpha identity strip. Page-node identity
// stays here; engine usage stays in Hermes.

export default function Root( { Node, Component } ) {
  return (
    <div id="entity-class-registry" className="fade-in">

      <Component id="PageHeaderAlpha" title="Entity Class Manager" />

      <Node id="Hermes" instance="EntityClass" />

    </div>
  );
}
