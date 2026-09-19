import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';
import TripForm from './TripForm.jsx';
import TripDetail from './TripDetail.jsx';
import Navbar from './Navbar.jsx';
import AuthPage from './AuthPage.jsx';
import Places from './Places.jsx';
import './style.css';

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function Hero() {
  return <div className="hero">
    <div>
      <div className="eyebrow">YOUR NEXT CHAPTER</div>
      <h1>Make room for<br/><em>somewhere new.</em></h1>
      <p className="intro">Bring your travel plans together, one adventure at a time.</p>
      <a className="button-link primary" href="#/plan">＋ Plan a trip</a>
    </div>
    <div className="postcard" aria-hidden="true">
      <div className="postmark">GO SOMEWHERE<br/>WONDERFUL ↗</div>
      <div className="sun"/><div className="mountain far"/><div className="mountain near"/>
      <div className="postcard-caption">The best stories start with a plan.</div>
    </div>
  </div>;
}

function TripList() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  async function load() {
    setError('');
    try { setTrips(await api('/trips')); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const interval = setInterval(load, 60000); return () => clearInterval(interval); }, []);
  const visible = trips.filter(t => filter === 'all' || t.status === filter);
  return <section className="trip-section">
    <div className="section-heading"><h2>Your trips <span className="count">{trips.length}</span></h2><span className="muted">Every adventure, in one place.</span></div>
    <div className="filters" aria-label="Filter trips">
      {['all','upcoming','ongoing','past'].map(s => <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{s === 'all' ? 'All trips' : s[0].toUpperCase()+s.slice(1)}</button>)}
    </div>
    {error && <div role="alert" className="error">{error} <button onClick={load}>Retry</button></div>}
    {loading ? <p role="status">Loading your trips…</p> : !error && <div className="trip-grid">
      {visible.map((trip, i) => <article className="trip-card" key={trip._id}>
        <div className={`card-art art-${i%3}`} aria-hidden="true"><span>↗</span><div className="art-circle"/><div className="art-hill"/></div>
        <div className="card-body">
          <span className={`badge ${trip.status}`}>{trip.status}</span>
          <h3><a href={`#/trips/${trip._id}`}>{trip.destination}</a></h3>
          <p className="muted">{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</p>
          <div className="card-bottom">{Math.round((new Date(trip.endDate)-new Date(trip.startDate))/86400000)+1} days to explore</div>
        </div>
      </article>)}
      {visible.length === 0 && <div className="empty panel"><span className="empty-icon">↗</span><h3>{filter === 'all' ? 'Your next adventure starts here.' : `No ${filter} trips yet.`}</h3><p className="muted">Pick a destination. Make it happen.</p><a className="button-link" href="#/plan">Plan a trip</a></div>}
    </div>}
  </section>;
}

function ExplorePage() {
  const [destination, setDestination] = useState('');
  const [searching, setSearching] = useState('');
  const popular = ['Jaipur', 'Bangalore', 'Mumbai', 'Delhi', 'Goa', 'Russia', 'UAE', 'Lebanon'];
  function handleSearch(e) {
    e.preventDefault();
    if (destination.trim()) setSearching(destination.trim());
  }
  return <>
    <div className="eyebrow">DISCOVER YOUR NEXT DESTINATION</div>
    <h1>Explore <em>everywhere.</em></h1>
    <p className="intro">Search any destination to find the best places, activities, and prices — all in one place.</p>
    <form className="explore-search" onSubmit={handleSearch}>
      <input className="explore-input" aria-label="Destination to explore" maxLength={120} type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Where do you want to go? e.g. Jaipur, Goa, Bangalore, Russia…" />
      <button className="primary" type="submit">Search ↗</button>
    </form>
    <div className="explore-popular">
      <span className="muted">Popular:</span>
      {popular.map(d => <button key={d} className="popular-tag" onClick={() => { setDestination(d); setSearching(d); }}>{d}</button>)}
    </div>
    {searching && (
      <Places destination={searching} onAddPlace={null} />
    )}
  </>;
}

