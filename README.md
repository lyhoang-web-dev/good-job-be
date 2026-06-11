# Good Job API

Internal API for an employee recognition program (**Express 5**, **TypeScript**, **Prisma**, **PostgreSQL**, **Redis**).

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

## Further documentation

- DB schema: `prisma/schema.prisma`
- App configuration: `src/config/index.ts`
- If an **`AI_README.md`** file exists: auth / CORS / Docker context for AI assistants or new contributors
