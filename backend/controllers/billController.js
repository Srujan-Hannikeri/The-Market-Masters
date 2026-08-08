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
    const { status, customerPhone, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (req.user.role === 'shopkeeper') {
      query.shopkeeperId = req.user.id;
    } else if (req.user.role === 'customer') {
      query.customerPhone = req.user.phone;
    }

    if (status) query.paymentStatus = status;
    if (customerPhone && req.user.role === 'shopkeeper') {
      query.customerPhone = customerPhone;
    }
    if (startDate && endDate) {
      query.created_at = { $gte: new Date(startDate), $lte: new Date(endDate) };
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
    const bills = await Bill.find({ customerPhone: req.user.phone }).sort({ created_at: -1 });
    res.json({ bills });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer bills.', error: error.message });
  }
};

exports.getBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('shopkeeperId', 'name shopName shopAddress phone upiId upiQrCode');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    res.json({ bill });
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
      customerName,
      customerPhone,
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
    // Accept format from query (?format=a4 | a3 | a5 | letter | 80mm | 58mm)
    // Default to 'a4'. Legacy values 'standard' and 'roll' are mapped for backward compat.
    let format = (req.query.format || req.body?.format || 'a4').toLowerCase();
    if (format === 'standard') format = 'a4';
    if (format === 'roll' || format === 'thermal') format = '80mm';

    const bill = await Bill.findById(req.params.id)
      .populate('shopkeeperId', 'name shopName shopAddress phone');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    const pdfPath = await generateBillPDF(bill, format);
    bill.pdfPath = pdfPath;
    await bill.save();

    res.json({ message: 'PDF generated successfully.', pdfUrl: pdfPath, format });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ message: 'Error generating PDF.', error: error.message });
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
      query.customerPhone = req.user.phone;
    }
    
    const bills = await Bill.find(query).sort({ created_at: -1 });

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

    if (bill.customerPhone !== req.user.phone) {
      return res.status(403).json({ message: 'You can only pay your own bills.' });
    }

    if (!amountPaid || amountPaid <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount.' });
    }

    const payment = await Payment.create({
      billId,
      shopkeeperId: bill.shopkeeperId,
      customerId: req.user.id,
      amount: amountPaid,
      paymentMode,
      transactionId: transactionId || '',
      notes: `Payment by customer ${req.user.name}`
    });

    const newPaidAmount = Number(bill.paidAmount) + Number(amountPaid);
    const newBalanceAmount = Math.max(0, Number(bill.totalAmount) - newPaidAmount);
    const newPaymentStatus = calculatePaymentStatus(bill.totalAmount, newPaidAmount);

    bill.paidAmount = newPaidAmount;
    bill.balanceAmount = newBalanceAmount;
    bill.paymentStatus = newPaymentStatus;
    await bill.save();

    res.json({ 
      message: 'Payment recorded successfully.',
      payment,
      bill
    });
  } catch (error) {
    console.error('Customer payment error:', error);
    res.status(500).json({ message: 'Error processing payment.', error: error.message });
  }
};
