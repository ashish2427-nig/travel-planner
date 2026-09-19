# Verification performed

Completed locally on 2026-09-18 using Node.js 24.19.0, the running MongoDB service, Express, Vite, and the in-app browser. No mock persistence was used.

## Feature-by-feature build loop

Each backend slice was implemented and checked with Node's native HTTP `fetch` and assertions before its React UI was implemented and exercised in the browser.

| Slice | API verification before UI | Browser verification |
| --- | --- | --- |
| 1. Create trip | 201, persisted ID, trimmed destination; 400 for missing fields, impossible dates, reversed range | Submitted Lisbon with destination and dates; observed saved-trip message |
| 2. List trips | 200 and persisted records; status tests before/on/after date boundaries | Reloaded list; saw saved trips and upcoming badges; checked Past empty filter and All trips |
| 3. Trip detail | 200 for saved trip; 400 malformed ID; 404 missing ID | Opened Kyoto from list; checked dates/status; reloaded detail URL |
| 4. Add places | 201 with trip reference, name/note, done=false; 400 empty name; fetched stored place | Added Arashiyama bamboo grove with note; saw it beside Fushimi Inari |
| 5. Toggle completion | 200 for both true and false; 400 nonboolean; 404 wrong parent trip | Checked completion; reloaded to verify saved state; reversed it; progress updated |
| 6. Delete place/trip | 204 delete, 404 repeated delete/missing resource | Removed a place through confirmation; deleted Kyoto and returned to smaller trip list |
| 7. Edit trip | 200 updated fields and recalculated status; 400 invalid edit | Changed Lisbon to Porto with past dates; observed updated heading/dates/past badge and reloaded |

The browser's generic date fill helper did not reliably set native date fields; the browser's supported native `setValue` API set and submitted both dates successfully. Its checkbox `check()` helper also lost its selector when the accessible label changed after a successful update; explicit clicks plus saved-state inspection verified both directions.

## Final checks

- `npm test`: **4 tests passed, 0 failed**, against a newly created real MongoDB test database. Tests cover the full lifecycle, input validation, malformed JSON, oversized bodies, ID handling, cross-trip place mutation rejection, repeat completion updates, leap/single-day dates, and status boundaries.
- Test assertions directly queried Mongoose to confirm stored changes and absence of orphaned places after normal trip deletion. The temporary test database was removed by teardown.
- `npm run build`: **passed** with Vite 8.3.0.
- Loaded the built React bundle at `http://127.0.0.1:3001`, served directly by Express.
- From that production-served UI, added a place without a note, marked it done, and reloaded; the saved place and checked state persisted.
- Inspected the desktop list visually and the detail screen at a 390×844 viewport. No horizontal overflow in the mobile check. Restored the original viewport afterward.
- Browser error log was empty on the production smoke check.
- Removed only the disposable trips created during the browser/API checks. The supplied planner starts empty.

## Not verified / not included

- No hosted deployment or external MongoDB Atlas connection was tested.
- No multi-user authorization, distributed concurrency, database failover, or transactional crash-recovery guarantees.
- Browser checks were interactive tool-driven checks, not a committed browser-test framework. The automated regression suite is the committed server test file.

## Navigation and account follow-up

- Added desktop navigation and a collapsible mobile menu with Home, My trips, Plan a trip, Sign in, and Sign up; authenticated users see their name and Sign out.
- Six automated test groups now pass, including the original trip regression coverage under authenticated sessions.
- Additional tests verify signup, duplicate email handling, validation, generic incorrect-credential errors, salted hashes, HttpOnly/SameSite cookies, session rotation, logout revocation, expiry, and authentication throttling.
- A second test user cannot list, read, edit, delete, or add/toggle/delete places on the first user's trip. A forged owner field cannot transfer ownership. Missing custom headers and untrusted browser origins receive 403.
- Browser verification: created a disposable account, created a private trip, reloaded while signed in, signed out, checked the protected-route redirect, rejected an incorrect password, signed in successfully, and retrieved the same saved trip.
- Inspected desktop sign-in and 390px mobile sign-up layouts. Opened the mobile navigation and verified it closes on navigation. No horizontal overflow in the mobile check.
- Production build passed after the account UI was added. The built app was exercised through Express on port 3001.
- Removed the disposable browser account, its sessions, and its trip after verification. No legacy unowned trips were found.
- Email verification, password reset, MFA, and public HTTPS hosting were not implemented or tested.
