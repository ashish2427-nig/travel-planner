// Get the backend URL from environment variables, fallback to local if not set
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function api(path, options = {}) {
  let response;
  try {
    // Combine the base URL with your route path
    response = await fetch(`${BASE_URL}/api${path}`, { 
      ...options, 
      headers: { 
        'Content-Type': 'application/json', 
        'X-Requested-With': 'TravelTripPlanner', 
        ...options.headers 
      } 
    });
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
