import React, { useState } from 'react';
import { destinationsData, getCityData } from './data/destinationsData.js';

export default function Places({ destination = 'jaipur', onAddPlace, places = [] }) {
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');

  const normalizedCity = (destination || 'jaipur').trim().toLowerCase();
  const cityData = destinationsData[normalizedCity] || getCityData(destination) || destinationsData['jaipur'];

  const allPlaces = cityData?.places || [];
  const categories = [...new Set(allPlaces.map((p) => p.category).filter(Boolean))];
  const items = allPlaces.filter((p) => filter === 'all' || p.category === filter);

  async function handleAdd(item) {
    if (!onAddPlace) return;
    setBusy(item.id || item.name);
    setMessage('');
    try {
      const noteText = [
        item.tryThis ? `Tip: ${item.tryThis}` : '',
        item.price ? `Admission: ${item.price} (${item.priceNote || ''})` : '',
        item.sourceUrl ? `Source: ${item.sourceUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await onAddPlace({
        name: item.name,
        note: noteText.slice(0, 1000),
      });
      setMessage(`${item.name} added to your itinerary.`);
    } catch (e) {
      setMessage(`Could not add ${item.name}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  const videoId = cityData.videoId || 'AY1mIe_w2nM';
  const videoTitle = cityData.title || `${cityData.name || destination} Travel Guide`;
  const channelName = cityData.channel || 'Dr. Bro';

  return (
    <section className="suggestions-section">
      <div className="eyebrow">MAKE A LITTLE ROOM FOR DISCOVERY</div>
      <h2 className="detail-title">Places around {cityData.name || destination}</h2>
      <p className="muted">
        Discover curated sights, activities, and local guides, then save your favourites to your itinerary.
      </p>

      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      <p className="suggestion-note">
        {cityData.message || 'A short list for city views, history, and walking.'} Prices are published reference prices, not live quotes. Check opening times and admission before visiting. Prices stay in the source currency and are not added to expenses automatically.
      </p>

      {categories.length > 0 && (
        <div className="filters" aria-label="Place categories">
          {['all', ...categories].map((category) => (
            <button
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category === 'all' ? 'All places' : category}
            </button>
          ))}
        </div>
      )}

      <div className="suggestions-grid">
        {items.map((place) => {
          const isSaved = places.some(
            (p) => p.name && p.name.toLowerCase() === place.name.toLowerCase()
          );
          const mapLink =
            place.mapUrl ||
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              place.name + ' ' + (cityData.name || destination)
            )}`;

          return (
            <article className="suggestion-card" key={place.id || place.name}>
              {place.imageUrl && (
                <div className="suggestion-image-wrap">
                  <img
                    className="suggestion-image"
                    src={place.imageUrl}
                    alt={place.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.parentElement.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <span className="suggestion-category">{place.category}</span>
              <h3 className="suggestion-name">{place.name}</h3>
              <p className="suggestion-desc">{place.description}</p>

              {place.tryThis && (
                <p className="activity-idea">
                  <strong>Try this</strong>
                  <br />
                  {place.tryThis}
                </p>
              )}

              <div className="price-block">
                <strong>{place.price}</strong>
                <p className="muted">{place.priceNote}</p>
              </div>

              <div className="suggestion-links">
                {place.sourceUrl && (
                  <a
                    href={place.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source & details ↗
                  </a>
                )}
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View map ↗
                </a>
              </div>

              {onAddPlace && (
                <button
                  className={`add-suggestion-btn ${isSaved ? 'added' : ''}`}
                  disabled={busy === (place.id || place.name) || isSaved}
                  onClick={() => handleAdd(place)}
                >
                  {isSaved
                    ? '✓ In your itinerary'
                    : busy === (place.id || place.name)
                    ? 'Adding…'
                    : '＋ Add to itinerary'}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="panel empty">
          <h3>No places found in this category.</h3>
          <p className="muted">Try selecting "All places".</p>
        </div>
      )}

      {/* One Featured Video Card per Destination (Dr. Bro / Curated Travel Vlog) */}
      <div className="destination-video-section" id="destination-video-card">
        <div className="video-header">
          <div className="eyebrow">YOUTUBE TRAVEL GUIDE · {cityData.name || destination}</div>
          <h3>{videoTitle}</h3>
          <p className="muted">
            Explore authentic street views, culture, and travel stories with {channelName}.
          </p>
        </div>

        <div
          className="video-preview-card"
          style={{
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            background: '#000',
            marginTop: '16px',
          }}
        >
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt={videoTitle}
            style={{
              width: '100%',
              height: '380px',
              objectFit: 'cover',
              opacity: 0.85,
              display: 'block',
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '24px',
            }}
          >
            <span
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '6px',
                width: 'fit-content',
                marginBottom: '8px',
                backdropFilter: 'blur(4px)',
              }}
            >
              {channelName}
            </span>
            <h3
              style={{
                color: '#fff',
                fontSize: '1.4rem',
                margin: '0 0 8px 0',
                fontWeight: 600,
              }}
            >
              {videoTitle}
            </h3>
            <p
              style={{
                color: 'rgba(255,255,255,0.8)',
                margin: '0 0 16px 0',
                fontSize: '0.95rem',
              }}
            >
              Watch authentic street views, architecture, and vlogs by travelers.
            </p>

            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#e50914',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                width: 'fit-content',
              }}
            >
              ▶ Watch on YouTube ↗
            </a>
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: '24px' }}>
        Curated from official tourism boards and verified venue sources.
      </p>
    </section>
  );
}
