# TradingSage Frontend

React + TypeScript + Vite frontend for TradingSage backend APIs.

## Setup

- Install dependencies: `npm install`
- Create env file: `cp .env.example .env`
- Set API URL: `VITE_API_BASE_URL=http://localhost:8000`

## Commands

- `npm run dev` - start local dev server
- `npm run build` - build production assets
- `npm run preview` - preview production build

## Features

- Register/login flow with JWT token persistence.
- Protected routes with forced logout on 401 responses.
- Dashboard sections:
  - Profile (`GET /me`)
  - Deriv API key update (`PUT /me/deriv-key`)
  - Asset catalog + user asset selection (`GET /assets`, `GET /me/assets`, `PUT /me/assets`)
  - Session create/list/detail/stop (`POST /sessions`, `GET /sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/stop`)
  - Session export downloads (`logs`, `liquidity.csv`, `tracks.csv`, `orders.csv`)
- Session detail polling every ~4s while pending/running.
- Typed API modules and Zod form validation.

## Notes

- Base URL is configured strictly via `VITE_API_BASE_URL`.
- Auth header always uses `Authorization: Bearer <token>`.
- No mocked data is used in production paths.
