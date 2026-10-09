# seating-chart

Plain HTML/JS seating chart editor served by a Cloudflare Worker.

- `public/` static files, served as-is (`main.js` is the editor)
- `src/worker.js` chart API, one KV entry per chart
- `src/styles.css` tailwind v4 input, built to `public/styles.css` (gitignored)

## Dev

```sh
mise install   # node, tailwindcss standalone cli, wrangler
mise run dev   # http://localhost:8787, local KV data lives in .wrangler/
```

## API

- `GET /api/charts` list chart ids
- `GET /api/charts/:id` get chart json
- `PUT /api/charts/:id` save chart json (whole document, last write wins)

## Deploy

1. `wrangler login`
2. Set `routes` in `wrangler.jsonc` to a custom domain on your Cloudflare account.
3. In Cloudflare Zero Trust, add a self-hosted Access application for that domain
   with a policy allowing only your email. The worker has no auth of its own,
   so do this before the first deploy.
4. `wrangler deploy` (builds css first, creates the KV namespace on first run)
