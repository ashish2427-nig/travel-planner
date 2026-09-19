// Date-only trips use a UTC calendar day, inclusive of both endpoints.
export function statusFor(trip, today = new Date().toISOString().slice(0, 10)) {
  return today < trip.startDate ? 'upcoming' : today > trip.endDate ? 'past' : 'ongoing';
}
export function tripJSON(trip) { const value = trip.toObject ? trip.toObject() : trip; return { ...value, status: statusFor(value) }; }
