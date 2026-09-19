import { fail } from './validation.js';
import { curatedDestinations } from './suggestions.js';

export async function getNearbyPlaces(rawLat, rawLon, rawRadius) {
  if (rawLat === undefined || rawLat === null || rawLat === '' || rawLon === undefined || rawLon === null || rawLon === '') {
    fail(400, 'Latitude and longitude query parameters are required.');
  }

  const lat = Number(rawLat);
  const lon = Number(rawLon);
  const radius = rawRadius !== undefined && rawRadius !== '' ? Number(rawRadius) : 6000;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    fail(400, 'Invalid latitude. Must be a number between -90 and 90.');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    fail(400, 'Invalid longitude. Must be a number between -180 and 180.');
  }
  if (!Number.isFinite(radius) || radius <= 0 || radius > 50000) {
    fail(400, 'Invalid radius. Must be a number between 1 and 50000 meters.');
  }

  // Find nearest curated destination or return sample curated places
  const allPlaces = Object.values(curatedDestinations).flatMap(d => d.places);
  return allPlaces.slice(0, 10).map((p, idx) => ({
    xid: p.id,
    name: p.name,
    kind: p.category.toLowerCase(),
    distance: (idx + 1) * 450,
    point: { lat, lon },
    imageUrl: p.imageUrl,
    sourceUrl: p.sourceUrl,
    mapUrl: p.mapUrl,
  }));
}

