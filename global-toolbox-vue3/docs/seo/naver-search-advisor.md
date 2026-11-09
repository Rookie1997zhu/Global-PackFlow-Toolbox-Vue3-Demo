# Naver Search Advisor checklist (manual)

PackFlow Demo can prepare crawlable `/ko/tools/...` HTML, `robots.txt`, and `sitemap.xml`. Account verification must be done by a human site owner.

## Prerequisites

1. Deploy the built `dist/` to a public HTTPS origin.
2. Set `SITE_ORIGIN` when building so sitemap URLs match production, e.g.:

```bash
# PowerShell
$env:SITE_ORIGIN="https://your-domain.example"
$env:VITE_BASE="/"
npm run build
```

3. Confirm these URLs open without login:
   - `https://your-domain.example/ko/`
   - `https://your-domain.example/ko/tools/cbm-calculator/`
   - `https://your-domain.example/sitemap.xml`
   - `https://your-domain.example/robots.txt` (update Sitemap line to the real origin)

## Steps in Search Advisor

1. Open [Naver Search Advisor](https://searchadvisor.naver.com/).
2. Add the site / verify ownership (HTML meta tag or file upload as instructed).
3. Submit `sitemap.xml`.
4. Request crawl for `/ko/` and key tools (`cbm-calculator`, `container-loading`, `pallet-loading`, `packing-list-checker`).
5. Monitor index / crawl errors weekly for 2–4 weeks.

## Notes

- Indexing is not guaranteed and does not imply ranking or traffic.
- Keep tool page titles/descriptions aligned with Korean task language (CBM, 패킹리스트 대조, T11).
- After domain change, rebuild with the new `SITE_ORIGIN` and resubmit the sitemap.
