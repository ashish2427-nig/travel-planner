import React, { useEffect, useState } from 'react';

export default function Navbar({ route, user, onSignOut, signingOut }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [route]);
  return <header className="site-header">
    <a className="brand" href={user ? "#" : "#/sign-in"}><span className="brand-icon" aria-hidden="true">↗</span> Travel Trip Planner</a>
    {user ? (
      <>
        <button className="menu-toggle" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? 'Close menu' : 'Menu ☰'}</button>
        <nav id="main-navigation" aria-label="Main navigation" className={open ? 'navigation is-open' : 'navigation'}>
          <a href="#" aria-current={route === '' ? 'page' : undefined}>Home</a>
          <a href="#/explore" aria-current={route === '/explore' ? 'page' : undefined}>Explore</a>
          <a href="#/my-trips" aria-current={route === '/my-trips' || route.startsWith('/trips/') ? 'page' : undefined}>My trips</a>
          <a href="#/plan" aria-current={route === '/plan' ? 'page' : undefined}>Plan a trip</a>
          <div className="nav-account">
            <span className="nav-user" title={user.name}>Hi, {user.name}</span>
            <button onClick={onSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
        </nav>
      </>
    ) : (
      <nav id="main-navigation" aria-label="Authentication navigation" className="navigation" style={{ display: 'flex' }}>
        <div className="nav-account" style={{ borderLeft: 'none', paddingLeft: 0 }}>
          <a href="#/sign-in" aria-current={route === '/sign-in' || (!route && route !== '/sign-up') ? 'page' : undefined}>Sign in</a>
          <a className="nav-signup" href="#/sign-up" aria-current={route === '/sign-up' ? 'page' : undefined}>Sign up <span aria-hidden="true">↗</span></a>
        </div>
      </nav>
    )}
  </header>;
}

