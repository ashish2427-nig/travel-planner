import React, { useEffect, useRef, useState } from 'react';

export default function AuthPage({ mode, onSubmit }) {
  const signingUp = mode === 'sign-up';
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const googleBtnRef = useRef(null);

  // Initialize Google Identity Services if available
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (window.google?.accounts?.id && clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (response?.credential) {
            setBusy(true);
            setError('');
            try {
              await onSubmit({ provider: 'google', credential: response.credential });
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }
        },
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: signingUp ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
        });
      }
    }
  }, [signingUp]);

  // Handle Google Login fallback / direct trigger
  async function handleGoogleClick() {
    setError('');
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (window.google?.accounts?.id && clientId) {
      window.google.accounts.id.prompt();
      return;
    }

    // Interactive simulated demo token for dev/preview when no live Google client ID is configured
    const userEmail = prompt('Enter Google Account email address for testing:', 'explorer.travel@gmail.com');
    if (!userEmail) return;
    const userName = prompt('Enter your name:', 'Google Explorer') || 'Google Explorer';

    // Construct mock JWT payload for verification
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: 'google_user_' + Math.abs(userEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
      email: userEmail.trim().toLowerCase(),
      name: userName.trim(),
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    }));
    const mockToken = `${header}.${payload}.mock_signature`;

    setBusy(true);
    try {
      await onSubmit({ provider: 'google', credential: mockToken });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Handle Email Form submit
  async function handleEmailSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    if (signingUp && values.password !== values.confirmPassword) {
      setError('Your passwords don’t match. Please try again.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ provider: 'email', ...values });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="auth-layout">
    <div className="auth-story">
      <div className="eyebrow">GOOD THINGS ARE A JOURNEY AWAY</div>
      <h1>{signingUp ? <>A world of plans.<br/><em>Start yours.</em></> : <>Welcome back,<br/><em>explorer.</em></>}</h1>
      <p className="intro">{signingUp ? 'From the first idea to the last hidden gem, give every adventure a place to begin.' : 'Your next chapter is waiting. Pick up your plans and keep the adventure going.'}</p>
      <div className="postcard auth-postcard" aria-hidden="true">
        <div className="postmark">COLLECT MOMENTS<br/>MAKE MEMORIES ↗</div>
        <div className="sun"/><div className="mountain far"/><div className="mountain near"/>
        <div className="postcard-caption">A little planning. Endless possibilities.</div>
      </div>
    </div>

    <div className="panel auth-card">
      <span className="auth-symbol" aria-hidden="true">↗</span>
      <h2>{signingUp ? 'Create your account' : 'Sign in to your account'}</h2>
      <p className="muted">{signingUp ? 'Your next adventure starts right here.' : 'Make yourself at home. Then head somewhere new.'}</p>

      {/* Google Sign-In Action */}
      <div className="google-auth-container">
        <div ref={googleBtnRef} style={{ display: 'none' }} />
        <button
          type="button"
          className="google-signin-btn"
          onClick={handleGoogleClick}
          disabled={busy}
          aria-label="Continue with Google"
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>

      <div className="auth-divider">
        <span>or sign in with email</span>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {/* EMAIL AUTH FORM */}
      <form onSubmit={handleEmailSubmit} className="auth-form">
        {signingUp && (
          <label>
            Full name
            <input name="name" autoComplete="name" placeholder="Your name" required maxLength={120} />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
        </label>
        <label htmlFor="account-password">Password</label>
        <div className="password-field">
          <input
            id="account-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            required
            minLength={signingUp ? 12 : undefined}
            maxLength={128}
            aria-describedby={signingUp ? 'password-hint' : undefined}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {signingUp && (
          <>
            <p id="password-hint" className="password-hint">Use at least 12 characters.</p>
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                maxLength={128}
              />
            </label>
          </>
        )}
        <button className="primary auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="auth-switch">
        {signingUp ? 'Already have an account?' : 'New around here?'}{' '}
        <a href={signingUp ? '#/sign-in' : '#/sign-up'}>
          {signingUp ? 'Sign in' : 'Create an account'}
        </a>
      </p>
    </div>
  </section>;
}


