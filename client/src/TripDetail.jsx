import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import ItineraryPlaces from './ItineraryPlaces.jsx';
import Places from './Places.jsx';
import TripForm from './TripForm.jsx';
import ExpenseTracker from './ExpenseTracker.jsx';

function formatBudget(minor, currency = 'INR') {
  if (minor === null || minor === undefined) return 'Budget: Not set';
  const amount = currency === 'JPY' ? minor : minor / 100;
  return `Budget: ${new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount)}`;
}

export default function TripDetail({ id }) {
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('Itinerary');

  async function load() {
    try {
      setTrip(await api(`/trips/${id}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/trips/${id}`, { method: 'DELETE' });
      location.hash = '/my-trips';
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addSuggestion({ name, note }) {
    const place = await api(`/trips/${id}/places`, {
      method: 'POST',
      body: JSON.stringify({ name, note }),
    });
    setTrip((previous) => ({
      ...previous,
      places: [...(previous.places || []), place],
    }));
  }

  return (
    <>
      <a className="back-link" href="#/my-trips">← My trips</a>
      {error && (
        <p role="alert" className="error">
          {error} <button onClick={load}>Retry</button>
        </p>
      )}
      {!trip ? (
        !error && <p role="status">Loading trip…</p>
      ) : (
        <>
          <div className="detail-heading">
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span className={`badge ${trip.status}`}>{trip.status}</span>
                <span className="badge" style={{ background: '#eef4ea', color: '#2f523c' }}>
                  {formatBudget(trip.budgetMinor, trip.currency)}
                </span>
              </div>
              <h1>{trip.destination}</h1>
              <p className="muted">
                {trip.startDate} → {trip.endDate} ·{' '}
                {Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1} days
              </p>
            </div>
            <div className="actions">
              <button onClick={() => { setEditing(true); setDeleting(false); }}>
                Edit trip & Budget
              </button>
              <button className="danger" onClick={() => { setDeleting(true); setEditing(false); }}>
                Delete trip
              </button>
            </div>
          </div>

          {editing && (
            <section className="panel form-panel">
              <h2>Edit trip & Budget options</h2>
              <TripForm
                initial={trip}
                onCancel={() => setEditing(false)}
                onSave={async (values) => {
                  const updated = await api(`/trips/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(values),
                  });
                  setTrip((previous) => ({ ...previous, ...updated }));
                  setEditing(false);
                }}
              />
            </section>
          )}

          {deleting && (
            <section className="panel delete-trip">
              <h2>Delete this trip?</h2>
              <p>
                This removes {trip.destination}, all its places, and all expenses. This cannot be undone.
              </p>
              <div className="actions">
                <button className="danger" disabled={busy} onClick={remove}>
                  {busy ? 'Deleting…' : 'Confirm delete trip'}
                </button>
                <button disabled={busy} onClick={() => setDeleting(false)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          <nav className="trip-sections" aria-label="Trip sections">
            {[
              { id: 'Itinerary', label: 'Itinerary' },
              { id: 'Discover', label: 'Discover places' },
              { id: 'Budget', label: 'Budget & Expenses' },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-pressed={section === tab.id}
                onClick={() => setSection(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {section === 'Itinerary' && (
            <ItineraryPlaces
              tripId={id}
              places={trip.places || []}
              onChange={(places) => setTrip((previous) => ({ ...previous, places }))}
            />
          )}

          {section === 'Discover' && (
            <Places
              key={trip.destination}
              destination={trip.destination}
              places={trip.places || []}
              onAddPlace={addSuggestion}
            />
          )}

          {section === 'Budget' && <ExpenseTracker tripId={id} />}
        </>
      )}
    </>
  );
}



