import AccessForm from './AccessForm';

// Shown instead of a locked page (the training rooms) until the right code is typed.
export default function AccessGate({ title, onUnlocked, onCancel }) {
  return (
    <div className="menu">
      <div className="panel menu-card home-card">
        <h2 className="page-title">🔒 {title}</h2>
        <p className="hint">This area is locked. Type the access code to go in.</p>
        <AccessForm onUnlocked={onUnlocked} />
        <div className="nav-row"><button type="button" className="btn ghost" onClick={onCancel}>← Main menu</button><span /></div>
      </div>
    </div>
  );
}
