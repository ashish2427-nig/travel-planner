export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'TravelTripPlanner', ...options.headers } });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => { throw new Error('The server is unavailable. Please try again.'); });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new Error(data.error || 'Request failed. Please try again.');
  }
  return data;
}
