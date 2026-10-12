# Smart Cold Chain

The project is organized as a static frontend served by a Node/Express backend.

## Run locally

```sh
npm install
npm start
```

Open `http://localhost:3000`. The legacy root `index.html` and `settings.html` files redirect to the pages under `frontend/`.

## Project layout

- `frontend/` contains the dashboard and settings pages.
- `frontend/assets/css/` contains page stylesheets.
- `frontend/assets/js/` contains page scripts.
- `backend/src/` contains the Express app, API routes, controllers, and in-memory data adapter.

Available endpoints:

- `GET /api/health`
- `GET /api/alerts`
- `POST /api/alerts/:id/ack`
- `POST /api/alerts/:id/resolve`

The alert data adapter is in-memory and starts empty; connect it to persistent storage when a database is selected.
