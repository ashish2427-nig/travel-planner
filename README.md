# Travel Trip Planner

A plain JavaScript MERN app with a React/Vite client and Express/Mongoose API. All seven requested features are implemented: create, list, view, and edit trips; add, toggle, and delete places; delete trips with their places. Includes working sign-up/sign-in, private user-owned trips, responsive navigation, status filters, itinerary progress, validation messages, and loading/empty states.

## Run locally

Prerequisites: Node.js 22.12+ (tested on 24.19.0), npm, and a running MongoDB server.

From this project folder:

```sh
npm --prefix server ci
npm --prefix client ci
```

Copy `server/.env.example` to `server/.env`. On PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

Set `MONGO_URI` in `server/.env` to your MongoDB connection string. The supplied example uses a local database named `travel_trip_planner`. A working local `.env` was created during this build and is ignored by Git. No credentials are embedded in source code.

Start the server in one terminal:

```sh
cd server
npm run dev
```

Start the client in another terminal:

```sh
cd client
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to port 3001, so no CORS dependency is needed. If changing the API port, also change the proxy target in `client/vite.config.js`.

## Production build, served by Express

From the project folder:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. Express serves both the built React app and API. Detail URLs use `#/trips/<id>` and support reloads without a routing dependency. Both development servers bind to loopback by default.

## Folder structure

```text
travel-trip-planner/
  client/
    src/
      main.jsx           Session state, private routes, trip list, navigation
      Navbar.jsx         Desktop/mobile navigation and sign-out
      AuthPage.jsx       Sign-up/sign-in forms
      TripForm.jsx       Shared create/edit form
      TripDetail.jsx     Trip detail and trip actions
      Places.jsx         Place creation, completion, removal
      api.js             Shared fetch/error handling
      style.css          Responsive styling and CSS illustrations
    vite.config.js
    package.json
    package-lock.json
  server/
    src/
      models/Trip.js
      models/Place.js
      models/User.js
      models/Session.js
      auth.js            Password hashing, sessions, auth routes, CSRF checks
      app.js             REST routes and production static serving
      index.js           MongoDB connection and server lifecycle
      validation.js
      status.js
    test/api.test.js     Tests against a real temporary MongoDB database
    .env.example
    package.json
    package-lock.json
  package.json
  VERIFICATION.md
```

## REST API

| Method | Path | Body / behavior |
| --- | --- | --- |
| POST | `/api/trips` | `{ destination, startDate, endDate }`; 201 |
| GET | `/api/trips` | Sorted list with derived status; 200 |
| GET | `/api/trips/:tripId` | Trip with its places; 200 |
| PATCH | `/api/trips/:tripId` | All three editable fields required; 200 |
| DELETE | `/api/trips/:tripId` | Removes places and trip; 204 |
| POST | `/api/trips/:tripId/places` | `{ name, note? }`; 201 |
| PATCH | `/api/trips/:tripId/places/:placeId` | `{ done: boolean }`; 200 |
| DELETE | `/api/trips/:tripId/places/:placeId` | Removes a place; 204 |

Validation errors return 400, missing resources return 404, oversized bodies return 413, and unexpected failures return 500. Error payloads are `{ "error": "message" }`. Place mutations are scoped to their parent trip.

Dates are validated, stored as calendar strings in `YYYY-MM-DD` format, and compared against the **UTC** calendar day. Both the start and end dates are inclusive for `ongoing`; dates before the start are `upcoming`, dates after the end are `past`. Dates are never converted to the browser's timezone. Destination/place names allow up to 120 characters; notes allow up to 1,000. The server selects allowed fields rather than accepting arbitrary MongoDB updates.

Trip and Place are separate Mongoose models; Place references Trip with an indexed ObjectId. This allows independent place updates without growing the Trip document.

## Tests

```sh
npm test
```

Tests require a running MongoDB at `MONGO_URI`. They create a unique `trip_planner_test_*` database, verify real HTTP requests and stored documents, then drop only that test database. The MongoDB account needs permission to create/drop this test database. No mocks or additional test libraries are used.

See `VERIFICATION.md` for API, browser, and build checks performed.

## Scope and limitations

- Accounts and private trips are implemented. Email verification, password reset, MFA, social login, collaboration, maps, booking, and hosted deployment are not included.
- MongoDB must be running; there is no fake-data or in-memory fallback.
- On standalone MongoDB, deleting a trip and its places uses sequential writes, not a multi-document transaction. An interruption or concurrent multi-process writes can leave inconsistent data. A replica-set transaction strategy is needed for those production guarantees.
- Lists are unpaginated. No realtime synchronization across browsers; reload to pick up other clients' changes. The list refreshes its date-derived statuses once a minute.
- No new third-party packages beyond Express, Mongoose, React, React DOM, and Vite were added directly. CSS supplies the artwork; there are no remote fonts or image dependencies.

## Accounts and private trips

Use **Sign up** in the navigation bar, or open `#/sign-up`, to create an account. Sign-up requires a name, email, and a 12–128 character password. Email addresses are normalized to lowercase. Sign-in is at `#/sign-in`; signing out revokes the current session. Protected links redirect guests to sign-in and return them to the requested screen afterward.

Passwords are salted and hashed with Node's built-in asynchronous scrypt (`N=32768, r=8, p=3`). Random session tokens are sent in HttpOnly, SameSite=Strict cookies; only SHA-256 token hashes are stored in MongoDB. Sessions expire after seven days and are checked for expiry on every request, independent of TTL cleanup. No tokens or passwords are stored in localStorage. Auth attempts are limited to 30 per IP per 15 minutes in the current server process.

Every Trip has a required `owner` reference to User. All trip queries and place mutations enforce that owner on the server. User-supplied owner fields are ignored. Legacy trips without owners remain in the database but are hidden from all accounts; they are never silently assigned to the first registrant. An explicit migration is required to associate any old shared records with an account. No legacy trips were present during this update.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/sign-up` | `{ name, email, password }`; creates account and session; 201 |
| POST | `/api/auth/sign-in` | `{ email, password }`; issues a new session; 200 |
| GET | `/api/auth/me` | `{ user }`, or `{ user: null }` for guests; 200 |
| POST | `/api/auth/sign-out` | Revokes current session and clears cookie; 204 |

Unauthenticated trip requests return 401. Other users' trips return 404. API responses are not cached. All write requests require `X-Requested-With: TravelTripPlanner`. Browser origins must match `APP_ORIGINS`; local Vite/Express origins are allowed by default in development. Native API clients need to send the custom header and retain the returned cookie.

For HTTPS hosting, set `NODE_ENV=production` and `APP_ORIGINS=https://your-domain.example`. Production enables Secure cookies and has no default trusted browser origins. Do not set production mode for the local HTTP preview. Configure a shared rate limiter before scaling to multiple server processes; the current limiter is in memory. No new npm dependencies were added for accounts.
