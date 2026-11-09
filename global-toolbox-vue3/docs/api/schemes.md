# Cargo schemes API contract (v1)

Demo today persists schemes in browser IndexedDB (`packflow-demo` / `schemes`). Formal SaaS should expose the same payload shape over authenticated REST.

## Scheme document

```json
{
  "version": 1,
  "id": "sch_…",
  "name": "KR export week 12",
  "updatedAt": "2026-11-09T08:00:00.000Z",
  "locale": "ko",
  "cargo": [
    {
      "sku": "SKU-A",
      "length": 42,
      "width": 32,
      "height": 28,
      "weight": 7.5,
      "qty": 120,
      "price": 12.5
    }
  ],
  "meta": {}
}
```

Units: length/width/height in **cm**, weight in **kg**, price in the user's display currency (demo uses USD sample).

## Demo ↔ cloud field alignment

| Field | Demo IndexedDB | Future API |
|-------|----------------|------------|
| `version` | required = 1 | required; bump with migrations |
| `id` | client-generated | server UUID ok; clients may send idempotency key |
| `name` | required | required |
| `updatedAt` | ISO string | server authoritative |
| `locale` | optional | optional preference |
| `cargo[]` | required | required; team-scoped |
| `meta` | optional bag | optional; no secrets |

## REST draft (not implemented)

Auth: Bearer session / API token. All routes require team scope.

- `GET /api/v1/schemes` — list schemes for current team (`?q=&page=&pageSize=`)
- `POST /api/v1/schemes` — create (`body` = Scheme without server `id`/`updatedAt` optional)
- `GET /api/v1/schemes/{id}` — detail
- `PUT /api/v1/schemes/{id}` — replace cargo + name
- `DELETE /api/v1/schemes/{id}` — delete

### Success envelope (illustrative)

```json
{ "ok": true, "data": { /* Scheme */ } }
```

### Error envelope (illustrative)

```json
{ "ok": false, "code": "SCHEME_NOT_FOUND", "message": "Scheme not found" }
```

Cross-tenant access must return 404/403; list endpoints never leak other teams' schemes.

## Migration notes

- Demo JSON export/import uses the same document; cloud import can accept Demo files when `version === 1`.
- Future `version: 2` must keep a compatibility reader or provide a migration endpoint.
