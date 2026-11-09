# PackFlow Tools — Vue 3 packaging & logistics toolbox (Korea-first Demo)

Browser-only demo for CBM, container/pallet loading, packing documents, and shipment checks. Languages: **한국어 / 中文 / English**. No backend login or payments.

## Run

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Build runs TypeScript check, Vite, then `scripts/prerender-seo.mjs` to emit crawlable `dist/{locale}/tools/{slug}/index.html`, `sitemap.xml`, and `404.html`.

### Deploy env

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_BASE` | `/` | Vite public base (use `/repo/` on GitHub Pages subpath) |
| `SITE_ORIGIN` | `https://example.com` | Absolute origin written into sitemap / prerender canonicals |

```bash
# PowerShell example
$env:VITE_BASE="/"
$env:SITE_ORIGIN="https://your-domain.example"
npm run build
```

Update `public/robots.txt` Sitemap line to match production before deploy.

## Routed URLs (refreshable)

Korea-first root `/` redirects to `/ko/` (or last `packflow.locale`).

Examples:

- `/ko/` — home
- `/ko/tools/cbm-calculator/`
- `/ko/tools/container-loading/`
- `/ko/tools/pallet-loading/`
- `/ko/tools/packing-list/`
- `/ko/tools/packing-list-checker/`
- `/ko/tools/commercial-invoice/`
- `/ko/guides/container-from-excel/`
- `/ko/shared/` — cargo + IndexedDB scheme backup
- `/en/...`, `/zh/...` — same tools in other locales

## Tools (13)

| Tool | Notes |
|------|--------|
| CBM / volumetric weight | Charge modes: shipment / per SKU / per piece |
| Container loading | 20GP/40GP/40HQ, 3D heuristic, unload reasons, load-guide PDF |
| Pallet loading | **T11/T12** presets, layered PDF/CSV, geometry disclaimer |
| Freight comparison | Simulated quotes; FX required before cheapest ranking |
| Packaging cost | A/B with waste / storage / tax |
| Shipping labels | Code128 / QR |
| Packing list | KO/EN Excel import, CSV/XLSX/PDF |
| Shipment audit | Dual-table diff with fix hints |
| Commercial invoice | Incoterms + Korean PDF |
| Sheet nesting | MaxRects / Guillotine (demo limits apply) |
| Warehouse capacity | Rough rack/floor model |
| Unit converter | Length / mass / volume |
| Dieline CAD | Integrated parametric dieline + 3D preview |

## Limits (honest)

- Geometry packing ≠ compression / CG / lashing certification
- Freight numbers are user-entered samples, not live carrier APIs
- Demo unit caps (e.g. container 400, pallet 150)
- IndexedDB schemes are local to the browser
- SEO pages improve crawlability; **Naver/Google ranking is not guaranteed**

## Docs

- [Naver Search Advisor checklist](docs/seo/naver-search-advisor.md)
- [Korea user-test protocol](docs/user-tests/korea-v12-protocol.md)
- [Cloud schemes API draft](docs/api/schemes.md)

## Stack

Vue 3 + TypeScript + Vite, `vue-router`, Vitest, ExcelJS, pdf-lib (+ Korean font), Three.js (3D views).
