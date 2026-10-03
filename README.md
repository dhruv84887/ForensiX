# ForensiX

ForensiX is a React and Express prototype for exploring a digital-forensics workflow. It includes a sample file scan, single and bulk recovery actions, PDF report generation, and an erasure simulation.

## Run locally

Install dependencies in the project and backend folders:

```sh
npm install
npm --prefix backend install
```

Start the API and Vite app together in one terminal:

```sh
npm run dev
```

If you prefer separate terminals, run `npm run backend` for the API and `npm run dev -- --host` for Vite. The development command reuses an already-running authenticated ForensiX API when one is available.

The app uses `http://localhost:5000` for its API by default. Set `VITE_API_BASE_URL` in a local `.env` file to point it at another API URL.

## Prototype scope

- Scan results are three fixed sample files. Case data is kept in server memory and is cleared when the backend restarts.
- Recovery endpoints update only that in-memory sample case; they do not read or write files on the computer.
- The erasure endpoint is deliberately a simulation. It never accesses a drive or deletes data.
- Register creates a local account in `backend/data/accounts.json`; passwords are stored as salted scrypt hashes. The account file is ignored by Git.
- Login uses an HTTP-only session cookie, and the case/recovery/erasure API routes require that session. Session records live in backend memory, so restarting the backend logs everyone out. “Remember this device” extends a session cookie to 30 days; ordinary sessions expire after 12 hours.
- Set `CORS_ORIGINS` to the exact frontend origin when the frontend is not running at `http://localhost:5173` or `http://127.0.0.1:5173`. In production, serve over HTTPS and set `NODE_ENV=production` so cookies use the `Secure` flag.
- Email verification, password reset and Google/Microsoft sign-in are not configured. This local account store is intended for the prototype; use a managed database and production identity provider before deploying it for public accounts.

Do not use generated prototype reports as forensic evidence or as a record of real storage operations.
