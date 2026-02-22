# CodeVid

CodeVid is a full-stack app for generating syntax-highlighted code videos. It includes:

- A React + Vite frontend in `client/`
- An Express backend in `server/`

## Project structure

- `client/` — UI application
- `server/` — API, rate limiting, and video generation logic

## Prerequisites

- Node.js 18+
- npm
- FFmpeg available on your system `PATH` (required by `fluent-ffmpeg` for video generation)
- Google Chrome installed at `/usr/bin/google-chrome` (current Puppeteer launch path in `server/controllers/syntaxController.js`)

If Chrome is installed in a different location on your machine, update `executablePath` in `server/controllers/syntaxController.js` to match your local install path.

## Environment variables

Create `server/.env` with:

```env
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
STATS_PASSWORD=your_stats_password
PORT=3000
NODE_ENV=development
```

## Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

## Run locally

In one terminal:

```bash
cd server
node index.js
```

In another terminal:

```bash
cd client
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:3000` by default.

## Build frontend

```bash
cd client
npm run build
```

## Lint frontend

```bash
cd client
npm run lint
```
