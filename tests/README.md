# Legacy manual scripts

These scripts were used to poke the live Threads API during v1–v5 development.
Many call tools that were removed in v6 (they never existed in the official
Threads API) and some contain hard-coded IDs, so they are kept only for
reference and are not part of the published package.

The automated test suite lives in [`../test`](../test) and runs with
`npm test` against a mocked Threads API — no token required.
