# Apollo

The Singularity Engine **world-model backend** — Node + Fastify over a
file-based content-base. Reimplements the legacy Laravel
`content-creation-center`, built **slice by slice** alongside Athene.

Plan: [`../development/beta_implementation_plan_apollo.md`](../development/beta_implementation_plan_apollo.md).

## Run

```sh
npm install
npm run dev      # node --watch — restarts on file change
# or: npm start
```

Serves `http://127.0.0.1:8001` by default (override `APOLLO_PORT` /
`APOLLO_HOST`). Runs alongside the legacy CCC on `:8000` during cutover;
Athene re-points at Apollo at A5.

## Status

Slice 1 (A1–A5): **World + Entity Classes + Attribute Set Versions**.
Right now this is the service **skeleton** — a Fastify instance + a
`/health` route. The content-base store, the domain model, and the slice-1
routes land as A1–A4 fill in the contract.
