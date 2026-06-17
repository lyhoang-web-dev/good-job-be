# Good Job API

Internal API for an employee recognition program (**Express 5**, **TypeScript**, **Prisma**, **PostgreSQL**, **Redis**).

---

## Architecture

```mermaid
flowchart TD
    U(["User / Browser"])

    subgraph FE_HOST["Vercel · Frontend"]
        FE["React 19 + Vite SPA<br/>Chakra UI · TanStack Router/Query"]
    end

    subgraph BE_HOST["Render · Backend (Docker: Node + ffmpeg)"]
        API["Express 5 API · Prisma<br/>JWT auth · idempotency"]
        WORKER["Media worker (BullMQ)<br/>ffprobe · validation"]
        DISK[/"Uploads — local disk<br/>ephemeral · → Cloudflare R2 (planned)"/]
    end

    PG[("Neon<br/>PostgreSQL")]
    REDIS[("Upstash · Redis<br/>BullMQ queue · SSE pub/sub · idempotency")]
    OAUTH{{"Google OAuth 2.0"}}

    U -->|"1 · load SPA (HTTPS)"| FE
    U -->|"2 · REST · Bearer JWT"| API
    U -->|"3 · Sign in with Google"| API
    API -->|"4 · redirect"| OAUTH
    OAUTH -->|"5 · callback + code"| API
    API -.->|"6 · redirect w/ token in #fragment"| FE

    U -->|"upload media (multipart)"| API
    API -->|"write file"| DISK
    API -->|"enqueue job"| REDIS
    REDIS -->|"dequeue"| WORKER
    WORKER -->|"read file"| DISK
    WORKER -->|"update status"| PG
    WORKER -->|"publish event"| REDIS

    API -->|"Prisma ORM"| PG
    API -->|"idempotency · pub/sub"| REDIS
    API -.->|"SSE /api/events · live updates"| U
```

**Components**

| Service | Role |
|---------|------|
| **Vercel** | Hosts the React/Vite SPA (static assets). |
| **Render** | Runs the backend container: Express API + BullMQ media worker + ffmpeg/ffprobe. |
| **Neon** | Managed PostgreSQL, accessed via Prisma. |
| **Upstash** | Managed Redis — three roles: BullMQ media queue, SSE pub/sub, and idempotency cache/lock. |
| **Google OAuth 2.0** | Social login; the JWT is handed to the SPA via the URL fragment on callback. |
| **Uploads** | Written to the container's local disk (ephemeral on Render's free tier); planned move to Cloudflare R2 for durable media. |

Auth is **Bearer-token** based (no cross-site cookies), so the cross-origin FE ↔ BE setup only needs CORS configured to the frontend origin.

---

## Docker Hub (prebuilt image)

**Repository:** `htly/goodjobs` _(your Docker Hub namespace — no image published yet)_

```bash
docker pull htly/goodjobs:latest
```

Run the container (requires an existing **PostgreSQL** and **Redis**; adjust `DATABASE_URL` / Redis for your environment):

```bash
docker run --rm -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://USER:PASS@HOST:5432/DBNAME" \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  -e CORS_ORIGIN=https://your-frontend.example \
  -e FE_URL=https://your-frontend.example \
  -v goodjob-uploads:/app/uploads \
  htly/goodjobs:latest
```

- **Migration:** the image does **not** run `prisma migrate` on startup. Run migrations once beforehand (local machine / CI / a job on a host that has `DATABASE_URL`):

  ```bash
  npx prisma migrate deploy
  ```

- You may use **`REDIS_URL`** instead of `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` (see `src/lib/redis.ts`).

- Health: `GET http://localhost:4000/api/health`

---

## Install and run from source (dev)

### Requirements

- **Node.js** 20+ (22 recommended, matching the Dockerfile)
- **npm** (the repo uses `package-lock.json`)
- **PostgreSQL** 16+
- **Redis** 7+

### Steps

1. **Clone** the repo and enter the project directory.

2. **Environment variables**

   ```bash
   cp .env.example .env
   ```

   At minimum, set in `.env`: `DATABASE_URL`, `JWT_SECRET`, and Redis (`REDIS_HOST` / `REDIS_PORT`, or `REDIS_URL`).

3. **Install dependencies and generate the Prisma Client**

   ```bash
   npm install
   ```

4. **Database migration**

   ```bash
   npm run db:migrate
   ```

   (Creates the schema on first run; production environments use `npm run db:migrate:prod`.)

5. **Run the API in dev mode** (hot reload)

   ```bash
   npm run dev
   ```

   Default API: `http://localhost:4000/api` (port set by `PORT` in `.env`).

### Local production build

```bash
npm run build
npm start
```

---

## Docker Compose (build from source in this repo)

Run Postgres + Redis + API (profile `full`):

```bash
cp .env.example .env   # adjust if needed
docker compose --profile full up --build -d
```

API: port `API_PORT` (default 4000). Remember to run migrations against the database that compose creates (for example, from the host with `DATABASE_URL` pointing at `localhost`).

---

## Useful scripts

| Command | Description |
|------|--------|
| `npm run dev` | Run `src/index.ts` (dev) |
| `npm run build` | `prisma generate` + `tsc` + `tsc-alias` |
| `npm start` | Run `dist/index.js` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:migrate:prod` | `prisma migrate deploy` |
| `npm run db:seed` | Seed sample data |
| `npm test` / `npm run test:unit` | Jest |

Type-check the entire project (including `tests/`):

```bash
npx tsc --noEmit
```

---

## Seed data & test accounts

`npm run db:seed` loads `prisma/dummy-data.sql` + `prisma/dummy-users.sql`. **All seeded users share the password `password123`.**

**Admin login:** `sql-admin@sql-dummy.goodjob` / `password123` — has the `admin` role and can access `/admin/rewards`.

| Email | Role |
|-------|------|
| `sql-admin@sql-dummy.goodjob` | **admin** — can access `/admin/rewards` |
| `demo-dan@goodjob.com` | user |
| `demo-emma@goodjob.com` | user |
| `demo-frank@goodjob.com` | user |
| `demo-grace@goodjob.com` | user |
| `sql-alice@sql-dummy.goodjob` | user |
| `sql-bob@sql-dummy.goodjob` | user |
| `sql-carol@sql-dummy.goodjob` | user |

> Dummy accounts for local/demo use only.

---

## Further documentation

- DB schema: `prisma/schema.prisma`
- App configuration: `src/config/index.ts`
- If an **`AI_README.md`** file exists: auth / CORS / Docker context for AI assistants or new contributors
