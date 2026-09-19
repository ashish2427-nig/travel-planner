import { Router } from 'express';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import User from './models/User.js';
import Session from './models/Session.js';
import { fail, objectBody, text } from './validation.js';

const derive = promisify(scrypt);
const cookieName = 'trip_session';
const lifetime = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
const digest = token => createHash('sha256').update(token).digest('hex');
const publicUser = user => ({
  _id: user.id,
  name: user.name,
  email: user.email || '',
  avatar: user.avatar || '',
  authProvider: user.authProvider || 'email',
});
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function tokenFrom(req) {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function authenticate(req, res, next) {
  const token = tokenFrom(req);
  if (token) {
    const session = await Session.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } }).populate('user');
    if (session?.user) { req.user = session.user; req.session = session; }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to access your trips.' });
  next();
}

// Custom headers cannot be sent by cross-site forms. No cross-origin access is
// enabled; explicitly configured origins cover Vite and same-origin production.
export function protectWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'TravelTripPlanner') return res.status(403).json({ error: 'Invalid request source.' });
  const origin = req.get('Origin');
  const defaults = ['http://127.0.0.1:3001', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://localhost:5173'];
  const allowed = process.env.APP_ORIGINS ? process.env.APP_ORIGINS.split(',').map(s => s.trim()) : process.env.NODE_ENV === 'production' ? [] : defaults;
  if (origin && !allowed.includes(origin)) return res.status(403).json({ error: 'Invalid request origin.' });
  next();
}

function credentials(body) {
  objectBody(body);
  const email = text(body.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) fail(400, 'Password must be between 1 and 128 characters.');
  return { email, password: body.password };
}

function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function makeHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, scryptOptions);
  return `${salt}:${key.toString('hex')}`;
}

async function matches(password, hash) {
  // Always perform the same expensive derivation, including unknown emails.
  const [salt, expected] = (hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const actual = await derive(password, salt, 64, scryptOptions);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && !!hash;
}

async function startSession(req, res, user) {
  const token = randomBytes(32).toString('hex');
  await Session.create({ tokenHash: digest(token), user: user.id, expiresAt: new Date(Date.now() + lifetime) });
  const previous = tokenFrom(req);
  if (previous) await Session.deleteOne({ tokenHash: digest(previous) });
  res.cookie(cookieName, token, { ...cookieOptions(), maxAge: lifetime });
}

// Bounded, single-process throttle. Use a shared limiter for multi-instance hosting.
const attempts = new Map();
function limitAuth(req, res, next) {
  const now = Date.now();
  for (const [key, record] of attempts) if (record.until <= now) attempts.delete(key);
  const key = req.ip;
  if (!attempts.has(key) && attempts.size >= 10000) return res.status(429).json({ error: 'Please try again later.' });
  const record = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  record.count += 1;
  attempts.set(key, record);
  if (record.count > 30) {
    res.set('Retry-After', String(Math.ceil((record.until - now) / 1000)));
    return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  }
  next();
}

export const authRouter = Router();
authRouter.get('/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

authRouter.post('/sign-up', limitAuth, async (req, res) => {
  const { email, password } = credentials(req.body);
  const name = text(req.body.name, 'Name', 120);
  if (password.length < 12) fail(400, 'Use a password with at least 12 characters.');
  const passwordHash = await makeHash(password);
  let user;
  try { user = await User.create({ name, email, passwordHash, authProvider: 'email' }); }
  catch (error) { if (error.code === 11000) fail(409, 'An account with this email already exists. Please sign in.'); throw error; }
  await startSession(req, res, user);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/sign-in', limitAuth, async (req, res) => {
  const { email, password } = credentials(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!await matches(password, user?.passwordHash)) fail(401, 'Email or password is incorrect.');
  await startSession(req, res, user);
  res.json({ user: publicUser(user) });
});

// Google Sign-In endpoint
authRouter.post('/google', limitAuth, async (req, res) => {
  objectBody(req.body);
  const credential = req.body.credential;
  if (!credential || typeof credential !== 'string') fail(400, 'Google authentication token is missing.');

  let payload = parseJwt(credential);

  // If token has a standard Google payload
  if (!payload || (!payload.sub && !payload.email)) {
    // Attempt verification via Google tokeninfo if needed
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (response.ok) {
        payload = await response.json();
      }
    } catch {
      // Fallback
    }
  }

  if (!payload || (!payload.sub && !payload.email)) {
    fail(400, 'Could not verify Google authentication. Please try again.');
  }

  const googleId = payload.sub || '';
  const email = (payload.email || '').toLowerCase();
  const name = payload.name || payload.given_name || (email ? email.split('@')[0] : 'Google Explorer');
  const avatar = payload.picture || '';

  let user = null;
  if (googleId) {
    user = await User.findOne({ googleId });
  }
  if (!user && email) {
    user = await User.findOne({ email });
    if (user) {
      if (googleId && !user.googleId) user.googleId = googleId;
      if (avatar && !user.avatar) user.avatar = avatar;
      await user.save();
    }
  }

  if (!user) {
    user = await User.create({
      name,
      ...(email ? { email } : {}),
      ...(googleId ? { googleId } : {}),
      avatar,
      authProvider: 'google',
    });
  }

  await startSession(req, res, user);
  res.json({ user: publicUser(user) });
});

authRouter.post('/sign-out', async (req, res) => {
  const token = tokenFrom(req);
  if (token) await Session.deleteOne({ tokenHash: digest(token) });
  res.clearCookie(cookieName, cookieOptions());
  res.sendStatus(204);
});


