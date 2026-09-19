import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Trip from './models/Trip.js';
import Place from './models/Place.js';
import { tripJSON } from './status.js';
import { tripInput, fail, objectBody, text } from './validation.js';
import { authenticate, requireUser, protectWrites, authRouter } from './auth.js';
import { getSuggestions } from './suggestions.js';
import { registerExpenses } from './expenses.js';
import { getNearbyPlaces } from './nearby.js';
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, protectWrites, authenticate);
app.use('/api/auth', authRouter);
app.get('/api/suggestions', requireUser, async (req, res, next) => {
  try {
    const destination = text(req.query.destination, 'Destination', 120);
    const result = await getSuggestions(destination);
    res.json(result);
  } catch (error) {
    console.error('Suggestions error details:', error);
    if (error.status === 400) return next(error);
    res.status(error.status || 500).json({
      error: error.publicMessage || error.message || 'Suggestions service encountered an error.',
      details: error.message || String(error)
    });
  }
});
app.get('/api/places/nearby', requireUser, async (req, res, next) => {
  try {
    const places = await getNearbyPlaces(req.query.lat, req.query.lon, req.query.radius);
    res.json(places);
  } catch (err) {
    next(err);
  }
});
app.use('/api/trips', requireUser);
app.param('tripId', async (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return next(Object.assign(new Error('Invalid trip ID.'), {status:400}));
  try { req.trip = await Trip.findOne({ _id: id, owner: req.user.id }); if (!req.trip) fail(404, 'Trip not found.'); next(); } catch(e) { next(e); }
});
app.post('/api/trips', async (req, res) => {
  const trip = await Trip.create({ ...tripInput(req.body), owner: req.user.id });
  res.status(201).location(`/api/trips/${trip.id}`).json(tripJSON(trip));
});
app.get('/api/trips', async (req, res) => {
  res.json((await Trip.find({ owner: req.user.id }).sort({ startDate: 1, _id: 1 })).map(tripJSON));
});
app.get('/api/trips/:tripId', async (req, res) => res.json({ ...tripJSON(req.trip), places: await Place.find({ trip: req.trip.id }).sort({ createdAt: 1, _id: 1 }) }));
app.patch('/api/trips/:tripId', async (req, res) => {
  const input = tripInput(req.body);
  Object.assign(req.trip, input);
  await req.trip.save();
  res.json(tripJSON(req.trip));
});
app.post('/api/trips/:tripId/places', async (req, res) => {
  objectBody(req.body);
  const place = await Place.create({ trip: req.trip.id, name: text(req.body.name, 'Place name', 120), note: text(req.body.note, 'Note', 1000, true) });
  res.status(201).json(place);
});
app.param('placeId', (req, res, next, id) => {
  next(mongoose.isObjectIdOrHexString(id) ? undefined : Object.assign(new Error('Invalid place ID.'), {status:400}));
});
app.patch('/api/trips/:tripId/places/:placeId', async (req, res) => {
  objectBody(req.body);
  if (typeof req.body.done !== 'boolean') fail(400, 'Done must be a boolean.');
  const place = await Place.findOneAndUpdate({ _id: req.params.placeId, trip: req.trip.id }, { $set: { done: req.body.done } }, { returnDocument: 'after', runValidators: true });
  if (!place) fail(404, 'Place not found in this trip.');
  res.json(place);
});
app.delete('/api/trips/:tripId/places/:placeId', async (req, res) => {
  const place = await Place.findOneAndDelete({ _id: req.params.placeId, trip: req.trip.id });
  if (!place) fail(404, 'Place not found in this trip.');
  res.sendStatus(204);
});
app.delete('/api/trips/:tripId', async (req, res) => {
  await Place.deleteMany({ trip: req.trip.id });
  await Trip.deleteOne({ _id: req.trip.id });
  res.sendStatus(204);
});
app.param('expenseId', (req,res,next,id)=>next(mongoose.isObjectIdOrHexString(id) ? undefined : Object.assign(new Error('Invalid expense ID.'),{status:400})));
registerExpenses(app);
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found.' }));
// After `npm run build`, Express serves React and the API on the same origin.
const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
app.use(express.static(clientDist));
app.get('/', (req, res, next) => res.sendFile(path.join(clientDist, 'index.html'), error => error && next(error)));
app.use((error, req, res, next) => {
  if (error.name === 'VersionError') return res.status(409).json({ error: 'This trip changed in another request. Reload and try again.' });
  const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? error.publicMessage || 'Something went wrong. Please try again.' : (error.type === 'entity.parse.failed' ? 'Invalid JSON.' : error.message) });
});
export default app;
