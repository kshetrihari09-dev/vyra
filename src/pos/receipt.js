/* The sale receipt, as one self-contained HTML document (80 mm thermal layout). It is used twice, from the same string:
   shown in an isolated preview <iframe srcdoc>, and printed from that same iframe — so what the cashier sees is what comes out of the printer,
   and none of the app's CSS can leak into (or be broken by) the printout. Every dynamic value is HTML-escaped: a product named
   `<img src=x onerror=…>` prints as text. Pure, unit-tested in receipt.test.js. */

export const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const METHOD = { cash: "Cash", card: "Card", upi: "UPI" };

/**
 * @param sale     the sale exactly as the server returned it (number, totals, discount, payment, items, storeName, cashierName, placedAt…)
 * @param business { name, address?, phone? }
 * @param money    (n) => string
 */
export function receiptHtml(sale, business, money) {
  const e = escapeHtml;
  const when = new Date(sale.placedAt);
  const dateText = Number.isNaN(when.getTime()) ? "" : when.toLocaleString();
  const t = sale.totals; const p = sale.payment;
  const row = (label, value, cls = "") => `<tr class="${cls}"><td>${e(label)}</td><td class="r">${e(value)}</td></tr>`;
  const lines = sale.items.map((it) => `
    <div class="item"><div class="nm">${e(it.name)}</div>
      <div class="ln"><span>${e(it.qty)} × ${e(money(it.unitPrice))}</span><span>${e(money(it.lineTotal))}</span></div>
      ${it.discount > 0 ? `<div class="ln sub"><span>Discount</span><span>−${e(money(it.discount))}</span></div>` : ""}
    </div>`).join("");
  const discountLabel = sale.discount?.type === "percent" ? `Discount (${e(sale.discount.value)}%)` : "Discount";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${e(sale.number)}</title><style>
@page { size: 80mm auto; margin: 3mm; }
* { box-sizing: border-box; }
body { font: 12px/1.4 "Courier New", ui-monospace, monospace; color: #000; background: #fff; width: 74mm; max-width: 100%; margin: 0 auto; padding: 4px; }
h1 { font-size: 15px; margin: 0; text-align: center; } .c { text-align: center; } .r { text-align: right; } .muted { color: #444; }
hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
.item { margin: 4px 0; } .nm { font-weight: bold; word-break: break-word; } .ln { display: flex; justify-content: space-between; gap: 8px; } .sub { color: #444; font-size: 11px; }
.total td { font-size: 14px; font-weight: bold; padding-top: 4px; border-top: 1px solid #000; }
@media print { body { width: auto; } }
</style></head><body>
<h1>${e(business.name)}</h1>
<div class="c muted">${e(sale.storeName || "")}${business.address ? `<br>${e(business.address)}` : ""}${business.phone ? `<br>${e(business.phone)}` : ""}</div>
<hr>
<table>${row("Invoice", `#${sale.number}`)}${row("Date", dateText)}${sale.cashierName ? row("Cashier", sale.cashierName) : ""}${sale.customerName ? row("Customer", sale.customerName) : ""}</table>
<hr>${lines}<hr>
<table>
${row("Subtotal", money(t.subtotal))}
${t.discount > 0 ? row(discountLabel, `−${money(t.discount)}`) : ""}
${t.tax > 0 ? row("Tax", money(t.tax)) : ""}
${row("TOTAL", money(t.total), "total")}
</table>
<hr>
<table>
${row("Payment", METHOD[p.method] || p.method)}
${p.method === "cash" ? row("Received", money(p.received)) + row("Change", money(p.change)) : ""}
</table>
<hr><div class="c">Thank you for shopping with us!</div>
</body></html>`;
}

/** Prints an already-rendered receipt iframe (the preview). Falls back to a hidden iframe built from `html` when none is given. */
export function printReceipt({ frame, html }) {
  let target = frame;
  let cleanup = () => {};
  if (!target) {
    target = document.createElement("iframe");
    target.setAttribute("aria-hidden", "true");
    Object.assign(target.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    target.srcdoc = html;
    document.body.appendChild(target);
    cleanup = () => setTimeout(() => target.remove(), 1000);
    target.onload = () => { target.contentWindow.focus(); target.contentWindow.print(); cleanup(); };
    return;
  }
  target.contentWindow.focus();
  target.contentWindow.print();
}
