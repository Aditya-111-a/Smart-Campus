# Verification: Auth, Buildings, Manual Entry, CSV Import

Use this to confirm each fix with concrete evidence (console, Network tab, Debug panel).

## 1. Authentication

- **Token storage**: On login, token is stored in `localStorage` under key `token`. Check: DevTools → Application → Local Storage → `token`.
- **Token on every request**: Open DevTools → Network. Log in, then open any protected page (e.g. Manual Entry). For each request to `/api/*` (e.g. `/api/buildings`, `/api/auth/me`), check Request Headers: `Authorization: Bearer <token>` must be present.
- **No API when unauthenticated**: If you remove the token (Application → Local Storage → delete `token`) and refresh a protected URL, you must be redirected to `/login` before any `/api` request is sent. In Network, you should see no `/api/buildings` or `/api/auth/me` until after login.
- **401 clears session**: While logged in, force a 401 (e.g. invalidate token on server or use an expired token). On the next API call that returns 401, console should show `[API] 401 on <url>` and `[Auth] 401 received – clearing auth state`; you should be redirected to login and no auth banner should persist after you log in again.
- **Console proof**: After login you should see: `[Auth] Login OK, token stored, length: …`, then `[Auth] Token set, fetching /auth/me`, then `[Auth] /auth/me OK: <email> role: <role>`.

## 2. Building dropdown

- **Load on mount**: Open Manual Entry (as admin). Buildings list should load immediately. In console you should see `[Buildings] raw response 200 <array>` with the list of buildings.
- **Empty DB vs error**: If the list is empty, console shows whether the response was 200 with `[]` (empty database) or a non-2xx (auth/error). The UI shows either “Database has no buildings…” with a “Create default VIT buildings” button, or “No buildings loaded. Check login or retry.” with “Retry loading buildings”.
- **One-click seed**: If the database has no buildings, click “Create default VIT buildings”. Request: `POST /api/admin/seed-buildings` with `Authorization: Bearer …`. Response: `{ "created": <n>, "message": "..." }`. Then the dropdown refetches and shows the new buildings.
- **Scrollable list**: The building `<select size={14}>` shows multiple options; scroll to see all.

## 3. Others (add new building) flow

- **Atomic**: Choose “Others (add new building)”, fill name (and optionally code), submit. In Network: first `POST /api/buildings` (create building), then `POST /api/readings` (create reading). If `POST /api/buildings` fails (e.g. 400 “Building code already exists”), there must be no `POST /api/readings`; the UI shows the error and does not submit the reading.
- **Backend**: Name is required (empty name → 400 “Building name is required”). If code is omitted, backend generates it from name (e.g. “New Block” → “NEW-BLOCK”). Campus defaults to “VIT Vellore”. Duplicate code → 400 “Building code already exists”.

## 4. CSV import

- **Same auth**: Import uses the same `api` instance as Manual Entry, so the same Bearer token is sent. Check Network: `POST /api/admin/import-readings` has `Authorization: Bearer …`.
- **Admin only**: Non-admin gets 403; UI shows “You need admin rights to import…” with link to login. 401 shows “Please log in as admin to import. Your session may have expired.” with “Go to login”.
- **Row-level errors**: If some rows fail (e.g. invalid timestamp or value), the result table shows “Failed rows” with row number and error message. Successful rows are still imported (savepoint per row).
- **Missing buildings**: Buildings not in the DB are auto-created during import (same rules: name/code, campus “VIT Vellore”). If creation fails (e.g. validation), that row appears in “Failed rows” with a clear error.

## 5. Debug panel

- **Enable**: Add `?debug=1` to the URL (e.g. `/admin/manual-entry?debug=1`). A panel appears at bottom-right showing: current user (email), role, token status (present + prefix or absent), and last 10 API responses (method, URL, status, 🔑 if auth header was sent).
- **Request logging**: With `?debug=1`, `window.__DEBUG_API` is set so the API interceptor logs each request and whether the Auth header was sent (see console).

## Quick acceptance checklist

1. Log in once as admin.
2. Open Manual Entry: buildings load and appear in the dropdown (or “Create default VIT buildings” if DB is empty).
3. Add a new building via “Others”, submit a reading: building is created then reading is created; no auth errors.
4. Import a CSV (admin): request has Bearer token; success/failed counts and failed rows (if any) are shown; no generic “Could not validate credentials” without a “Go to login” or explanation.

If any step fails, use the Debug panel (`?debug=1`) and Network/Console to see: user, role, token status, last API responses, and request headers.
