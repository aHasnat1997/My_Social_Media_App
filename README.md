# Social Media App

A full-stack social media application built as a monorepo. The stack includes a React Native mobile client, a NestJS REST API server, PostgreSQL for persistence, Redis for job queues and real-time features, and RustFS for self-hosted S3-compatible file storage.

---

## Tech Stack

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Mobile       | React Native (Expo SDK 56, New Architecture) |
| Server       | NestJS + Express on Bun runtime              |
| Database     | PostgreSQL via Prisma ORM                    |
| Queue        | BullMQ on Redis                              |
| File Storage | RustFS (S3-compatible, self-hosted)          |
| Monorepo     | Turborepo + Bun workspaces                   |

---

## Project Structure

```
Social_Media_App/
├── apps/
│   ├── native/          # React Native (Expo) mobile app
│   └── server/          # NestJS API server
├── packages/
│   ├── db/              # Prisma schema, client, and migrations
│   ├── env/             # Type-safe environment validation (t3-oss/env)
│   └── config/          # Shared TypeScript config
├── docker-compose.yml   # Full infrastructure (postgres, redis, rustfs, server)
└── package.json         # Root workspace scripts
```

---

## Prerequisites

Make sure you have the following installed:

- [Bun](https://bun.sh) >= 1.3.14
- [Docker](https://www.docker.com) + Docker Compose
- [Android Studio](https://developer.android.com/studio) (for Android development)
- Xcode (for iOS development, macOS only)

---

## Getting Started

### 1. Clone and install dependencies

```sh
git clone <repo-url>
cd Social_Media_App
bun install
```

### 2. Set up environment variables

```sh
cp .env.example .env
```

Open `.env` and fill in the required values. At minimum for local development:

```env
POSTGRES_DB=social_media_app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
REDIS_PASSWORD=redispassword
CORS_ORIGIN=http://localhost:3000
```

Also set up the server env:

```sh
cp apps/server/.env.example apps/server/.env  # then edit as needed
```

And the native app env:

```sh
cp apps/native/.env.example apps/native/.env  # then edit as needed
```

The native app requires:

```env
EXPO_PUBLIC_SERVER_URL=http://<your-local-ip>:3000
```

> Use your machine's local network IP (e.g. `192.168.x.x`), not `localhost`, so the physical device or emulator can reach the server.

---

## Running with Docker (Recommended for Testing)

This spins up PostgreSQL, Redis, RustFS, and the API server together.

```sh
# Build and start all services
docker compose up -d

# Check logs
docker compose logs -f server

# Stop all services
docker compose down
```

The server will be available at `http://localhost:3000`.

Prisma migrations run automatically on server startup.

### Create the storage bucket

After the first `docker compose up`, open the RustFS console at `http://localhost:9001` and log in with your `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY` credentials. Create a bucket matching your `S3_BUCKET_NAME` value (default: `media`).

You only need to do this once — the volume persists across restarts.

---

## Services

When running with Docker, the following services are available:

| Service        | URL                     | Description                                |
| -------------- | ----------------------- | ------------------------------------------ |
| API Server     | `http://localhost:3000` | NestJS REST API                            |
| RustFS API     | `http://localhost:9000` | S3-compatible storage endpoint             |
| RustFS Console | `http://localhost:9001` | Web UI for managing buckets and files      |
| PostgreSQL     | `localhost:5432`        | Database (connect via any Postgres client) |
| Redis          | `localhost:6379`        | Queue and cache                            |

---

## Local Development

### Start infrastructure only (postgres + redis + rustfs)

```sh
docker compose up postgres redis rustfs -d
```

### Run the server

```sh
bun dev:server
```

### Run database migrations

```sh
bun db:push        # push schema changes (dev only)
bun db:migrate     # run migrations
bun db:studio      # open Prisma Studio at http://localhost:5555
```

### Run the mobile app

The mobile app requires a custom dev client (not Expo Go) due to new architecture dependencies.

**First time setup — build the dev client:**

```sh
cd apps/native
bunx expo run:android   # or run:ios on macOS
```

This installs the custom dev client on your device or emulator. You only need to do this once (or when native dependencies change).

**Day-to-day development:**

```sh
bun dev:native
```

Scan the QR code with the installed custom dev client app on your device.

---

## Environment Variables Reference

### Root (`.env`)

Used by Docker Compose to configure all services:

| Variable            | Default                 | Description                              |
| ------------------- | ----------------------- | ---------------------------------------- |
| `POSTGRES_DB`       | `social_media_app`      | PostgreSQL database name                 |
| `POSTGRES_USER`     | `postgres`              | PostgreSQL username                      |
| `POSTGRES_PASSWORD` | `password`              | PostgreSQL password                      |
| `REDIS_PASSWORD`    | `redispassword`         | Redis password                           |
| `RUSTFS_ACCESS_KEY` | `rustfsadmin`           | RustFS admin access key                  |
| `RUSTFS_SECRET_KEY` | `rustfspassword`        | RustFS admin secret key                  |
| `S3_BUCKET_NAME`    | `media`                 | Bucket name to use for file storage      |
| `S3_REGION`         | `us-east-1`             | Region (any value works for self-hosted) |
| `NODE_ENV`          | `production`            | Server runtime environment               |
| `CORS_ORIGIN`       | `http://localhost:3000` | Allowed CORS origin                      |
| `LOG_LEVEL`         | `info`                  | Server log level                         |

### Server (`apps/server/.env`)

| Variable               | Required | Description                                                                      |
| ---------------------- | -------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                                                     |
| `CORS_ORIGIN`          | Yes      | Allowed origin for CORS (e.g. `http://localhost:3000`)                           |
| `NODE_ENV`             | No       | `development` / `production` / `test` (default: `development`)                   |
| `REDIS_HOST`           | No       | Redis host (default: `localhost`)                                                |
| `REDIS_PORT`           | No       | Redis port (default: `6379`)                                                     |
| `REDIS_PASSWORD`       | No       | Redis password                                                                   |
| `REDIS_URL`            | No       | Full Redis connection URL                                                        |
| `LOG_LEVEL`            | No       | `trace` / `debug` / `info` / `warn` / `error` (default: `info`)                  |
| `S3_ENDPOINT`          | No       | Storage endpoint URL (e.g. `http://localhost:9000` for RustFS, empty for AWS S3) |
| `S3_REGION`            | No       | Region (default: `us-east-1`)                                                    |
| `S3_ACCESS_KEY_ID`     | No       | Access key (RustFS admin key or AWS access key ID)                               |
| `S3_SECRET_ACCESS_KEY` | No       | Secret key (RustFS secret or AWS secret access key)                              |
| `S3_BUCKET_NAME`       | No       | Bucket name (default: `media`)                                                   |
| `S3_FORCE_PATH_STYLE`  | No       | Set `true` for RustFS/self-hosted, `false` for AWS S3                            |

### Mobile (`apps/native/.env`)

| Variable                     | Required | Description                           |
| ---------------------------- | -------- | ------------------------------------- |
| `EXPO_PUBLIC_SERVER_URL`     | Yes      | Base URL of the API server            |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | No       | EAS project ID for push notifications |

---

## Available Scripts

Run from the monorepo root:

| Script            | Description                        |
| ----------------- | ---------------------------------- |
| `bun dev:native`  | Start the mobile app dev server    |
| `bun dev:server`  | Start the API server in watch mode |
| `bun build`       | Build all packages                 |
| `bun check-types` | Type-check all packages            |
| `bun db:push`     | Push Prisma schema to database     |
| `bun db:migrate`  | Run Prisma migrations              |
| `bun db:generate` | Regenerate Prisma client           |
| `bun db:studio`   | Open Prisma Studio                 |

---

## API

The server runs on port `3000`.

| Endpoint | Method | Description                 |
| -------- | ------ | --------------------------- |
| `/`      | GET    | Health check — returns `OK` |

---

## Deployment

### Server

Build and push the Docker image:

```sh
docker build -f apps/server/Dockerfile -t social-media-app-server .
docker compose up -d
```

Make sure all production environment variables are set in your `.env` before deploying.

RustFS runs as a container alongside the server — no external storage service needed. For production, make sure the `rustfs_data` volume is backed by a persistent disk on your server.

### Mobile

Build a production APK/IPA using EAS Build:

```sh
cd apps/native
npx eas build --platform android   # or ios
```

Requires an [Expo EAS](https://expo.dev/eas) account and `EXPO_PUBLIC_EAS_PROJECT_ID` set in your env.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request
