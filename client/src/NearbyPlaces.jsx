import React, { useEffect, useState } from 'react';
import { api } from './api.js';

// Cache fetched nearby places per destination/coords so we fetch once and reuse across renders
const placesMemoryCache = new Map();

function formatDistance(meters) {
  if (!meters && meters !== 0) return '';
  if (meters < 1000) return `${meters} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export default function NearbyPlaces({ destination, coordinates, onAddPlace, places = [] }) {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    let active = true;
    const cacheKey = coordinates ? `${coordinates.lat.toFixed(3)},${coordinates.lon.toFixed(3)}` : (destination || '').trim().toLowerCase();

    if (!cacheKey) {
      setLoading(false);
      return;
    }

    if (placesMemoryCache.has(cacheKey)) {
      setNearby(placesMemoryCache.get(cacheKey));
      setLoading(false);
      return;
    }

    async function fetchNearby() {
      setLoading(true);
      setError('');

      try {
        let lat = coordinates?.lat;
        let lon = coordinates?.lon;

        // If coordinates not provided directly, geocode the destination name
        if (lat === undefined || lon === undefined) {
          const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=jsonv2&limit=1`;
          const geoRes = await fetch(geoUrl, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'TravelTripPlanner/1.0' },
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData[0]) {
              lat = Number(geoData[0].lat);
              lon = Number(geoData[0].lon);
            }
          }
        }

        if (lat !== undefined && lon !== undefined) {
          const data = await api(`/places/nearby?lat=${lat}&lon=${lon}&radius=6000`);
          if (active) {
            const resultList = Array.isArray(data) ? data : [];
            placesMemoryCache.set(cacheKey, resultList);
            setNearby(resultList);
          }
        } else {
          if (active) setNearby([]);
        }
      } catch (err) {
        if (active) {
          // Gracefully show fallback error message without breaking the page
          setError('Nearby places are temporarily unavailable. Check back later.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchNearby();
    return () => { active = false; };
  }, [destination, coordinates?.lat, coordinates?.lon]);

  async function handleAdd(item) {
    if (!onAddPlace) return;
    setAdding(item.xid);
    try {
      await onAddPlace({
        name: item.name,
        note: `${item.kind} · ${formatDistance(item.distance)} from center`.trim(),
      });
    } catch {
      // Handled by parent
    } finally {
      setAdding(null);
    }
  }

  return (
    <section className="nearby-places-section panel">
      <div className="nearby-header">
        <div>
          <div className="eyebrow">DISCOVER AROUND YOUR DESTINATION</div>
          <h2 className="detail-title">Nearby to Explore {destination ? `in ${destination}` : ''}</h2>
          <p className="muted">Top sights, culture, and attractions powered by Geoapify.</p>
        </div>
      </div>

      {loading && <p role="status" className="nearby-status">Finding nearby places to explore…</p>}

      {error && (
        <div className="nearby-fallback" role="alert">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && nearby.length === 0 && (
        <p className="muted">No nearby attractions found in this area.</p>
      )}

      {!loading && !error && nearby.length > 0 && (
        <div className="nearby-grid">
          {nearby.map((place) => {
            const alreadyInItinerary = places.some(
              (p) => p.name.toLowerCase().trim() === place.name.toLowerCase().trim()
            );

            return (
              <article className="nearby-card" key={place.xid}>
                <div className="nearby-card-top">
                  <span className="nearby-kind-badge">{place.kind}</span>
                  {place.distance > 0 && (
                    <span className="nearby-distance-tag">{formatDistance(place.distance)}</span>
                  )}
                </div>
                <h3 className="nearby-place-name">{place.name}</h3>
                {onAddPlace && (
                  <button
                    type="button"
                    className={`nearby-add-btn ${alreadyInItinerary ? 'added' : ''}`}
                    disabled={alreadyInItinerary || adding === place.xid}
                    onClick={() => handleAdd(place)}
                  >
                    {alreadyInItinerary
                      ? '✓ In itinerary'
                      : adding === place.xid
                      ? 'Adding…'
                      : '＋ Add to itinerary'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
