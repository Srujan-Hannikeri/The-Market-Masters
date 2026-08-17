const { Bill, Product, Payment, User, Order } = require('../models');
const { generateBillPDF } = require('../services/pdfService');
const { sendBillWhatsApp } = require('../services/whatsappService');

const generateBillNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `BILL-${timestamp}-${random}`;
};

const calculatePaymentStatus = (totalAmount, paidAmount) => {
  if (paidAmount >= totalAmount) return 'Paid';
  if (paidAmount === 0) return 'Pending';
  return 'Partially Paid';
};

exports.getAllBills = async (req, res) => {
  try {
    const { status, customerPhone, search, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (req.user.role === 'shopkeeper') {
      query.shopkeeperId = req.user.id;
    } else if (req.user.role === 'customer') {
      // Match by customerId (ObjectId) OR customerPhone so bills are
      // always found even when phone is empty
      query.$or = [
        { customerId: req.user.id },
        { customerPhone: req.user.phone }
      ];
      // Remove phone-only condition if phone is empty/N/A
      if (!req.user.phone || req.user.phone === 'N/A') {
        delete query.$or;
        query.customerId = req.user.id;
      }
    }

    if (status) query.paymentStatus = status;
    if (customerPhone && req.user.role === 'shopkeeper') {
      query.customerPhone = customerPhone;
    }
    if (search) {
      query.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!isNaN(s) && !isNaN(e)) {
        e.setHours(23, 59, 59, 999);
        query.created_at = { $gte: s, $lte: e };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const count = await Bill.countDocuments(query);
    const bills = await Bill.find(query)
      .populate('shopkeeperId', 'name shopName')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      bills,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bills.', error: error.message });
  }
};

exports.getCustomerBills = async (req, res) => {
  try {
    // Query by customerId (ObjectId) OR customerPhone so bills created
    // from both the billing page (phone-based) and online orders
    // (customerId-based) are always returned
    const query = {
      $or: [
        { customerId: req.user.id },
        { customerPhone: req.user.phone }
      ]
    };
    // If phone is missing/N/A, only match by ID
    if (!req.user.phone || req.user.phone === 'N/A') {
      delete query.$or;
      query.customerId = req.user.id;
    }

    const bills = await Bill.find(query)
      .populate('shopkeeperId', 'name shopName shopAddress phone upiId upiQrCode')
      .sort({ created_at: -1 });

    res.json({ bills });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer bills.', error: error.message });
  }
};

exports.getBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('shopkeeperId', 'name shopName shopAddress phone upiId upiQrCode')
      .populate('items.productId', 'name costPrice mrp');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    // Attach payments for history display
    const payments = await Payment.find({ billId: bill._id }).sort({ created_at: -1 });
    const billObj = bill.toJSON();
    billObj.Payments = payments;

    res.json({ bill: billObj });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bill.', error: error.message });
  }
};

exports.createBill = async (req, res) => {
  try {
    const { customerName, customerPhone, items, discount = 0, paidAmount = 0, paymentMode, dueDate, notes } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required.' });
    }

    let subtotal = 0;
    const billItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
      }

      const unitPrice = Number(product.mrp || product.price || 0);
      const total = unitPrice * item.quantity;
      subtotal += total;
      billItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: unitPrice,
        mrp: product.mrp || product.price,
        total
      });

      product.stock -= item.quantity;
      await product.save();
    }

    const totalAmount = subtotal - discount;
    const balanceAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = calculatePaymentStatus(totalAmount, paidAmount);

    const bill = await Bill.create({
      billNumber: generateBillNumber(),
      shopkeeperId: req.user.id,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || 'N/A',
      items: billItems,
      subtotal,
      discount,
      totalAmount,
      paidAmount,
      balanceAmount,
      paymentMode: paymentMode || 'Cash',
      paymentStatus,
      notes: notes || ''
    });

    if (paidAmount > 0 && paymentMode) {
      await Payment.create({
        billId: bill._id,
        shopkeeperId: req.user.id,
        amount: paidAmount,
        paymentMode,
        paymentStatus: 'Paid',
        notes: 'Initial payment'
      });
    }

    const billWithDetails = await Bill.findById(bill._id)
      .populate('shopkeeperId', 'name shopName shopAddress phone');

    if (customerPhone) {
      try {
        await sendBillWhatsApp(billWithDetails);
      } catch (e) {}
    }

    res.status(201).json({
      message: 'Bill created successfully.',
      bill: billWithDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating bill.', error: error.message });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    const { customerName, customerPhone, discount, notes } = req.body;
    
    if (customerName) bill.customerName = customerName;
    if (customerPhone) bill.customerPhone = customerPhone;
    if (discount !== undefined) {
      bill.discount = discount;
      bill.totalAmount = bill.subtotal - discount;
      bill.balanceAmount = Math.max(0, bill.totalAmount - bill.paidAmount);
      bill.paymentStatus = calculatePaymentStatus(bill.totalAmount, bill.paidAmount);
    }
    if (notes) bill.notes = notes;

    await bill.save();

    res.json({ message: 'Bill updated successfully.', bill });
  } catch (error) {
    res.status(500).json({ message: 'Error updating bill.', error: error.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    await Payment.deleteMany({ billId: req.params.id });

    res.json({ message: 'Bill deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting bill.', error: error.message });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    let format = (req.query.format || req.body?.format || 'a4').toLowerCase();
    if (format === 'standard') format = 'a4';
    if (format === 'roll' || format === 'thermal') format = '80mm';

    const bill = await Bill.findById(req.params.id)
      .populate('shopkeeperId', 'name shopName shopAddress phone');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    // Stream PDF directly to response — works on Vercel (no disk write needed)
    await generateBillPDF(bill, format, res);
    // Response is already sent by pdfService when streaming; update pdfPath async
    bill.pdfPath = `/bills/bill_${bill.billNumber}_${format}.pdf`;
    bill.save().catch(() => {}); // non-blocking, don't fail the request
  } catch (error) {
    console.error('PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating PDF.', error: error.message });
    }
  }
};

