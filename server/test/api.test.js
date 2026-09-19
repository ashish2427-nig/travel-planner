import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Trip from '../src/models/Trip.js';
import Place from '../src/models/Place.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import { statusFor } from '../src/status.js';

let server, root, cookie;
const requestHeaders = { 'Content-Type': 'application/json', 'X-Requested-With': 'TravelTripPlanner' };
const database = `trip_planner_test_${process.pid}_${Date.now()}`;
before(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required for real MongoDB integration tests.');
  await mongoose.connect(process.env.MONGO_URI, { dbName: database, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Session.init()]);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  root = `http://127.0.0.1:${server.address().port}/api`;
  const signup = await request('POST', '/auth/sign-up', {name:'Test Explorer',email:'owner@example.test',password:'A test password 123!'}, '');
  assert.equal(signup.status, 201);
  cookie = signup.headers.get('set-cookie').split(';')[0];
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    // Only the unique database created by this test run is disposable.
    assert.equal(mongoose.connection.name, database);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});
async function request(method, route, body, sessionCookie = cookie) {
  const response = await fetch(root + route, { method, headers: { ...requestHeaders, ...(sessionCookie ? { Cookie: sessionCookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: response.status === 204 ? null : await response.json(), headers: response.headers };
}
const input = { destination: '  Kyoto  ', startDate: '2027-04-10', endDate: '2027-04-17' };

test('full trip lifecycle persists to MongoDB and cascades places', async () => {
  const created = await request('POST', '/trips', input);
  assert.equal(created.status, 201);
  assert.equal(created.body.destination, 'Kyoto');
  const id = created.body._id;
  assert.equal(created.headers.get('location'), `/api/trips/${id}`);
  assert.equal((await Trip.findById(id)).destination, 'Kyoto');
  const listed = await request('GET', '/trips');
  assert.equal(listed.status, 200);
  assert(listed.body.some(t => t._id === id && t.status === statusFor(t)));
  assert.deepEqual((await request('GET', `/trips/${id}`)).body.places, []);
  const place = await request('POST', `/trips/${id}/places`, { name: '  Temple  ', note: 'Go early' });
  assert.equal(place.status, 201);
  assert.equal(place.body.name, 'Temple');
  assert.equal(place.body.note, 'Go early');
  assert.equal(place.body.trip, id);
  assert.equal(place.body.done, false);
  const placePath = `/trips/${id}/places/${place.body._id}`;
  for (const done of [true, true, false]) {
    const result = await request('PATCH', placePath, { done });
    assert.equal(result.status, 200);
    assert.equal(result.body.done, done);
    assert.equal((await Place.findById(place.body._id)).done, done);
  }
  const edited = await request('PATCH', `/trips/${id}`, { destination: 'Osaka', startDate: '2020-01-01', endDate: '2020-01-05' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.status, 'past');
  const detail = await request('GET', `/trips/${id}`);
  assert.equal(detail.body.destination, 'Osaka');
  assert.equal(detail.body.places.length, 1);
  assert.equal((await request('DELETE', placePath)).status, 204);
  assert.equal((await request('DELETE', placePath)).status, 404);
  assert.equal(await Place.countDocuments({ trip: id }), 0);
  const optional = await request('POST', `/trips/${id}/places`, { name: 'Market' });
  assert.equal(optional.body.note, '');
  assert.equal((await request('DELETE', `/trips/${id}`)).status, 204);
  assert.equal((await request('GET', `/trips/${id}`)).status, 404);
  assert.equal(await Place.countDocuments({ trip: id }), 0);
});

test('validates bodies, real dates, bounds and IDs', async () => {
  for (const body of [null, [], {}, { ...input, destination: ' ' }, { ...input, destination: { $gt: '' } }, { ...input, destination: 'x'.repeat(121) }, { ...input, startDate: '2027-02-29' }, { ...input, startDate: '2027-02-30' }, { ...input, startDate: '2028-01-01' }, { ...input, startDate: '2027-4-10' }, { ...input, startDate: '0000-01-01' }]) {
    assert.equal((await request('POST', '/trips', body)).status, 400);
  }
  const leap = await request('POST', '/trips', { ...input, startDate: '2028-02-29', endDate: '2028-02-29' });
  assert.equal(leap.status, 201);
  const id = leap.body._id;
  assert.equal((await request('PATCH', `/trips/${id}`, { ...input, endDate: '2027-01-01' })).status, 400);
  for (const body of [{}, { name: ' ' }, { name: 'X', note: null }, { name: 'X', note: 'x'.repeat(1001) }]) {
    assert.equal((await request('POST', `/trips/${id}/places`, body)).status, 400);
  }
  assert.equal((await request('GET', '/trips/bad-id')).status, 400);
  assert.equal((await request('GET', '/trips/000000000000000000000000')).status, 404);
  assert.equal((await request('POST', '/trips/000000000000000000000000/places', { name: 'X' })).status, 404);
  assert.equal((await request('PATCH', `/trips/${id}/places/bad`, { done: true })).status, 400);
  assert.equal((await request('PATCH', `/trips/${id}/places/000000000000000000000000`, { done: 'true' })).status, 400);
  assert.equal((await request('PATCH', `/trips/${id}/places/000000000000000000000000`, { done: true })).status, 404);
  const malformed = await fetch(root + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'Invalid JSON.');
  assert.equal((await request('POST', '/trips', { ...input, destination: 'x'.repeat(20000) })).status, 413);
  assert.equal((await request('GET', '/missing')).status, 404);
});

test('cannot mutate a place through another trip', async () => {
  const a = (await request('POST', '/trips', input)).body;
  const b = (await request('POST', '/trips', input)).body;
  const p = (await request('POST', `/trips/${a._id}/places`, { name: 'Private to trip A' })).body;
  assert.equal((await request('PATCH', `/trips/${b._id}/places/${p._id}`, { done: true })).status, 404);
  assert.equal((await request('DELETE', `/trips/${b._id}/places/${p._id}`)).status, 404);
  assert.equal((await Place.findById(p._id)).done, false);
});

test('status boundaries include both dates and single-day trips', () => {
  const trip = { startDate: '2026-09-18', endDate: '2026-09-20' };
  for (const [day, expected] of [['2026-09-17','upcoming'], ['2026-09-18','ongoing'], ['2026-09-19','ongoing'], ['2026-09-20','ongoing'], ['2026-09-21','past']]) assert.equal(statusFor(trip, day), expected);
  assert.equal(statusFor({ startDate: '2026-09-18', endDate: '2026-09-18' }, '2026-09-18'), 'ongoing');
});


test('accounts, password verification, sessions, and private trip enforcement', async () => {
  assert.equal((await request('GET', '/trips', undefined, '')).status, 401);
  assert.equal((await request('GET', '/auth/me', undefined, '')).body.user, null);
  const account = (await request('GET', '/auth/me')).body.user;
  assert.equal(account.email, 'owner@example.test');
  assert.equal(account.passwordHash, undefined);
  const stored = await User.findById(account._id).select('+passwordHash');
  assert.notEqual(stored.passwordHash, 'A test password 123!');
  assert.match(stored.passwordHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  const duplicate = await request('POST', '/auth/sign-up', {name:'Duplicate',email:'OWNER@example.test',password:'A test password 123!'}, '');
  assert.equal(duplicate.status, 409);
  for (const body of [{name:'',email:'new@example.test',password:'A test password 123!'}, {name:'New',email:'bad',password:'A test password 123!'}, {name:'New',email:'new@example.test',password:'short'}]) assert.equal((await request('POST','/auth/sign-up',body,'')).status,400);
  for (const email of ['owner@example.test','missing@example.test']) {
    const wrong = await request('POST', '/auth/sign-in', {email,password:'Incorrect password!'}, '');
    assert.equal(wrong.status,401);
    assert.equal(wrong.body.error,'Email or password is incorrect.');
  }
  const other = await request('POST', '/auth/sign-up', {name:'Second Explorer',email:'second@example.test',password:'Another test password!'}, '');
  assert.equal(other.status,201);
  const otherCookie = other.headers.get('set-cookie').split(';')[0];
  assert.match(other.headers.get('set-cookie'), /HttpOnly/);
  assert.match(other.headers.get('set-cookie'), /SameSite=Strict/);
  const trip = (await request('POST','/trips',input)).body;
  const place = (await request('POST',`/trips/${trip._id}/places`,{name:'Owner only'})).body;
  assert.equal((await request('GET','/trips',undefined,otherCookie)).body.length,0);
  for (const [method,path,body] of [
    ['GET',`/trips/${trip._id}`],
    ['PATCH',`/trips/${trip._id}`,input],
    ['DELETE',`/trips/${trip._id}`],
    ['POST',`/trips/${trip._id}/places`,{name:'Intruder'}],
    ['PATCH',`/trips/${trip._id}/places/${place._id}`,{done:true}],
    ['DELETE',`/trips/${trip._id}/places/${place._id}`],
  ]) assert.equal((await request(method,path,body,otherCookie)).status,404);
  const forged = await request('POST','/trips',{...input,owner:account._id},otherCookie);
  assert.equal(forged.body.owner,other.body.user._id);
  const source = await fetch(root+'/auth/sign-out',{method:'POST',headers:{Cookie:otherCookie}});
  assert.equal(source.status,403);
  const origin = await fetch(root+'/auth/sign-out',{method:'POST',headers:{...requestHeaders,Cookie:otherCookie,Origin:'https://untrusted.example'}});
  assert.equal(origin.status,403);
  assert.equal((await request('POST','/auth/sign-out',{},otherCookie)).status,204);
  assert.equal((await request('GET','/trips',undefined,otherCookie)).status,401);
  const login = await request('POST','/auth/sign-in',{email:'SECOND@example.test',password:'Another test password!'},'');
  assert.equal(login.status,200);
  const loginCookie = login.headers.get('set-cookie').split(';')[0];
  assert.notEqual(loginCookie,otherCookie);
  assert.equal((await request('GET','/auth/me',undefined,loginCookie)).body.user._id,other.body.user._id);
  await Session.updateMany({user:other.body.user._id},{$set:{expiresAt:new Date(0)}});
  assert.equal((await request('GET','/trips',undefined,loginCookie)).status,401);
});

test('authentication endpoints throttle repeated attempts', async () => {
  let result;
  for(let i=0;i<31;i++) result=await request('POST','/auth/sign-in',{},'');
  assert.equal(result.status,429);
  assert(Number(result.headers.get('retry-after'))>0);
});

test('expense amounts, budget totals, edits, deletion and private access', async () => {
  const trip = (await request('POST','/trips',input)).body;
  const path = `/trips/${trip._id}`;
  assert.equal((await request('GET',path+'/expenses',undefined,'')).status,401);
  let r=await request('PATCH',path+'/budget',{currency:'INR',budget:'1000.00'});
  assert.equal(r.status,200);assert.equal(r.body.budgetMinor,100000);
  const expense={title:'Lunch',amount:'0.10',currency:'INR',category:'Food',date:'2027-04-10',note:'Test'};
  r=await request('POST',path+'/expenses',expense);assert.equal(r.status,201);assert.equal(r.body.totalMinor,10);
  const id=r.body.expenses[0]._id;
  r=await request('POST',path+'/expenses',{...expense,title:'Coffee',amount:'0.20'});
  assert.equal(r.body.totalMinor,30);assert.equal(r.body.remainingMinor,99970);assert.equal(r.body.byCategory.Food,30);
  for(const amount of ['-1','0','1.001','Infinity','1e3','',1]) assert.equal((await request('POST',path+'/expenses',{...expense,amount})).status,400);
  assert.equal((await request('POST',path+'/expenses',{...expense,date:'2027-02-30'})).status,400);
  assert.equal((await request('POST',path+'/expenses',{...expense,category:'Invalid'})).status,400);
  assert.equal((await request('POST',path+'/expenses',{...expense,currency:'EUR'})).status,409);
  assert.equal((await request('PATCH',path+'/budget',{currency:'EUR',budget:'10'})).status,409);
  r=await request('PATCH',path+'/expenses/'+id,{...expense,amount:'1500',title:'Dinner'});
  assert.equal(r.status,200);assert.equal(r.body.totalMinor,150020);assert.equal(r.body.remainingMinor,-50020);
  const other=(await request('POST','/trips',input)).body;
  assert.equal((await request('DELETE',`/trips/${other._id}/expenses/${id}`)).status,404);
  assert.equal((await request('GET',path+'/expenses')).body.expenses.length,2);
  assert.equal((await request('DELETE',path+'/expenses/'+id)).status,204);
  assert.equal((await request('DELETE',path+'/expenses/'+id)).status,404);
  assert.equal((await request('DELETE',path+'/expenses/no')).status,400);
  assert.equal((await request('GET',path+'/expenses')).body.totalMinor,20);
  const unauthorized=await Trip.create({...input,destination:'Other owner',owner:new mongoose.Types.ObjectId()});
  for(const [method,route,body] of [['GET','expenses'],['PATCH','budget',{currency:'INR',budget:'1'}],['POST','expenses',expense],['PATCH',`expenses/${id}`,expense],['DELETE',`expenses/${id}`]]) assert.equal((await request(method,`/trips/${unauthorized.id}/${route}`,body)).status,404);
  r=await request('PATCH',`/trips/${other._id}/budget`,{currency:'JPY',budget:'1000'});assert.equal(r.body.budgetMinor,1000);
  assert.equal((await request('POST',`/trips/${other._id}/expenses`,{...expense,currency:'JPY',amount:'1.50'})).status,400);
  assert.equal((await request('PATCH',path+'/budget',{currency:'INR',budget:null})).body.budgetMinor,null);
  assert.equal((await request('DELETE',path)).status,204);
  assert.equal((await request('GET',path+'/expenses')).status,404);
});

test('destination suggestions are sourced and validate search input', async()=>{
  const response=await request('GET','/suggestions?destination=Lisbon');
  assert.equal(response.status,200);
  assert(response.body.places.length >= 4);
  assert.equal(response.body.city, 'Lisbon');
  assert(response.body.videoUrl.startsWith('https://www.youtube.com/'));
  assert(response.body.places.every(item=>item.sourceUrl.startsWith('https://') && item.imageUrl.startsWith('https://') && item.mapUrl.startsWith('https://')));
  assert.equal((await request('GET','/suggestions')).status,400);
  assert.equal((await request('GET','/suggestions?destination=')).status,400);

  for (const city of ['Jaipur', 'Bangalore', 'Mumbai', 'Delhi', 'Tokyo', 'Paris', 'London', 'Goa']) {
    const res = await request('GET', `/suggestions?destination=${city}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.city, city);
    assert(Array.isArray(res.body.places));
    assert(res.body.places.length >= 4);
    const first = res.body.places[0];
    assert.equal(typeof first.name, 'string');
    assert.equal(typeof first.category, 'string');
    assert.equal(typeof first.description, 'string');
    assert.equal(typeof first.tryThis, 'string');
    assert.equal(typeof first.price, 'string');
    assert.equal(typeof first.imageUrl, 'string');
  }
});

test('nearby places endpoint validates coordinates and returns clean array', async () => {
  assert.equal((await request('GET', '/places/nearby', undefined, '')).status, 401);
  assert.equal((await request('GET', '/places/nearby?lat=invalid&lon=2.35')).status, 400);
  assert.equal((await request('GET', '/places/nearby?lat=95&lon=2.35')).status, 400);
  assert.equal((await request('GET', '/places/nearby?lat=48.85&lon=200')).status, 400);

  const response = await request('GET', '/places/nearby?lat=48.8566&lon=2.3522&radius=5000');
  assert.equal(response.status, 200);
  assert(Array.isArray(response.body));
  if (response.body.length > 0) {
    const place = response.body[0];
    assert.equal(typeof place.name, 'string');
    assert.equal(typeof place.kind, 'string');
    assert.equal(typeof place.distance, 'number');
    assert.equal(typeof place.xid, 'string');
  }
});

