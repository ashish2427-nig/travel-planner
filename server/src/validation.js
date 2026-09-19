export function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
export function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'A JSON object is required.');
}
export function text(value, label, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) fail(400, `${label} must be ${optional ? 'at most' : 'between 1 and'} ${max} characters.`);
  return value.trim();
}
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
export function tripInput(body) {
  objectBody(body);
  const destination = text(body.destination, 'Destination', 120);
  if (!date(body.startDate) || !date(body.endDate)) fail(400, 'Use real dates in YYYY-MM-DD format.');
  if (body.endDate < body.startDate) fail(400, 'End date must be on or after start date.');
  const result = { destination, startDate: body.startDate, endDate: body.endDate };
  const validCurrencies = ['INR','USD','EUR','GBP','AUD','CAD','SGD','AED','JPY'];
  if (body.currency && validCurrencies.includes(body.currency)) {
    result.currency = body.currency;
  }
  if (body.budget !== undefined && body.budget !== '' && body.budget !== null) {
    const num = Number(body.budget);
    if (Number.isFinite(num) && num >= 0) {
      result.budgetMinor = (result.currency || body.currency) === 'JPY' ? Math.round(num) : Math.round(num * 100);
    }
  }
  return result;
}

