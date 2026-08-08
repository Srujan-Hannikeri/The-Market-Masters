const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (amount) => 'Rs. ' + parseFloat(amount || 0).toFixed(2);

const ensureBillsDir = () => {
  const dir = path.join(__dirname, '..', 'bills');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Resolve the paper size configuration from the format string.
 * Supported formats:
 *   'a4'       → ISO A4  (595 × 842 pt)
 *   'a3'       → ISO A3  (842 × 1190 pt)
 *   'a5'       → ISO A5  (420 × 595 pt)
 *   'letter'   → US Letter (612 × 792 pt)
 *   '80mm'  / 'roll'    / 'thermal' → 80 mm thermal roll (226 pt wide, dynamic height)
 *   '58mm'  / 'small'               → 58 mm thermal roll (164 pt wide, dynamic height)
 */
const resolveFormat = (format = 'a4', itemCount = 0) => {
  const f = format.toLowerCase();

  // ── Thermal roll formats ──────────────────────────────────────────────────
  if (f === '80mm' || f === 'roll' || f === 'thermal') {
    const width = 226;                                 // ~80 mm in points
    const height = Math.max(400, 300 + itemCount * 28);
    return { type: 'roll', width, height, margin: 10, contentWidth: width - 20 };
  }
  if (f === '58mm' || f === 'small') {
    const width = 164;                                 // ~58 mm in points
    const height = Math.max(360, 280 + itemCount * 26);
    return { type: 'roll', width, height, margin: 8, contentWidth: 164 - 16 };
  }

  // ── Named page sizes ──────────────────────────────────────────────────────
  const sizeMap = { a4: 'A4', a3: 'A3', a5: 'A5', letter: 'LETTER' };
  const size = sizeMap[f] || 'A4';
  return { type: 'page', size, margin: 40 };
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a bill PDF.
 * @param {Object} bill     – Mongoose Bill document (shopkeeperId populated)
 * @param {string} format   – 'a4' | 'a3' | 'a5' | 'letter' | '80mm' | '58mm'
 * @returns {Promise<string>} URL path like /bills/<filename>
 */
const generateBillPDF = (bill, format = 'a4') => {
  return new Promise((resolve, reject) => {
    try {
      const billsDir = ensureBillsDir();
      const fileName = `bill_${bill.billNumber}_${format}_${Date.now()}.pdf`;
      const filePath = path.join(billsDir, fileName);

      const items = bill.BillItems || bill.items || [];
      const shop = bill.shopkeeperId || {};
      const cfg = resolveFormat(format, items.length);

      const doc = cfg.type === 'roll'
        ? new PDFDocument({ size: [cfg.width, cfg.height], margin: cfg.margin, autoFirstPage: true })
        : new PDFDocument({ size: cfg.size, margin: cfg.margin, layout: 'portrait', autoFirstPage: true });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      if (cfg.type === 'roll') {
        buildRollLayout(doc, bill, items, shop, cfg);
      } else {
        buildPageLayout(doc, bill, items, shop, cfg);
      }

      doc.end();
      stream.on('finish', () => resolve(`/bills/${fileName}`));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
};

// ─── Roll / Thermal Layout ────────────────────────────────────────────────────

const buildRollLayout = (doc, bill, items, shop, cfg) => {
  const { width, margin, contentWidth } = cfg;
  const cx = contentWidth;   // alias

  let y = margin;

  // ── Shop header ──
  doc.fontSize(11).font('Helvetica-Bold')
    .text(shop.shopName || 'The Market Masters', margin, y, { align: 'center', width: cx });
  y += 14;

  doc.fontSize(7).font('Helvetica');
  if (shop.shopAddress) {
    doc.text(shop.shopAddress, margin, y, { align: 'center', width: cx });
    y += 10;
  }
  if (shop.phone) {
    doc.text(`Ph: ${shop.phone}`, margin, y, { align: 'center', width: cx });
    y += 10;
  }
  y += 4;

  // ── Divider ──
  divider(doc, margin, y, width); y += 8;

  doc.fontSize(9).font('Helvetica-Bold')
    .text('TAX INVOICE', margin, y, { align: 'center', width: cx });
  y += 13;

  // ── Bill meta ──
  doc.fontSize(7).font('Helvetica');
  doc.text(`Bill #: ${bill.billNumber}`, margin, y);               y += 9;
  doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString('en-IN')}`, margin, y); y += 9;
  doc.text(`Customer: ${bill.customerName || 'Walk-in'}`, margin, y); y += 9;
  if (bill.customerPhone) { doc.text(`Phone: ${bill.customerPhone}`, margin, y); y += 9; }
  y += 4;

  divider(doc, margin, y, width); y += 6;

  // ── Column setup for roll ──
  // Narrow roll: Item | Qty | Amt
  // 80mm (cx ≈ 206):  item=100, qty=36, rate=36, amt=34
  // 58mm (cx ≈ 148):  item=70,  qty=28, rate=26, amt=24
  const is80 = cx >= 190;
  const colW = is80
    ? { item: 100, qty: 32, rate: 38, amt: cx - 170 }
    : { item: 68,  qty: 24, rate: 28, amt: cx - 120 };

  doc.fontSize(7.5).font('Helvetica-Bold');
  doc.text('Item',  margin,                         y, { width: colW.item });
  doc.text('Qty',   margin + colW.item,             y, { width: colW.qty,  align: 'center' });
  if (is80) doc.text('Rate', margin + colW.item + colW.qty, y, { width: colW.rate, align: 'right' });
  doc.text('Amt',   margin + colW.item + colW.qty + (is80 ? colW.rate : 0), y, { width: colW.amt, align: 'right' });
  y += 11;

  divider(doc, margin, y, width); y += 5;

  // ── Items ──
  doc.fontSize(7).font('Helvetica');
  items.forEach(item => {
    const maxName = is80 ? 18 : 12;
    let name = item.productName || '';
    if (name.length > maxName) name = name.substring(0, maxName - 2) + '..';
    const rate = parseFloat(item.unitPrice || 0);
    const total = parseFloat(item.total || 0);
    const rateStr = 'Rs.' + rate.toFixed(0);
    const totalStr = 'Rs.' + total.toFixed(0);

    doc.text(name, margin, y, { width: colW.item });
    doc.text(String(item.quantity), margin + colW.item, y, { width: colW.qty, align: 'center' });
    if (is80) doc.text(rateStr, margin + colW.item + colW.qty, y, { width: colW.rate, align: 'right' });
    doc.text(totalStr, margin + colW.item + colW.qty + (is80 ? colW.rate : 0), y, { width: colW.amt, align: 'right' });
    y += 12;
  });

  divider(doc, margin, y, width); y += 6;

  // ── Totals ──
  const labelX = margin + Math.floor(cx * 0.35);
  const valueW = cx - Math.floor(cx * 0.35);
  doc.fontSize(7.5).font('Helvetica');

  doc.text('Subtotal:', labelX, y, { width: cx * 0.35, align: 'right' });
  doc.text(fmt(bill.subtotal), labelX + cx * 0.35, y, { width: valueW, align: 'right' });
  y += 11;

  if (parseFloat(bill.discount) > 0) {
    doc.text('Discount:', labelX, y, { width: cx * 0.35, align: 'right' });
    doc.text(fmt(bill.discount), labelX + cx * 0.35, y, { width: valueW, align: 'right' });
    y += 11;
  }

  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('TOTAL:', labelX, y, { width: cx * 0.35, align: 'right' });
  doc.text(fmt(bill.totalAmount), labelX + cx * 0.35, y, { width: valueW, align: 'right' });
  y += 14;

  divider(doc, margin, y, width); y += 6;

  doc.fontSize(7).font('Helvetica');
  doc.text(`Paid: ${fmt(bill.paidAmount)}`, margin, y);
  doc.text(`Due: ${fmt(bill.balanceAmount)}`, labelX, y, { width: valueW + cx * 0.35, align: 'right' });
  y += 11;

  // ── Payment mode ──
  if (bill.paymentMode) {
    doc.text(`Mode: ${bill.paymentMode}`, margin, y); y += 11;
  }

  divider(doc, margin, y, width); y += 8;

  doc.fontSize(7.5).font('Helvetica-Bold')
    .text('Thank You! Visit Again', margin, y, { align: 'center', width: cx });
  y += 11;
  doc.fontSize(6.5).font('Helvetica').fillColor('#555')
    .text('Powered by The Market Masters', margin, y, { align: 'center', width: cx });
};

// ─── Page Layout (A4, A3, A5, Letter) ─────────────────────────────────────────

const buildPageLayout = (doc, bill, items, shop, cfg) => {
  const { margin } = cfg;
  const PW = doc.page.width;
  const PH = doc.page.height;
  const CW = PW - margin * 2;    // content width

  // Brand colours
  const GREEN  = '#2c5f2d';
  const LGTEEN = '#e8f5e9';
  const GRAY   = '#f5f5f5';
  const DGRAY  = '#333333';
  const MID    = '#555555';

  let y = margin;

  // ══════════════════════════════════════════
  // HEADER BAND
  // ══════════════════════════════════════════
  const headerH = 90;
  doc.rect(margin, y, CW, headerH).fill(GREEN);

  // Shop name
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
    .text(shop.shopName || 'The Market Masters', margin + 10, y + 10, { width: CW - 20, align: 'center' });

  doc.fontSize(9).font('Helvetica');
  let subY = y + 38;
  if (shop.shopAddress) {
    doc.text(shop.shopAddress, margin + 10, subY, { width: CW - 20, align: 'center' });
    subY += 14;
  }
  if (shop.phone) {
    doc.text(`Phone: ${shop.phone}`, margin + 10, subY, { width: CW - 20, align: 'center' });
  }

  // "INVOICE" badge on right side of header
  doc.fontSize(28).font('Helvetica-Bold').fillColor('rgba(255,255,255,0.15)')
    .text('INVOICE', PW - margin - 160, y + 25, { width: 150, align: 'right' });

  y += headerH + 14;

  // ══════════════════════════════════════════
  // META ROW  (Bill info left | Customer right)
  // ══════════════════════════════════════════
  const colW2 = (CW - 16) / 2;

  // Left box — bill info
  doc.rect(margin, y, colW2, 80).fill(GRAY).stroke('#dddddd');
  doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold').text('Bill Details', margin + 10, y + 8);
  doc.fillColor(DGRAY).fontSize(9).font('Helvetica');
  doc.text(`Bill #:`, margin + 10, y + 24);
  doc.font('Helvetica-Bold').text(bill.billNumber, margin + 55, y + 24);
  doc.font('Helvetica').text(`Date:`,   margin + 10, y + 38);
  doc.text(new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), margin + 55, y + 38);
  doc.text(`Mode:`,   margin + 10, y + 52);
  doc.text(bill.paymentMode || 'Cash', margin + 55, y + 52);

  // Right box — customer info
  const rx = margin + colW2 + 16;
  doc.rect(rx, y, colW2, 80).fill(GRAY).stroke('#dddddd');
  doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold').text('Bill To', rx + 10, y + 8);
  doc.fillColor(DGRAY).fontSize(9).font('Helvetica');
  doc.text(bill.customerName || 'Walk-in Customer', rx + 10, y + 24, { width: colW2 - 20 });
  if (bill.customerPhone) doc.text(`Ph: ${bill.customerPhone}`, rx + 10, y + 38);

  // Payment status badge in right box
  const statusColor = bill.paymentStatus === 'Paid' ? '#28a745'
    : bill.paymentStatus === 'Partially Paid' ? '#fd7e14' : '#dc3545';
  doc.roundedRect(rx + colW2 - 90, y + 50, 80, 20, 4).fill(statusColor);
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold')
    .text(bill.paymentStatus, rx + colW2 - 90, y + 57, { width: 80, align: 'center' });

  y += 96;

  // ══════════════════════════════════════════
  // ITEMS TABLE
  // ══════════════════════════════════════════

  // Column widths (proportional to CW)
  const cols = {
    no:    30,
    name:  Math.floor(CW * 0.38),
    qty:   Math.floor(CW * 0.09),
    mrp:   Math.floor(CW * 0.14),
    price: Math.floor(CW * 0.15),
    total: CW - 30 - Math.floor(CW * 0.38) - Math.floor(CW * 0.09) - Math.floor(CW * 0.14) - Math.floor(CW * 0.15)
  };

  const colX = {
    no:    margin,
    name:  margin + cols.no,
    qty:   margin + cols.no + cols.name,
    mrp:   margin + cols.no + cols.name + cols.qty,
    price: margin + cols.no + cols.name + cols.qty + cols.mrp,
    total: margin + cols.no + cols.name + cols.qty + cols.mrp + cols.price
  };

  const rowH = 24;
  const headH = 28;

  // Table header
  doc.rect(margin, y, CW, headH).fill(GREEN);
  doc.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold');
  doc.text('#',          colX.no    + 5,  y + 9, { width: cols.no - 5 });
  doc.text('Description',colX.name  + 5,  y + 9, { width: cols.name - 5 });
  doc.text('Qty',        colX.qty,         y + 9, { width: cols.qty,   align: 'center' });
  doc.text('MRP',        colX.mrp,         y + 9, { width: cols.mrp,   align: 'right' });
  doc.text('Price',      colX.price,       y + 9, { width: cols.price, align: 'right' });
  doc.text('Amount',     colX.total,       y + 9, { width: cols.total, align: 'right' });

  y += headH;

  // Rows
  doc.fontSize(9).font('Helvetica');
  items.forEach((item, idx) => {
    // Zebra stripe
    if (idx % 2 === 0) doc.rect(margin, y, CW, rowH).fill(LGTEEN);
    else doc.rect(margin, y, CW, rowH).fill('#ffffff');

    doc.fillColor(DGRAY);
    doc.text(String(idx + 1),          colX.no    + 5,  y + 8, { width: cols.no - 5 });

    let name = item.productName || '';
    if (name.length > 42) name = name.substring(0, 39) + '...';
    doc.text(name,                     colX.name  + 5,  y + 8, { width: cols.name - 10 });
    doc.text(String(item.quantity),    colX.qty,         y + 8, { width: cols.qty,   align: 'center' });
    doc.text(fmt(item.mrp || item.unitPrice), colX.mrp, y + 8, { width: cols.mrp,   align: 'right' });
    doc.text(fmt(item.unitPrice),      colX.price,       y + 8, { width: cols.price, align: 'right' });
    doc.fillColor(GREEN).font('Helvetica-Bold')
      .text(fmt(item.total),           colX.total,       y + 8, { width: cols.total, align: 'right' });
    doc.fillColor(DGRAY).font('Helvetica');

    y += rowH;
  });

  // Table bottom border
  doc.rect(margin, y - items.length * rowH - headH, CW, items.length * rowH + headH)
    .lineWidth(1).stroke('#cccccc');
  y += 10;

  // ══════════════════════════════════════════
  // TOTALS + PAYMENT SUMMARY
  // ══════════════════════════════════════════
  const totW = Math.floor(CW * 0.38);
  const totX = margin + CW - totW;

  // Totals panel background
  doc.rect(totX - 8, y, totW + 8, 110).fill(GRAY).stroke('#dddddd');

  const tRow = (label, value, bold = false, color = DGRAY) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(MID)
      .text(label, totX, y + 6, { width: totW - 90, align: 'left' });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color)
      .text(value, totX, y + 6, { width: totW - 8, align: 'right' });
    y += 20;
  };

  y += 8;
  tRow('Subtotal:', fmt(bill.subtotal));
  if (parseFloat(bill.discount) > 0) tRow('Discount:', `- ${fmt(bill.discount)}`);
  if (parseFloat(bill.tax) > 0)      tRow('Tax:',       fmt(bill.tax));

  // Divider inside totals panel
  doc.moveTo(totX, y).lineTo(totX + totW, y).lineWidth(1).stroke('#cccccc'); y += 8;

  tRow('Total:', fmt(bill.totalAmount), true, GREEN);

  // Payment summary (left of totals)
  const payX = margin;
  const payW = CW - totW - 30;
  const payStartY = y - 110 - 8; // align top with totals panel

  doc.rect(payX, payStartY, payW, 110).fill(GRAY).stroke('#dddddd');
  doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold').text('Payment Summary', payX + 10, payStartY + 8);

  doc.fillColor(DGRAY).fontSize(9).font('Helvetica');
  const pRow = (label, value, valueColor = DGRAY) => {
    doc.text(label, payX + 10, payStartY + (pRow._i = (pRow._i || 28) ));
    doc.fillColor(valueColor).font('Helvetica-Bold')
      .text(value, payX + 120, payStartY + pRow._i, { width: payW - 130, align: 'right' });
    doc.fillColor(DGRAY).font('Helvetica');
    pRow._i += 18;
  };
  pRow('Amount Paid:', fmt(bill.paidAmount), '#28a745');
  pRow('Balance Due:', fmt(bill.balanceAmount), bill.balanceAmount > 0 ? '#dc3545' : '#28a745');
  pRow('Payment Mode:', bill.paymentMode || 'Cash');
  pRow('Status:', bill.paymentStatus, statusColor);

  y += 16;

  // ══════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════
  const footerY = PH - margin - 55;

  doc.moveTo(margin, footerY).lineTo(margin + CW, footerY).lineWidth(1).stroke('#cccccc');

  doc.fillColor(GREEN).fontSize(11).font('Helvetica-Bold')
    .text('Thank You for Your Business!', margin, footerY + 10, { align: 'center', width: CW });

  doc.fillColor(MID).fontSize(8).font('Helvetica')
    .text('"You Manage Your Shop, We\'ll Manage Your Bills" — The Market Masters',
      margin, footerY + 28, { align: 'center', width: CW });

  doc.fillColor('#aaaaaa').fontSize(7)
    .text(`Generated on ${new Date().toLocaleString('en-IN')}`,
      margin, footerY + 42, { align: 'center', width: CW });
};

// ─── Utility ──────────────────────────────────────────────────────────────────

const divider = (doc, x, y, pageWidth) => {
  doc.moveTo(x, y).lineTo(pageWidth - x, y).lineWidth(0.5).dash(2, { space: 2 }).stroke('#555').undash();
};

module.exports = { generateBillPDF };
