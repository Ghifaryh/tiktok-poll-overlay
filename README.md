# TikTok Poll Overlay

A live polling system for TikTok LIVE streams. Viewers vote by typing a number in chat (or by sending a specific gift), and results render in real time as an OBS browser-source overlay — plus a dashboard where the streamer creates polls and watches results come in.

Built as a Bun monorepo: an [Elysia](https://elysiajs.com) API + WebSocket server, an [Astro](https://astro.build) frontend, and a shared types package.

## How it works

1. The streamer creates a **layout** (a poll) in the dashboard — either comment-based ("type 1, 2, or 3 in chat") or gift-based (map specific TikTok gifts to options).
2. Activating a layout connects to the streamer's TikTok LIVE chat via an unofficial connector library and starts a fresh **session** for that poll.
3. Every matching chat comment or gift updates vote counts in Postgres and broadcasts the new tally over a WebSocket.
4. The **public overlay page** (`/layouts/:token`) — no login required — subscribes to that WebSocket and renders live leaderboard bars. Add it as an OBS Browser Source and it updates in real time on stream.
5. The **dashboard** shows the same live data plus poll management (create, activate, end).

### Important caveat: no official TikTok API

TikTok doesn't provide a public API for live chat/gift events. This project uses [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector), an unofficial library that connects to TikTok's internal Webcast push service. It's not production-guaranteed — TikTok can change its internal protocol without notice, which is why the connector includes reconnect/backoff logic. Consider a managed signing provider (e.g. Euler Stream) for production reliability.

## Tech stack

| Layer          | Choice                                                     |
|----------------|--------------------------------------------------------------|
| API            | [Elysia](https://elysiajs.com) on [Bun](https://bun.sh)     |
| ORM / DB       | [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL        |
| Live events    | [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) |
| Auth           | JWT in an httpOnly cookie (`@elysiajs/jwt`)                  |
| Frontend       | [Astro](https://astro.build) + React islands                |
| Styling        | Tailwind CSS                                                 |
| Realtime       | Native WebSockets (Bun's pub/sub topics)                     |
| Shared types   | Zod schemas in `packages/shared`, used by both API and web    |

## Project structure

```
tiktok-poll-overlay/
├── apps/
│   ├── api/                     # Elysia backend
│   │   └── src/
│   │       ├── auth/            # JWT middleware
│   │       ├── connector/        # TikTok connection manager (one per streamer, refcounted)
│   │       ├── db/               # Drizzle schema + client
│   │       ├── poll/              # comment/gift matching + vote recording
│   │       ├── routes/            # auth, layouts (CRUD), public (token-based read), dev (test simulator)
│   │       └── ws/                # WebSocket room handler (/ws/:token)
│   │
│   └── web/                     # Astro frontend
│       └── src/
│           ├── pages/
│           │   ├── login.astro / signup.astro
│           │   ├── dashboard/index.astro     # authed poll management
│           │   └── layouts/[token].astro      # PUBLIC overlay page (OBS browser source)
│           └── components/                    # React islands (dashboard forms, overlay bars)
│
└── packages/
    └── shared/                  # Zod schemas + inferred types shared by api + web
```

## Data model

- **users** — account + their TikTok username
- **layouts** — a poll: name, `sourceType` (`comment` | `gift`), public `overlayToken`, `status` (`draft` | `active` | `ended`)
- **poll_options** — each option's label + match value (comment text/aliases, or a gift ID)
- **poll_sessions** — one per activation, so re-running a poll starts fresh counts without deleting history
- **poll_events** — the raw vote log (one row per matched comment/gift), used to compute live tallies

Key rule: **one vote per viewer per session** for comment polls, enforced with a partial unique index (`session_id, tiktok_user_id`) rather than application logic — this makes duplicate-vote handling race-condition-safe under concurrent chat bursts. Gift-based polls tally every gift (no such constraint), since that's the point of gifting.

## Getting started

### Prerequisites
- [Bun](https://bun.sh) 1.3+
- PostgreSQL (locally via Docker is easiest)

### 1. Clone and install
```bash
git clone https://github.com/Ghifaryh/tiktok-poll-overlay
cd tiktok-poll-overlay
bun install
```

### 2. Start Postgres
```bash
docker run -d --name pgpoll \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tiktok_poll_overlay \
  -p 5432:5432 postgres:16
```

### 3. Configure environment variables

**`apps/api/.env`**
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tiktok_poll_overlay
JWT_SECRET=change-me-to-something-random
WEB_ORIGIN=http://localhost:4321
PORT=3000
NODE_ENV=development           # set to "production" to disable the /api/dev test routes
EULER_SIGN_API_KEY=            # optional — see note on the connector below
```

**`apps/web/.env`**
```
PUBLIC_API_URL=http://localhost:3000
PUBLIC_WS_URL=ws://localhost:3000
```

> Only variables prefixed `PUBLIC_` are exposed to browser code in Astro — this is intentional, don't put secrets here.

### 4. Run database migrations
```bash
cd apps/api
bun run drizzle-kit generate
bun run drizzle-kit migrate
```

### 5. Run both apps
```bash
# from the repo root, in two terminals:
bun run dev:api
bun run dev:web
```

- API: `http://localhost:3000`
- Web: `http://localhost:4321`

Sign up at `/signup` with your TikTok username, create a poll from the dashboard, activate it, then open `/layouts/:token` (the token is generated per layout) — that's the URL you'd add as an OBS Browser Source.

## Testing without a live TikTok stream

`tiktok-live-connector` connects to TikTok's real signaling servers — there's no official sandbox or staging mode, so end-to-end testing normally requires an actual live stream. To iterate quickly without that, this project includes a **dev-only simulator** that injects fake comment/gift events through the exact same code path (`matchOption` → `recordPollEvent` → WebSocket broadcast) a real TikTok event would take. Anything verified this way behaves identically to real traffic once you swap in a real connection.

> ⚠️ **These routes are gated behind `NODE_ENV !== "production"`.** They accept unauthenticated requests that can inject arbitrary votes, so they must never be reachable in a production deploy. Double-check `NODE_ENV=production` is set before shipping.

### Setup

1. Log in and create a **comment-type** poll with options like `"1"`, `"2"`, `"3"`, then click **Go live** on it.
2. Open the overlay page (`/layouts/:token`) in one tab and the dashboard in another, so you can watch updates land in real time.

### Simulating comments

```bash
curl -X POST http://localhost:3000/api/dev/simulate/yourtiktokusername/comment \
  -H "Content-Type: application/json" \
  -d '{"text": "1", "userId": "viewer-1"}'
```

Try an alias to confirm normalization is working (should count toward the same option as `"1"`):
```bash
curl -X POST http://localhost:3000/api/dev/simulate/yourtiktokusername/comment \
  -H "Content-Type: application/json" \
  -d '{"text": "one", "userId": "viewer-2"}'
```

Confirm the one-vote-per-viewer rule — this second vote from `viewer-1` should be silently ignored, and option 1's count should **not** change:
```bash
curl -X POST http://localhost:3000/api/dev/simulate/yourtiktokusername/comment \
  -H "Content-Type: application/json" \
  -d '{"text": "2", "userId": "viewer-1"}'
```

### Simulating gifts

```bash
curl -X POST http://localhost:3000/api/dev/simulate/yourtiktokusername/gift \
  -H "Content-Type: application/json" \
  -d '{"giftId": "5655", "repeatable": true, "repeatCount": 3}'
```

Setting `"repeatable": true` mimics a streakable gift — this is worth testing specifically to confirm a streak is only counted once it's marked complete, rather than being tallied on every repeat tick.

### Testing against a real TikTok stream

The dev simulator only tests your own logic — it doesn't validate that the real `tiktok-live-connector` event payloads match the field names this code assumes (`data.comment`, `data.user?.nickname`, `data.giftDetails?.giftType`, etc.), since those are based on the library's documented shape rather than a payload actually observed. Before relying on this in front of a real audience:

1. Go live with a test TikTok account — you don't need followers or viewers, just an active live room.
2. From a second device/account, join your own live room and type test comments or send cheap gifts (many TikTok gifts, like Rose or GG, cost as little as 1 coin — roughly $0.01).
3. Temporarily log the raw event payload inside `handleEvent` in `apps/api/src/connector/manager.ts` (e.g. `console.log(JSON.stringify(data))`) to confirm the real field names match what `poll/match.ts` and `poll/record.ts` expect, and adjust if they don't.

## How poll matching works

- **Comments** are normalized (trimmed, lowercased, Unicode-normalized, emoji variation selectors stripped) before matching against each option's `matchValue` and configured `aliases` (e.g. option `"1"` can alias `["one", "1️⃣"]`). Matching is exact, not fuzzy — this keeps results predictable rather than guessing intent on ambiguous input.
- **Gifts** match by exact `gift_id`, and streak gifts are only counted once the streak's final event (`repeatEnd`) fires, to avoid over-counting an in-progress streak.

## Known limitations / next steps

- **Not yet tested against a real TikTok live stream** — everything has been verified via the dev simulator above, but the real connector's actual event field names haven't been confirmed against live payloads yet. Do this before relying on it during a real broadcast.
- No production connection-signing provider wired in by default — the raw `tiktok-live-connector` may be rate-limited or blocked without one at scale.
- No automated tests yet — the dev simulator above is a manual substitute, not a test suite.

## License

MIT — personal project.