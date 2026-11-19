# API Nexus — frontend

React + Vite frontend for API Nexus.

## Setup

```bash
npm install
cp .env.example .env   # then edit VITE_API_BASE_URL if needed
npm run dev
```

The dev server runs at http://localhost:5173. By default it proxies `/api`
to `http://127.0.0.1:8000` (see `VITE_DEV_PROXY_TARGET` in `.env`), so a
locally running backend on port 8000 works with no other setup.

## Environment variables

Set these in `.env` (see `.env.example`). Only variables prefixed `VITE_`
are read by the app, and they are baked into the build at build time, not
read at container startup.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Base URL the app calls for the API. Use a full URL (`https://api.example.com/api`) when the backend is on a different origin; leave as `/api` to call the same origin the frontend is served from. | `/api` |
| `VITE_DEV_PROXY_TARGET` | Dev server only: where `npm run dev` proxies `/api` requests. Not used in a production build. | `http://127.0.0.1:8000` |

## Build

```bash
npm run build
```

Outputs a static site to `dist/`. Preview it locally with `npm run preview`.

## Deploying

This is a static single-page app: any static host works, as long as unknown
routes fall back to `index.html` (React Router handles the rest client-side).

- **Vercel** — `vercel.json` is included with the SPA rewrite already set up.
- **Netlify** — `netlify.toml` is included with the build command and redirect.
- **Any static host / S3 + CDN** — use `public/_redirects`-style rewrite
  rules if supported, or configure your host to serve `index.html` for 404s.
- **Docker / your own server** — `Dockerfile` builds the app and serves it
  with nginx (`nginx.conf` includes the SPA fallback). Build with:

  ```bash
  docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api -t api-nexus-frontend .
  docker run -p 8080:80 api-nexus-frontend
  ```

  If your backend lives behind the same nginx (or you'd rather not bake a
  URL into the build), leave `VITE_API_BASE_URL` as `/api` and uncomment the
  `location /api/ { proxy_pass ...; }` block in `nginx.conf` instead.

**Because `VITE_API_BASE_URL` is compiled into the JS bundle, changing it
always requires a rebuild** — it cannot be changed by editing files on a
running server, and it is not a runtime environment variable in the usual
container sense.

## Linting

```bash
npm run lint
```
