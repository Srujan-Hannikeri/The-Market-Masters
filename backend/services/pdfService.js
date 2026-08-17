const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (amount) => 'Rs. ' + parseFloat(amount || 0).toFixed(2);
const logoPath = path.join(__dirname, '..', '..', 'frontend', 'assets', 'logo.jpg');

/**
 * Get a writable directory that works on both local dev and Vercel serverless.
 * Vercel's filesystem is read-only except for /tmp.
 */
const getWritableDir = () => {
  // On Vercel (and any read-only host) use /tmp
  const tmpDir = path.join('/tmp', 'bills');
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  } catch (_) {}
  // Local fallback
  const localDir = path.join(__dirname, '..', 'bills');
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
  return localDir;
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
    const height = Math.max(440, 350 + itemCount * 46);
    return { type: 'roll', width, height, margin: 10, contentWidth: width - 20 };
  }
  if (f === '58mm' || f === 'small') {
    const width = 164;                                 // ~58 mm in points
    const height = Math.max(420, 330 + itemCount * 48);
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
 * @param {Object} [res]    – Express response object. If provided, streams PDF directly (Vercel-safe).
 * @returns {Promise<string>} File path (local) or resolves after stream ends (when res provided)
 */
const generateBillPDF = (bill, format = 'a4', res = null) => {
  return new Promise((resolve, reject) => {
    try {
      const items = bill.BillItems || bill.items || [];
      const shop  = bill.shopkeeperId || {};
      const cfg   = resolveFormat(format, items.length);

      const doc = cfg.type === 'roll'
        ? new PDFDocument({ size: [cfg.width, cfg.height], margin: cfg.margin, autoFirstPage: true })
        : new PDFDocument({ size: cfg.size, margin: cfg.margin, layout: 'portrait', autoFirstPage: true });

      if (res) {
        // ── Vercel-safe: stream directly to HTTP response ──
        const fileName = `bill_${bill.billNumber}_${format}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        doc.pipe(res);
        if (cfg.type === 'roll') buildRollLayout(doc, bill, items, shop, cfg);
        else                     buildPageLayout(doc, bill, items, shop, cfg);
        doc.end();
        res.on('finish', () => resolve(fileName));
        res.on('error', reject);
      } else {
        // ── Local: write to /tmp (or local bills dir) ──
        const dir      = getWritableDir();
        const fileName = `bill_${bill.billNumber}_${format}_${Date.now()}.pdf`;
        const filePath = path.join(dir, fileName);
        const stream   = fs.createWriteStream(filePath);
        doc.pipe(stream);
        if (cfg.type === 'roll') buildRollLayout(doc, bill, items, shop, cfg);
        else                     buildPageLayout(doc, bill, items, shop, cfg);
        doc.end();
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
      }
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
  // ── Shop header ──
  if (fs.existsSync(logoPath)) {
    const logoSize = cx >= 190 ? 34 : 28;
    doc.image(logoPath, margin + (cx - logoSize) / 2, y, { fit: [logoSize, logoSize] });
    y += logoSize + 4;
  }
  doc.fontSize(12).font('Helvetica-Bold')
    .text(shop.shopName || 'The Market Masters', margin, y, { align: 'center', width: cx });
  y += 16;

  doc.fontSize(8).font('Helvetica');
  if (shop.shopAddress) {
    doc.text(shop.shopAddress, margin, y, { align: 'center', width: cx });
    y += 12;
  }
  if (shop.phone) {
    doc.text(`Ph: ${shop.phone}`, margin, y, { align: 'center', width: cx });
    y += 12;
  }
  y += 4;

  // ── Divider ──
  divider(doc, margin, y, width); y += 8;

  doc.fontSize(10).font('Helvetica-Bold')
    .text('TAX INVOICE', margin, y, { align: 'center', width: cx });
  y += 14;

  // ── Bill meta ──
  doc.fontSize(8).font('Helvetica');
  doc.text(`Bill #: ${bill.billNumber}`, margin, y);               y += 11;
  doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString('en-IN')}`, margin, y); y += 11;
  doc.text(`Customer: ${bill.customerName || 'Walk-in'}`, margin, y); y += 11;
  if (bill.customerPhone) { doc.text(`Phone: ${bill.customerPhone}`, margin, y); y += 11; }
  y += 4;

  divider(doc, margin, y, width); y += 8;

  // ── Column setup for roll ──
  const is80 = cx >= 190;
  const colW = is80
    ? { item: cx - 100, qty: 25, rate: 35, amt: 40 }
    : { item: cx - 75,  qty: 20, rate: 25, amt: 30 };

  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('Item',  margin,                         y, { width: colW.item });
  doc.text('Qty',   margin + colW.item,             y, { width: colW.qty,  align: 'center' });
  if (is80) doc.text('Rate', margin + colW.item + colW.qty, y, { width: colW.rate, align: 'right' });
  doc.text('Amt',   margin + colW.item + colW.qty + (is80 ? colW.rate : 0), y, { width: colW.amt, align: 'right' });
  y += 12;

  divider(doc, margin, y, width); y += 6;

  // ── Items ──
  doc.fontSize(8).font('Helvetica');
  items.forEach(item => {
    let name = item.productName || '';
    const rate = parseFloat(item.unitPrice || 0);
    const total = parseFloat(item.total || 0);
    
    const textHeight = doc.heightOfString(name, { width: colW.item });
    
    doc.text(name, margin, y, { width: colW.item });
    doc.text(String(item.quantity), margin + colW.item, y, { width: colW.qty, align: 'center' });
    if (is80) doc.text(rate.toFixed(2), margin + colW.item + colW.qty, y, { width: colW.rate, align: 'right' });
    doc.text(total.toFixed(2), margin + colW.item + colW.qty + (is80 ? colW.rate : 0), y, { width: colW.amt, align: 'right' });
    
    y += textHeight + 4;
  });

  divider(doc, margin, y, width); y += 6;

  // ── Totals ──
  const labelX = margin;
  const valueW = cx;
  doc.fontSize(8).font('Helvetica');

  doc.text('Subtotal:', labelX, y, { width: cx * 0.5, align: 'left' });
  doc.text(fmt(bill.subtotal), labelX + cx * 0.5, y, { width: cx * 0.5, align: 'right' });
  y += 12;

  if (parseFloat(bill.discount) > 0) {
    doc.text('Discount:', labelX, y, { width: cx * 0.5, align: 'left' });
    doc.text(fmt(bill.discount), labelX + cx * 0.5, y, { width: cx * 0.5, align: 'right' });
    y += 12;
  }

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('TOTAL:', labelX, y, { width: cx * 0.5, align: 'left' });
  doc.text(fmt(bill.totalAmount), labelX + cx * 0.5, y, { width: cx * 0.5, align: 'right' });
  y += 14;

  divider(doc, margin, y, width); y += 6;

  doc.fontSize(8).font('Helvetica');
  doc.text(`Paid: ${fmt(bill.paidAmount)}`, margin, y);
  doc.text(`Due: ${fmt(bill.balanceAmount)}`, labelX + cx * 0.5, y, { width: cx * 0.5, align: 'right' });
  y += 12;

  // ── Payment mode ──
  if (bill.paymentMode) {
    doc.text(`Mode: ${bill.paymentMode}`, margin, y); y += 12;
  }

  divider(doc, margin, y, width); y += 10;

  doc.fontSize(9).font('Helvetica-Bold')
    .text('Thank You! Visit Again', margin, y, { align: 'center', width: cx });
  y += 14;
  doc.fontSize(7).font('Helvetica').fillColor('#555')
    .text('Powered by The Market Masters', margin, y, { align: 'center', width: cx });
};

// ─── Page Layout (A4, A3, A5, Letter) ─────────────────────────────────────────

const buildPageLayout = (doc, bill, items, shop, cfg) => {
  const { margin } = cfg;
  const PW = doc.page.width;
  const PH = doc.page.height;
  const CW = PW - margin * 2;    // content width
  const smallPaper = CW < 400;

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
  const headerH = smallPaper ? 78 : 92;
  doc.rect(margin, y, CW, headerH).fill(GREEN);

  // Compact logo tile and shop identity
  const logoBox = smallPaper ? 46 : 60;
  const logoX = margin + 12;
  const logoY = y + (headerH - logoBox) / 2;
  doc.roundedRect(logoX, logoY, logoBox, logoBox, 6).fill('#ffffff');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, logoX + 4, logoY + 4, { fit: [logoBox - 8, logoBox - 8] });
  }

  const shopX = logoX + logoBox + 12;
  const invoiceW = smallPaper ? 68 : 112;
  doc.fillColor('#ffffff').fontSize(smallPaper ? 14 : 20).font('Helvetica-Bold')
    .text(shop.shopName || 'The Market Masters', shopX, y + (smallPaper ? 16 : 18), { width: CW - (shopX - margin) - invoiceW - 16 });

  doc.fontSize(smallPaper ? 7 : 8.5).font('Helvetica');
  let subY = y + (smallPaper ? 39 : 48);
  if (shop.shopAddress) {
    doc.text(shop.shopAddress, shopX, subY, { width: CW - (shopX - margin) - invoiceW - 16 });
    subY += smallPaper ? 10 : 12;
  }
  if (shop.phone) {
    doc.text(`Phone: ${shop.phone}`, shopX, subY, { width: CW - (shopX - margin) - invoiceW - 16 });
  }

  // Invoice marker
  const invoiceX = margin + CW - invoiceW - 12;
  doc.roundedRect(invoiceX, y + (headerH - 32) / 2, invoiceW, 32, 5).fill('#dff3e3');
  doc.fontSize(smallPaper ? 10 : 14).font('Helvetica-Bold').fillColor(GREEN)
    .text('INVOICE', invoiceX, y + (headerH - 8) / 2, { width: invoiceW, align: 'center' });

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

  // A5 has less horizontal room, so its table intentionally uses fewer
  // columns. This avoids clipped amounts while retaining the useful details.
  const compactPage = CW < 400;
  const cols = compactPage
    ? {
        no: 22,
        name: Math.floor(CW * 0.52),
        qty: 30,
        mrp: 0,
        price: 0,
        total: CW - 22 - Math.floor(CW * 0.52) - 30
      }
    : {
        no: 30,
        name: Math.floor(CW * 0.38),
        qty: Math.floor(CW * 0.09),
        mrp: Math.floor(CW * 0.14),
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

  const drawTableHeader = () => {
    doc.rect(margin, y, CW, headH).fill(GREEN);
    doc.fillColor('#ffffff').fontSize(compactPage ? 8 : 9.5).font('Helvetica-Bold');
    doc.text('#', colX.no + 3, y + 9, { width: cols.no - 3 });
    doc.text('Description', colX.name + 3, y + 9, { width: cols.name - 3 });
    doc.text('Qty', colX.qty, y + 9, { width: cols.qty, align: 'center' });
    if (!compactPage) {
      doc.text('MRP', colX.mrp, y + 9, { width: cols.mrp, align: 'right' });
      doc.text('Price', colX.price, y + 9, { width: cols.price, align: 'right' });
    }
    doc.text('Amount', colX.total, y + 9, { width: cols.total, align: 'right' });
    y += headH;
  };
  drawTableHeader();

  // Rows
  doc.fontSize(9).font('Helvetica');
  items.forEach((item, idx) => {
    // Keep the summary and footer clear on every page. A new page repeats the
    // table header so multi-page A4/A3 invoices remain easy to read.
    if (y + rowH > PH - margin - 150) {
      doc.addPage();
      y = margin;
      drawTableHeader();
      doc.fontSize(compactPage ? 8 : 9).font('Helvetica');
    }
    // Zebra stripe
    if (idx % 2 === 0) doc.rect(margin, y, CW, rowH).fill(LGTEEN);
    else doc.rect(margin, y, CW, rowH).fill('#ffffff');

    doc.fillColor(DGRAY);
    doc.text(String(idx + 1),          colX.no    + 3,  y + 8, { width: cols.no - 3 });

    let name = item.productName || '';
    if (name.length > 42) name = name.substring(0, 39) + '...';
    doc.text(name,                     colX.name  + 3,  y + 8, { width: cols.name - 6 });
    doc.text(String(item.quantity),    colX.qty,         y + 8, { width: cols.qty,   align: 'center' });
    if (!compactPage) {
      doc.text(fmt(item.mrp || item.unitPrice), colX.mrp, y + 8, { width: cols.mrp, align: 'right' });
      doc.text(fmt(item.unitPrice), colX.price, y + 8, { width: cols.price, align: 'right' });
    }
    doc.fillColor(GREEN).font('Helvetica-Bold')
      .text(fmt(item.total),           colX.total,       y + 8, { width: cols.total, align: 'right' });
    doc.fillColor(DGRAY).font('Helvetica');

    y += rowH;
  });

  y += 10;

  // ══════════════════════════════════════════
  // TOTALS + PAYMENT SUMMARY
  // ══════════════════════════════════════════
  if (y + 130 > PH - margin - 55) {
    doc.addPage();
    y = margin;
  }

  const totW = compactPage ? CW : Math.floor(CW * 0.38);
  const totX = margin + CW - totW;
  const totalsStartY = y; // Save original Y coordinate before mutating it with tRow

  // Totals panel background
  doc.rect(totX - 8, totalsStartY, totW + 8, 110).fill(GRAY).stroke('#dddddd');

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
  const payW = compactPage ? 0 : CW - totW - 30;
  const payStartY = totalsStartY; // Use the saved Y coordinate to correctly align left box

  if (!compactPage) {
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
  }

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
