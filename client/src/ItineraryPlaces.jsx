import React, { useState } from 'react';
import { api } from './api.js';

export default function ItineraryPlaces({ tripId, places = [], onChange }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  async function remove(place) {
    setBusy(true);
    setError('');
    try {
      await api(`/trips/${tripId}/places/${place._id}`, { method: 'DELETE' });
      onChange(places.filter(p => p._id !== place._id));
      setDeleting(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(place) {
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/trips/${tripId}/places/${place._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: !place.done }),
      });
      onChange(places.map(p => (p._id === updated._id ? updated : p)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const place = await api(`/trips/${tripId}/places`, {
        method: 'POST',
        body: JSON.stringify({ name, note }),
      });
      onChange([...places, place]);
      setName('');
      setNote('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const doneCount = places.filter(p => p.done).length;

  return (
    <div className="itinerary-layout">
      <section className="panel">
        <div className="eyebrow">YOUR ITINERARY</div>
        <h2 className="detail-title">
          Places to visit <span className="count">{places.length}</span>
        </h2>
        <p className="muted" role="status">
          {doneCount} of {places.length} explored
        </p>
        <progress
          aria-label="Places explored"
          max={places.length || 1}
          value={doneCount}
        />
        {places.length === 0 ? (
          <p className="muted">No places yet. Add your first must-see spot or explore recommendations below.</p>
        ) : (
          <ul className="places">
            {places.map((p) => (
              <li key={p._id} className={p.done ? 'done' : ''}>
                <input
                  className="place-check"
                  type="checkbox"
                  aria-label={`Mark ${p.name} as ${p.done ? 'not done' : 'done'}`}
                  checked={p.done}
                  disabled={busy}
                  onChange={() => toggle(p)}
                />
                <div>
                  <h3>{p.name}</h3>
                  {p.note && <p>{p.note}</p>}
                </div>
                {deleting === p._id ? (
                  <div className="delete-confirm">
                    <span>Remove this place?</span>
                    <button disabled={busy} className="danger" onClick={() => remove(p)}>
                      Remove place
                    </button>
                    <button disabled={busy} onClick={() => setDeleting(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setDeleting(p._id)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel add-place">
        <h2>Add a place</h2>
        <p className="muted">The landmarks, hidden gems, and everything in between.</p>
        <form onSubmit={add}>
          <label>
            Place name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="A spot worth stopping for"
            />
          </label>
          <label>
            Note <span className="optional">Optional</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="A tip, a reminder, a reason to go…"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Adding…' : '＋ Add place'}
          </button>
        </form>
      </section>
    </div>
  );
}