exports.sendBillWhatsApp = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('shopkeeperId', 'name shopName');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    if (!bill.customerPhone) {
      return res.status(400).json({ message: 'Customer phone number not available.' });
    }

    const result = await sendBillWhatsApp(bill);
    res.json({ message: 'Bill sent via WhatsApp.', result });
  } catch (error) {
    res.status(500).json({ message: 'Error sending WhatsApp.', error: error.message });
  }
};

exports.getPendingBills = async (req, res) => {
  try {
    const query = {
      paymentStatus: { $in: ['Pending', 'Partially Paid'] },
      balanceAmount: { $gt: 0 }
    };
    
    if (req.user.role === 'shopkeeper') {
      query.shopkeeperId = req.user.id;
    } else if (req.user.role === 'customer') {
      const orClauses = [{ customerId: req.user.id }];
      if (req.user.phone && req.user.phone !== 'N/A') {
        orClauses.push({ customerPhone: req.user.phone });
      }
      query.$or = orClauses;
    }
    
    const bills = await Bill.find(query)
      .populate('shopkeeperId', 'name shopName shopAddress upiId upiQrCode')
      .sort({ created_at: -1 });

    res.json({ bills });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending bills.', error: error.message });
  }
};

exports.customerMakePayment = async (req, res) => {
  try {
    const { id: billId } = req.params;
    const { amountPaid, paymentMode, transactionId } = req.body;

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Customer payments must be recorded from the customer account.' });
    }

    // Allow payment if: customerId matches OR customerPhone matches
    const customerId = req.user.id.toString();
    const billCustomerId = bill.customerId ? bill.customerId.toString() : null;
    const phoneMatch = req.user.phone && req.user.phone !== 'N/A' &&
                       bill.customerPhone === req.user.phone;
    const idMatch = billCustomerId && billCustomerId === customerId;

    if (!phoneMatch && !idMatch) {
      return res.status(403).json({ message: 'You can only pay your own bills.' });
    }

    const payAmt = parseFloat(amountPaid);
    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount.' });
    }

    const currentBalance = parseFloat(bill.balanceAmount);
    if (payAmt > currentBalance + 0.01) { // small float tolerance
      return res.status(400).json({
        message: `Payment ₹${payAmt} exceeds balance ₹${currentBalance}.`
      });
    }

    const validModes = ['Cash', 'UPI', 'Card', 'Net Banking', 'COD'];
    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({ message: 'Select a valid payment mode.' });
    }

    const paymentAlreadyAwaitingVerification = await Payment.exists({
      billId: bill._id,
      paymentStatus: 'Verification Pending'
    });
    if (paymentAlreadyAwaitingVerification) {
      return res.status(409).json({ message: 'A payment for this bill is already awaiting shopkeeper verification.' });
    }

    // Create Payment record under the SHOPKEEPER so it appears in their dashboard
    const { Payment } = require('../models');
    await Payment.create({
      billId: bill._id,
      shopkeeperId: bill.shopkeeperId,   // ← goes to the correct shopkeeper
      customerId: req.user.id,
      amount: payAmt,
      paymentMode,
      paymentStatus: 'Verification Pending',
      transactionId: transactionId || '',
      notes: `Customer payment by ${req.user.name || req.user.phone}`
    });

    // Mark bill as Verification Pending — DO NOT update paidAmount until shopkeeper confirms
    bill.paymentStatus = 'Verification Pending';
    await bill.save();

    // Also mark the linked order as Verification Pending
    if (bill.notes && bill.notes.startsWith('Order:')) {
      const { Order } = require('../models');
      const orderNumber = bill.notes.replace('Order:', '').trim();
      const order = await Order.findOne({ orderNumber });
      if (order) {
        order.paymentStatus = 'Verification Pending';
        await order.save();
      }
    }

    res.json({
      message: 'Payment recorded. Shopkeeper will verify shortly.',
      bill
    });
  } catch (error) {
    console.error('Customer payment error:', error);
    res.status(500).json({ message: 'Error processing payment.', error: error.message });
  }
};
