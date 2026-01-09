
# Frontend (Design Cybersecurity Theme for RangeX)

This folder hosts the finalized RangeX UI built with Vite, React, TypeScript, Tailwind, and shadcn UI. The visual design should remain unchanged; backend integration is layered on top via the new API clients.

## Run locally
1) `npm install`
2) Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` (defaults to the local NestJS backend at `http://localhost:3000`).
3) `npm run dev`

## Scripts
- `npm run dev` – start Vite dev server.
- `npm run build` – production build (output in `build/` per Vite config).

## Notes
- API clients live in `src/api/` with axios + interceptors.
- Validation schemas live in `src/validation/` using Zod and hook-form adapters.
- The mock data in `src/lib/seed.ts` remains for offline design previews; feature code should prefer the API clients when the backend is available.
  
