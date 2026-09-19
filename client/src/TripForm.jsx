import React, { useState } from 'react';

const currencies = ['INR','USD','EUR','GBP','AUD','CAD','SGD','AED','JPY'];

export default function TripForm({ initial = {}, onSave, onCancel }) {
  const initialBudget = initial.budgetMinor !== undefined && initial.budgetMinor !== null
    ? (initial.currency === 'JPY' ? initial.budgetMinor : (initial.budgetMinor / 100).toFixed(2))
    : '';

  const [values, setValues] = useState({
    destination: initial.destination || '',
    startDate: initial.startDate || '',
    endDate: initial.endDate || '',
    currency: initial.currency || 'INR',
    budget: initialBudget,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (values.endDate < values.startDate) {
      return setError('End date must be on or after start date.');
    }
    setBusy(true);
    try {
      await onSave(values);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="trip-form">
    <label>
      Destination
      <input
        name="destination"
        value={values.destination}
        onChange={change}
        placeholder="Where are you headed? e.g. Paris, Tokyo, Goa…"
        required
        maxLength={120}
        autoFocus
      />
    </label>
    <div className="date-fields">
      <label>
        Start date
        <input
          type="date"
          name="startDate"
          value={values.startDate}
          onChange={change}
          required
        />
      </label>
      <label>
        End date
        <input
          type="date"
          name="endDate"
          value={values.endDate}
          min={values.startDate || undefined}
          onChange={change}
          required
        />
      </label>
    </div>
    <div className="date-fields">
      <label>
        Trip Currency
        <select
          name="currency"
          value={values.currency}
          onChange={change}
          disabled={busy || (initial.expenses && initial.expenses.length > 0)}
        >
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>
        Trip Budget (optional)
        <input
          type="number"
          name="budget"
          min="0"
          step={values.currency === 'JPY' ? '1' : '0.01'}
          max="999999999.99"
          value={values.budget}
          onChange={change}
          placeholder="e.g. 50000"
        />
      </label>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="actions">
      <button className="primary" disabled={busy}>
        {busy ? 'Saving…' : initial._id ? 'Save changes' : 'Create trip'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      )}
    </div>
  </form>;
}

