"""Korean multi-page PDF renderer using reportlab + NotoSansKR (CID fallback)."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

_ACTIVE_FONT: str | None = None


def _font_path() -> Path:
    # apps/documents/renderers -> backend/
    return Path(__file__).resolve().parents[3] / "assets" / "fonts" / "NotoSansKR-Regular.otf"


def ensure_font() -> str:
    global _ACTIVE_FONT
    if _ACTIVE_FONT:
        return _ACTIVE_FONT
    path = _font_path()
    try:
        if path.is_file():
            pdfmetrics.registerFont(TTFont("NotoSansKR", str(path)))
            _ACTIVE_FONT = "NotoSansKR"
            return _ACTIVE_FONT
    except Exception:
        pass
    cid = "HYSMyeongJo-Medium"
    pdfmetrics.registerFont(UnicodeCIDFont(cid))
    _ACTIVE_FONT = cid
    return _ACTIVE_FONT


class _PdfDoc:
    def __init__(self, title: str, footer: str):
        self.buf = BytesIO()
        self.c = canvas.Canvas(self.buf, pagesize=A4)
        self.width, self.height = A4
        self.font = ensure_font()
        self.y = self.height - 20 * mm
        self.footer = footer
        self.page = 1
        self.title = title
        self._draw_header()

    def _draw_header(self) -> None:
        self.c.setFont(self.font, 8)
        self.c.drawString(15 * mm, self.height - 10 * mm, self.title[:80])

    def _draw_footer(self) -> None:
        self.c.setFont(self.font, 8)
        self.c.drawString(15 * mm, 10 * mm, self.footer[:100])
        self.c.drawRightString(self.width - 15 * mm, 10 * mm, str(self.page))

    def newline(self, text: str, size: int = 10, bold: bool = False) -> None:
        if self.y < 20 * mm:
            self._draw_footer()
            self.c.showPage()
            self.page += 1
            self.y = self.height - 20 * mm
            self._draw_header()
        self.c.setFont(self.font, size)
        max_chars = 90 if size >= 10 else 110
        remaining = text or ""
        first = True
        while remaining or first:
            first = False
            chunk = remaining[:max_chars]
            remaining = remaining[max_chars:]
            self.c.drawString(15 * mm, self.y, chunk)
            self.y -= (size + 4) * 0.5 * mm
            if self.y < 20 * mm and remaining:
                self._draw_footer()
                self.c.showPage()
                self.page += 1
                self.y = self.height - 20 * mm
                self._draw_header()
                self.c.setFont(self.font, size)
            if not remaining:
                break

    def finish(self) -> bytes:
        self._draw_footer()
        self.c.save()
        return self.buf.getvalue()


def render_pdf(kind: str, payload: dict, *, locale: str, source_revision: str | None) -> bytes:
    rev = source_revision or "n/a"
    footer = f"revision={rev} template={payload.get('templateVersion', 'v1')}"
    if kind == "packing_list":
        title = payload.get("title") or "패킹리스트 / Packing List"
        doc = _PdfDoc(title, footer)
        meta = payload.get("meta") or {}
        doc.newline(title, 16)
        doc.newline(f"Shipper / 송하인: {meta.get('shipper', '')}")
        doc.newline(f"Consignee / 수하인: {meta.get('consignee', '')}")
        doc.newline(f"PO: {meta.get('po', '')}")
        doc.newline("")
        for line in payload.get("lines") or []:
            doc.newline(
                f"{line.get('sku')} CTN {line.get('cartonFrom')}-{line.get('cartonTo')} "
                f"x{line.get('qtyPerCarton')} GW {float(line.get('grossKg') or 0):.2f}kg"
            )
        totals = payload.get("totals") or {}
        doc.newline(
            f"TOTAL cartons={totals.get('cartonCount')} qty={totals.get('totalQty')} "
            f"GW={float(totals.get('grossKg') or 0):.2f} NW={float(totals.get('netKg') or 0):.2f} "
            f"CBM={float(totals.get('cbm') or 0):.3f}",
            11,
        )
        return doc.finish()

    if kind == "commercial_invoice":
        title = payload.get("title") or "상업송장 / Commercial Invoice"
        doc = _PdfDoc(title, footer)
        meta = payload.get("meta") or {}
        doc.newline(title, 16)
        doc.newline(f"Invoice: {meta.get('invoiceNo', '')}  PO: {meta.get('po', '')}")
        doc.newline(f"Seller / 판매자: {meta.get('seller', '')}")
        doc.newline(f"Buyer / 구매자: {meta.get('buyer', '')}")
        doc.newline(
            f"Currency: {meta.get('currency', '')}  Incoterms: {meta.get('incoterms', '')}"
        )
        doc.newline(f"Payment: {meta.get('paymentTerms', '')}")
        doc.newline("")
        for line in payload.get("lines") or []:
            amount = float(line.get("qty") or 0) * float(line.get("unitPrice") or 0)
            doc.newline(
                f"{line.get('sku')} | {line.get('description')} | "
                f"{line.get('qty')} {line.get('unit')} @ {float(line.get('unitPrice') or 0):.2f} = {amount:.2f}"
            )
        totals = payload.get("totals") or {}
        doc.newline(
            f"TOTAL {meta.get('currency', '')} {float(totals.get('computedTotal') or 0):.2f}",
            12,
        )
        doc.newline("")
        doc.newline(str(payload.get("disclaimer") or ""), 8)
        return doc.finish()

    title = payload.get("title") or "서류 대조 / Document Diff"
    doc = _PdfDoc(title, footer)
    doc.newline(title, 16)
    diffs = payload.get("diffs") or []
    doc.newline(f"Differences: {len(diffs)}")
    doc.newline(f"Match mode: {payload.get('matchMode', 'sku+carton')}")
    doc.newline("")
    for d in diffs:
        doc.newline(f"[{d.get('kind')}] {d.get('key')} — {d.get('hint') or d.get('messageCode')}")
    return doc.finish()
