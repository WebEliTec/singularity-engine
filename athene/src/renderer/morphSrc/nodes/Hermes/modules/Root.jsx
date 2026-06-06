// Layout shell for a Hermes instance — left rail (ResourceList) +
// right pane (ContentBody). No brand header here; the wrapping Root
// node owns app-level chrome.

export default function Root( { Module } ) {
  return (
    <div id="hermes">
      <div className="hermes-grid">
        <Module id="ResourceList" />
        <Module id="ContentBody" />
      </div>
    </div>
  );
}
