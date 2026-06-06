// AgentConsole — the AI control layer's chat panel (β4 / B4.3). A persistent
// floating dock, mounted by Root alongside the Sidebar so it stays put while
// the surface navigates beneath it. You type an intent; the agent both ANSWERS
// in words and DRIVES the UI — each turn runs through
// App.agentTransport.sendTurn(), which calls Claude with the capability
// manifest (getAgentManifest), dispatches the chosen intents through
// callAgentMethod (the same path a Sidebar click takes), and feeds the results
// back. The little action chips under a reply are the agent's moves, made
// watchable.
//
// All state lives on Root's kernel as signals (zero React hooks, per the
// codebase convention — see Sidebar): open/closed, the input buffer, busy, the
// display transcript, and the raw Anthropic message history for continuity.

// Starter prompts shown on the empty transcript — the two intents wired today.
const SUGGESTIONS = [
  'Take me to the entity classes',
  'Go home',
];

// Turn a non-ok sendTurn envelope into something a human wants to read.
function describeFailure( res ) {
  const detail = res?.details;
  const noKey  = detail === 'no_api_key' || detail?.error === 'no_api_key';
  if ( res?.error === 'transport_error' && noKey ) {
    return 'I can’t reach the model — Athene was launched without ANTHROPIC_API_KEY set.';
  }
  if ( res?.error === 'transport_error' ) return 'I couldn’t reach the model on that turn.';
  if ( res?.error === 'no_transport'   ) return 'The agent transport isn’t wired up yet.';
  if ( res?.error === 'max_iterations' ) return 'I took several steps but didn’t finish — try rephrasing?';
  return 'Something went wrong on that turn.';
}

export default function AgentConsole( { _, App } ) {

  const isOpen     = _.getSignal( 'agentConsoleOpen' );
  const input      = _.getSignal( 'agentInput' );
  const isBusy     = _.getSignal( 'agentBusy' );
  const transcript = _.getSignal( 'agentTranscript' );

  const append = ( entry ) =>
    _.setSignal( 'agentTranscript', [ ..._.getSignal( 'agentTranscript' ), entry ] );

  // One turn. `explicitText` lets a suggestion chip submit its own text without
  // depending on the (render-time stale) `input` closure; the composer calls
  // send() and the fresh value is read straight off the signal.
  const send = async ( explicitText ) => {
    const text = ( typeof explicitText === 'string' ? explicitText : _.getSignal( 'agentInput' ) || '' ).trim();
    if ( ! text || _.getSignal( 'agentBusy' ) ) return;

    if ( ! App.agentTransport ) {
      append( { role: 'agent', text: 'The agent transport is unavailable in this context.', isError: true } );
      return;
    }

    append( { role: 'user', text } );
    _.setSignal( 'agentInput', '' );
    _.setSignal( 'agentBusy', true );

    const prior = _.getSignal( 'agentMessages' );
    const res   = await App.agentTransport.sendTurn( text, { messages: prior.length ? prior : null } );

    _.setSignal( 'agentBusy', false );

    if ( res.ok ) {
      append( { role: 'agent', text: res.text || 'Done.', actions: res.actions } );
      _.setSignal( 'agentMessages', res.messages || [] );
    } else {
      append( { role: 'agent', text: describeFailure( res ), actions: res.actions, isError: true } );
    }
  };

  const onKeyDown = ( e ) => {
    if ( e.key === 'Enter' && ! e.shiftKey ) { e.preventDefault(); send(); }
  };

  // Closed: a small floating launcher.
  if ( ! isOpen ) {
    return (
      <button
        className  = "agent-launcher"
        onClick    = { () => _.setSignal( 'agentConsoleOpen', true ) }
        aria-label = "Open the agent chat"
      >
        <span className="agent-launcher-glyph" aria-hidden="true">✦</span>
        <span className="agent-launcher-label">Ask</span>
      </button>
    );
  }

  return (
    <section className="agent-console" aria-label="Agent chat">

      <header className="agent-console-header">
        <span className="agent-console-title">
          <span className="agent-console-title-glyph" aria-hidden="true">✦</span>
          Agent
        </span>
        <button
          className  = "agent-console-close"
          onClick    = { () => _.setSignal( 'agentConsoleOpen', false ) }
          aria-label = "Close the agent chat"
        >×</button>
      </header>

      <div className="agent-console-transcript">

        { transcript.length === 0 && ! isBusy && (
          <div className="agent-console-empty">
            <p className="agent-console-empty-lead">Tell me what you’d like to do.</p>
            <div className="agent-console-suggestions">
              { SUGGESTIONS.map( ( suggestion, i ) => (
                <button
                  key       = { i }
                  className = "agent-console-suggestion"
                  onClick   = { () => send( suggestion ) }
                >{ suggestion }</button>
              ) ) }
            </div>
          </div>
        ) }

        { transcript.map( ( entry, i ) => (
          <div key={ i } className={ `agent-msg agent-msg-${ entry.role }${ entry.isError ? ' is-error' : '' }` }>
            <div className="agent-msg-text">{ entry.text }</div>
            { entry.role === 'agent' && Array.isArray( entry.actions ) && entry.actions.length > 0 && (
              <ul className="agent-msg-actions">
                { entry.actions.map( ( action, j ) => (
                  <li
                    key       = { j }
                    className = { `agent-action${ action.outcome?.ok ? '' : ' is-failed' }` }
                    title     = { JSON.stringify( action.input ?? {} ) }
                  >
                    <span className="agent-action-glyph" aria-hidden="true">{ action.outcome?.ok ? '→' : '⚠' }</span>
                    { action.intentId }
                  </li>
                ) ) }
              </ul>
            ) }
          </div>
        ) ) }

        { isBusy && (
          <div className="agent-msg agent-msg-agent is-thinking" aria-label="Agent is thinking">
            <span className="agent-thinking-dot" />
            <span className="agent-thinking-dot" />
            <span className="agent-thinking-dot" />
          </div>
        ) }

      </div>

      <div className="agent-console-composer">
        <textarea
          className   = "agent-console-input"
          value       = { input }
          onChange    = { ( e ) => _.setSignal( 'agentInput', e.target.value ) }
          onKeyDown   = { onKeyDown }
          placeholder = "Show me… · take me to… · open…"
          rows        = { 2 }
        />
        <button
          className = "agent-console-send"
          onClick   = { () => send() }
          disabled  = { isBusy || ! ( input || '' ).trim() }
        >{ isBusy ? '…' : 'Send' }</button>
      </div>

    </section>
  );
}
