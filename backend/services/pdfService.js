const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to format currency with rupee symbol
const formatRupees = (amount) => {
  // Using Rs. for better PDF compatibility
  return 'Rs. ' + parseFloat(amount).toFixed(2);
};

const generateBillPDF = async (bill, format = 'standard') => {
  return new Promise((resolve, reject) => {
    try {
      const billsDir = path.join(__dirname, '..', 'bills');
      if (!fs.existsSync(billsDir)) {
        fs.mkdirSync(billsDir, { recursive: true });
      }

      const fileName = `bill_${bill.billNumber}_${format}_${Date.now()}.pdf`;
      const filePath = path.join(billsDir, fileName);

      // Check if roll / thermal receipt format requested (80mm width = ~226pt)
      const isRoll = format === 'roll' || format === 'thermal' || format === '80mm';

      if (isRoll) {
        // Calculate dynamic height based on item count
        const itemCount = bill.BillItems ? bill.BillItems.length : 0;
        const estimatedHeight = Math.max(350, 260 + (itemCount * 24));

        const doc = new PDFDocument({
          size: [226, estimatedHeight], // 80mm thermal roll paper width
          margin: 10,
          autoFirstPage: true
        });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = 226;
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        // Header
        doc.fontSize(14).font('Helvetica-Bold').text(bill.User?.shopName || 'The Market Masters', margin, 10, { align: 'center', width: contentWidth });
        
        let y = 28;
        doc.fontSize(8).font('Helvetica');
        if (bill.User?.shopAddress) {
          doc.text(bill.User.shopAddress, margin, y, { align: 'center', width: contentWidth });
          y += 12;
        }
        doc.text(`Phone: ${bill.User?.phone || 'N/A'}`, margin, y, { align: 'center', width: contentWidth });
        y += 14;

        // Divider
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).stroke('#000');
        y += 6;

        doc.fontSize(10).font('Helvetica-Bold').text('TAX INVOICE', margin, y, { align: 'center', width: contentWidth });
        y += 14;

        doc.fontSize(8).font('Helvetica');
        doc.text(`Bill #: ${bill.billNumber}`, margin, y);
        doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString('en-IN')}`, margin, y + 10);
        doc.text(`Customer: ${bill.customerName || 'Walk-in'}`, margin, y + 20);
        if (bill.customerPhone) {
          doc.text(`Phone: ${bill.customerPhone}`, margin, y + 30);
          y += 10;
        }
        y += 44;

        // Table Header
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#000');
        y += 4;
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Item', margin, y, { width: 100 });
        doc.text('Qty', margin + 100, y, { width: 30, align: 'center' });
        doc.text('Rate', margin + 130, y, { width: 35, align: 'right' });
        doc.text('Amt', margin + 165, y, { width: 41, align: 'right' });
        y += 12;
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#000');
        y += 6;

        // Items
        doc.fontSize(7.5).font('Helvetica');
        bill.BillItems.forEach(item => {
          let name = item.productName;
          if (name.length > 18) name = name.substring(0, 16) + '..';

          doc.text(name, margin, y, { width: 100 });
          doc.text(item.quantity.toString(), margin + 100, y, { width: 30, align: 'center' });
          doc.text(parseFloat(item.unitPrice).toFixed(1), margin + 130, y, { width: 35, align: 'right' });
          doc.text(parseFloat(item.total).toFixed(1), margin + 165, y, { width: 41, align: 'right' });
          y += 14;
        });

        // Totals
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#000');
        y += 6;
        doc.fontSize(8).font('Helvetica');
        doc.text('Subtotal:', margin + 80, y, { width: 60, align: 'right' });
        doc.text(formatRupees(bill.subtotal), margin + 140, y, { width: 66, align: 'right' });
        y += 12;

        if (bill.discount > 0) {
          doc.text('Discount:', margin + 80, y, { width: 60, align: 'right' });
          doc.text(formatRupees(bill.discount), margin + 140, y, { width: 66, align: 'right' });
          y += 12;
        }

        doc.fontSize(9.5).font('Helvetica-Bold');
        doc.text('TOTAL:', margin + 80, y, { width: 60, align: 'right' });
        doc.text(formatRupees(bill.totalAmount), margin + 140, y, { width: 66, align: 'right' });
        y += 16;

        doc.fontSize(8).font('Helvetica');
        doc.text(`Paid: ${formatRupees(bill.paidAmount)}`, margin, y);
        doc.text(`Due: ${formatRupees(bill.dueAmount)}`, margin + 100, y, { width: 106, align: 'right' });
        y += 16;

        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#000');
        y += 8;
        doc.fontSize(8).font('Helvetica-Bold').text('Thank You! Visit Again', margin, y, { align: 'center', width: contentWidth });

        doc.end();
        stream.on('finish', () => resolve(`/bills/${fileName}`));
        stream.on('error', reject);
        return;
      }

      // Standard A4 Format
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 36,
        layout: 'portrait',
        autoFirstPage: true
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 36;
      const contentWidth = pageWidth - (margin * 2);

      // ========== HEADER SECTION ==========
      // Shop Name
      doc.fontSize(24).font('Helvetica-Bold').text(bill.User?.shopName || 'The Market Masters', margin, margin, { align: 'center', width: contentWidth });
      
      // Shop Address & Phone
      doc.fontSize(10).font('Helvetica');
      let addressY = margin + 30;
      if (bill.User?.shopAddress) {
        doc.text(bill.User.shopAddress, margin, addressY, { align: 'center', width: contentWidth });
        addressY += 16;
      }
      doc.text(`Phone: ${bill.User?.phone || 'N/A'}`, margin, addressY, { align: 'center', width: contentWidth });

      // Invoice Title
      addressY += 25;
      doc.fontSize(18).font('Helvetica-Bold').text('INVOICE', margin, addressY, { align: 'center', width: contentWidth });
      
      // Bill Details
      doc.fontSize(10).font('Helvetica');
      addressY += 22;
      doc.text(`Bill #: ${bill.billNumber}`, margin, addressY, { align: 'center', width: contentWidth });
      addressY += 16;
      doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString('en-IN')}`, margin, addressY, { align: 'center', width: contentWidth });
      
      // Status with color
      addressY += 20;
      const statusColor = bill.paymentStatus === 'Paid' ? '#28a745' : 
                         bill.paymentStatus === 'Partially Paid' ? '#ffc107' : '#dc3545';
      doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(11);
      doc.text(`Status: ${bill.paymentStatus}`, margin, addressY, { align: 'center', width: contentWidth });
      doc.fillColor('#000').font('Helvetica');

      // ========== CUSTOMER SECTION ==========
      addressY += 30;
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', margin, addressY);
      addressY += 18;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${bill.customerName || 'Walk-in Customer'}`, margin, addressY);
      addressY += 16;
      if (bill.customerPhone) {
        doc.text(`Phone: ${bill.customerPhone}`, margin, addressY);
        addressY += 16;
      }

      // ========== ITEMS TABLE ==========
      addressY += 10;
      
      // Table Header Background
      const tableTop = addressY;
      const col1X = margin;           // Item Description
      const col2X = margin + 260;     // Qty
      const col3X = margin + 330;     // Price
      const col4X = margin + 420;     // Amount
      const tableWidth = contentWidth;
      const headerHeight = 25;
      
      doc.rect(col1X, tableTop, tableWidth, headerHeight).fill('#2c5f2d');
      doc.fillColor('#fff');
      
      // Table Header Text
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Item Description', col1X + 10, tableTop + 7, { width: 250 });
      doc.text('Qty', col2X, tableTop + 7, { width: 60, align: 'center' });
      doc.text('Price', col3X, tableTop + 7, { width: 80, align: 'right' });
      doc.text('Amount', col4X, tableTop + 7, { width: 80, align: 'right' });
      
      doc.fillColor('#000');
      
      // Items
      let itemY = tableTop + headerHeight + 10;
      doc.fontSize(10).font('Helvetica');
      const lineHeight = 22;
      
      bill.BillItems.forEach((item, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(col1X, itemY - 5, tableWidth, lineHeight).fill('#f9f9f9');
          doc.fillColor('#000');
        }
        
        // Truncate very long product names
        let productName = item.productName;
        if (productName.length > 40) {
          productName = productName.substring(0, 37) + '...';
        }
        
        doc.text(productName, col1X + 10, itemY, { width: 250 });
        doc.text(item.quantity.toString(), col2X, itemY, { width: 60, align: 'center' });
        doc.text(formatRupees(item.unitPrice), col3X, itemY, { width: 80, align: 'right' });
        doc.text(formatRupees(item.total), col4X, itemY, { width: 80, align: 'right' });
        itemY += lineHeight;
      });

      // Table Bottom Border
      doc.rect(col1X, tableTop, tableWidth, itemY - tableTop + 5).lineWidth(2).stroke('#2c5f2d');

      // ========== TOTALS SECTION ==========
      itemY += 15;
      const totalsX = margin + 300;
      const valueX = margin + 400;
      const totalsWidth = 100;
      
      // Totals background
      doc.rect(totalsX - 20, itemY, contentWidth - (totalsX - margin) + 40, 90).fill('#f5f5f5').stroke('#ddd');
      
      itemY += 10;
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', totalsX, itemY, { width: 80, align: 'right' });
      doc.text(formatRupees(bill.subtotal), valueX, itemY, { width: totalsWidth, align: 'right' });

      itemY += 20;
      if (bill.discount > 0) {
        doc.text('Discount:', totalsX, itemY, { width: 80, align: 'right' });
        doc.text(formatRupees(bill.discount), valueX, itemY, { width: totalsWidth, align: 'right' });
        itemY += 20;
      }

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Total:', totalsX, itemY, { width: 80, align: 'right' });
      doc.fillColor('#2c5f2d');
      doc.text(formatRupees(bill.totalAmount), valueX, itemY, { width: totalsWidth, align: 'right' });
      doc.fillColor('#000');

      // ========== PAYMENT SUMMARY ==========
      itemY += 35;
      doc.fontSize(11).font('Helvetica-Bold').text('Payment Summary:', margin, itemY);
      itemY += 20;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Amount Paid: ${formatRupees(bill.paidAmount)}`, margin, itemY);
      doc.text(`Amount Due: ${formatRupees(bill.dueAmount)}`, margin + 200, itemY);
      
      if (bill.Payments && bill.Payments.length > 0) {
        itemY += 22;
        doc.font('Helvetica-Bold').text('Payment Details:', margin, itemY);
        itemY += 18;
        doc.fontSize(9).font('Helvetica');
        bill.Payments.forEach((payment, index) => {
          doc.text(`${index + 1}. ${payment.paymentMode}: ${formatRupees(payment.amount)}`, margin + 20, itemY);
          itemY += 14;
        });
      }

      // ========== FOOTER ==========
      const footerY = pageHeight - 120;
      
      // Draw a line above footer
      doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).stroke('#2c5f2d');
      
      // Thank you message
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c5f2d');
      doc.text('Thank You for Your Business!', margin, footerY + 15, { align: 'center', width: contentWidth });
      
      // Software name
      doc.fontSize(16).font('Helvetica-Bold');
      doc.text('The Market Masters', margin, footerY + 35, { align: 'center', width: contentWidth });
      
      // Tagline
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666');
      doc.text('"You Manage Your Shop, We\'ll Manage Your Bills"', margin, footerY + 55, { align: 'center', width: contentWidth });

      doc.end();

      stream.on('finish', () => {
        resolve(`/bills/${fileName}`);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateBillPDF };
