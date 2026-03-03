# Mind Map Journal

This is a minimal Mind Map Journal app with a Node/Express backend and a tiny frontend.

Backend
- Folder: `backend`
- Start: `npm start` (requires Node.js)
- Health: `GET /health`
- Entries:
  - `GET /entries` — list entries
  - `POST /entries` — add entry (JSON { text: string })
  - `DELETE /entries/:id` — delete entry

Frontend
- Folder: `frontend`
- Open `frontend/index.html` in your browser.
- To point the frontend to a remote backend, add `?api=https://your-url` to the page URL.

Run a public tunnel

From `backend` run:

```bash
npm run tunnel
```

This uses `localtunnel` (via npx) to expose your local server.

Notes
- Data is persisted to `backend/data.json`.
- The backend is intentionally simple; for production, use a proper DB and stricter CORS.
