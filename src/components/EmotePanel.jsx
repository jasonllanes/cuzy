import { EMOTES } from '../game/emotes';

// The emote picker (Tab opens and closes it, Esc and the small X close it, and the keys 1 to 9, 0, - and = pick one)
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export default function EmotePanel({ onPick, onClose }) {
  return (
    <div className="emote-panel panel" role="dialog" aria-label="Emotes" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" className="emote-x" onClick={onClose} aria-label="Close emotes" title="Close (Tab)">✕</button>
      <b className="emote-title">Emotes <kbd>Tab</kbd></b>
      <div className="emote-grid">
        {EMOTES.map((m, i) => (
          <button key={m.name} type="button" className="emote-btn" onClick={() => onPick(i)} title={m.name}>
            <span>{m.e}</span>
            <small>{KEYS[i]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
