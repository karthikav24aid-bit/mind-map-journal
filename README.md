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
- Recommended: start the backend and visit `http://localhost:5000` in your browser so that the frontend is served by the same server (this avoids CORS and API base issues).
- If you prefer opening the file directly, the client will automatically fall back to `http://localhost:5000` as the API base when the page is loaded via `file://` or when running on `localhost`.
- To point the frontend at a different backend URL, append `?api=https://your-url` to the page URL.

Run a public tunnel

From `backend` run:

```bash
npm run tunnel
```

This uses `localtunnel` (via npx) to expose your local server.

Notes
- Data is persisted to `backend/data.json`.
- The backend is intentionally simple; for production, use a proper DB and stricter CORS.