function App() {
  const [route, setRoute] = useState(location.hash.slice(1));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [returnTo, setReturnTo] = useState('/my-trips');

  useEffect(() => {
    const changed = () => { setRoute(location.hash.slice(1)); window.scrollTo(0, 0); };
    const expired = () => { setUser(null); setSessionError('Your session has ended. Please sign in again.'); location.hash = '/sign-in'; };
    window.addEventListener('hashchange', changed);
    window.addEventListener('session-expired', expired);
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('session-expired', expired); };
  }, []);

  async function checkSession() {
    setChecking(true); setSessionError('');
    try { const result = await api('/auth/me'); setUser(result.user); }
    catch (e) { setSessionError(e.message); }
    finally { setChecking(false); }
  }

  useEffect(() => { checkSession(); }, []);

  useEffect(() => {
    if (!checking && !user && route !== '/sign-in' && route !== '/sign-up') {
      if (route && route !== '') setReturnTo(route);
      location.hash = '/sign-in';
    }
  }, [checking, user, route]);

  async function authenticate(mode, values) {
    let result;
    if (values?.provider === 'google') {
      result = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: values.credential }) });
    } else {
      result = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) });
    }
    setUser(result.user); setSessionError('');
    location.hash = returnTo || '/my-trips';
  }

  async function signOut() {
    setSigningOut(true); setSessionError('');
    try {
      await api('/auth/sign-out', { method: 'POST' });
      setUser(null);
      setReturnTo('/my-trips');
      location.hash = '/sign-in';
    } catch (e) {
      setSessionError(e.message);
    } finally {
      setSigningOut(false);
    }
  }

  let content;
  if (checking) {
    content = <p role="status">Getting things ready…</p>;
  } else if (!user) {
    if (route === '/sign-up') {
      content = <AuthPage key="sign-up" mode="sign-up" onSubmit={values => authenticate('sign-up', values)}/>;
    } else {
      content = <AuthPage key="sign-in" mode="sign-in" onSubmit={values => authenticate('sign-in', values)}/>;
    }
  } else if (route === '/sign-in' || route === '/sign-up') {
    content = <section className="panel account-ready"><h1>You’re signed in.</h1><p>Welcome, {user.name}.</p><a className="button-link primary" href="#/my-trips">Go to my trips →</a></section>;
  } else if (route.startsWith('/trips/')) {
    content = <TripDetail key={`${user._id}:${route}`} id={route.split('/')[2]}/>;
  } else if (route === '/plan') {
    content = <><a className="back-link" href="#/my-trips">← My trips</a><div className="eyebrow">LET’S MAKE IT HAPPEN</div><h1>Where to <em>next?</em></h1><p className="intro">Start with a destination. Fill in the memories later.</p><section className="panel form-panel"><h2>Plan a new trip</h2><TripForm onCancel={() => { location.hash = '/my-trips'; }} onSave={async values => { const trip = await api('/trips', {method:'POST',body:JSON.stringify(values)}); location.hash = `/trips/${trip._id}`; }}/></section></>;
  } else if (route === '/my-trips') {
    content = <><div className="eyebrow">YOUR PERSONAL TRAVEL JOURNAL</div><h1>Every plan.<br/><em>All yours.</em></h1><p className="intro">Welcome, {user.name}. Where will your curiosity take you next?</p><a className="button-link primary" href="#/plan">＋ Plan a trip</a><TripList key={user._id}/></>;
  } else if (route === '/explore') {
    content = <ExplorePage/>;
  } else if (!route) {
    content = <><Hero/><TripList key={user._id}/></>;
  } else {
    content = <section className="panel"><h1>A little off course.</h1><p>We couldn’t find that page.</p><a href="#/my-trips">Back to my trips</a></section>;
  }

  return <>
    <Navbar route={route} user={user} onSignOut={signOut} signingOut={signingOut}/>
    <main>{sessionError && <div className="error" role="alert">{sessionError} <button onClick={checkSession}>Check connection</button></div>}{content}</main>
    <footer>TRAVEL TRIP PLANNER <span>Less organizing. More exploring.</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
