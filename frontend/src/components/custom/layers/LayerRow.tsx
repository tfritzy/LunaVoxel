// Similar to a photoshop layer row, this component represents a single layer in the UI.
// It has a name, can be toggled visibility, reordered, deleted, and locked.
export function LayerRow({ index }: { index: number }) {
  return (
    <div className="layer-row">
      <span>{layer.name}</span>
      <button onClick={handleToggleVisibility}>
        {layer.visible ? "Hide" : "Show"}
      </button>
      <button onClick={handleToggleLock}>
        {layer.locked ? "Unlock" : "Lock"}
      </button>
      <button onClick={handleDeleteLayer}>Delete</button>
    </div>
  );
}
