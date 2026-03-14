# SolarPanel

Frontend: React + TypeScript + Vite

Backend: Express + MySQL + Prisma REST API

## Backend Quick Start

1. Update server env values in `server/.env`.
2. Create database in MySQL (example: `solarpanel_demo`).
3. Run migration:

```bash
npm run prisma:migrate -- --name init
```

4. Start backend server:

```bash
npm run server:dev
```

The API runs at `http://localhost:4000` by default.

## CORS Configuration

The Express API uses:

```ts
app.use(cors())
```

This allows requests from any origin, which is fine for demo usage.

## REST Endpoints

- `GET /api/health`
- `GET /api/panels`
- `GET /api/panels/:id`
- `POST /api/panels`
- `PUT /api/panels/:id`
- `DELETE /api/panels/:id`

### Request Body Example (POST / PUT)

```json
{
  "name": "Roof Array A",
  "location": "Block 1",
  "capacityKw": 42.5,
  "status": "ACTIVE"
}
```

Valid status values: `ACTIVE`, `MAINTENANCE`, `OFFLINE`.

## Useful Scripts

- `npm run dev` - start frontend
- `npm run server:dev` - run backend in watch mode
- `npm run server:build` - build backend TypeScript
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - run Prisma migrations
