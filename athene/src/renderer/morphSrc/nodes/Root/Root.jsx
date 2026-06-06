// App-level styles imported here per morphDocs example 03 — exactly
// once, in the root module of the root node. Every descendant module
// inherits the cascade.
import '../../assets/styles/main.scss';

// Pure dispatcher + shell host. Renders the persistent Sidebar (D5)
// alongside a `<main>` slot that mounts the page-node corresponding to
// the current `currentSurface` signal. The AgentConsole (β4) is a second
// persistent sibling — fixed-positioned, so it floats over whichever
// page-node is mounted and stays put as the agent navigates beneath it.

const pageNodes = {
  home:           'Home',
  classRegistry:  'EntityClassRegistry',
  classWorkbench: 'EntityClassWorkbench',
};

export default function Root( { _, Node, Module } ) {

  const currentSurface = _.getSignal( 'currentSurface' );

  const pageNodeId = pageNodes[ currentSurface ] ?? pageNodes.home;

  return (
    <div id="root-shell" className="fade-in">

      <Module id="Sidebar" />

      <main id="root-main">
        <Node id={ pageNodeId } />
      </main>

      <Module id="AgentConsole" />

    </div>
  );
}
