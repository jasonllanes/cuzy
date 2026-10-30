import { useState } from 'react';
import { tryUnlock } from '../game/access';

// The access code box that guards the developer tools.
export default function AccessForm({ onUnlocked, label = 'Unlock' }) {
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (await tryUnlock(code)) {
      setBad(false);
      setCode('');
      onUnlocked();
    } else {
      setBad(true);
    }
  };
  return (
    <form className="access-form" onSubmit={submit}>
      <input type="password" value={code} autoComplete="off" placeholder="Access code" aria-label="Access code" onChange={(e) => { setCode(e.target.value); setBad(false); }} />
      <button type="submit" className="btn go small-btn" disabled={!code}>{label}</button>
      {bad && <span className="access-bad">That is not the code.</span>}
    </form>
  );
}
