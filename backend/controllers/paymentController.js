const { Payment, Bill } = require('../models');

const calculatePaymentStatus = (totalAmount, paidAmount) => {
  if (paidAmount >= totalAmount) return 'Paid';
  if (paidAmount === 0) return 'Pending';
  return 'Partially Paid';
};

exports.getAllPayments = async (req, res) => {
  try {
    const { paymentMode, billId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = { shopkeeperId: req.user.id };

    if (paymentMode) query.paymentMode = paymentMode;
    if (billId) query.billId = billId;
    if (startDate && endDate) {
      query.created_at = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const count = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('billId', 'billNumber customerName customerPhone totalAmount')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments.', error: error.message });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('billId', 'billNumber customerName customerPhone totalAmount paidAmount balanceAmount');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    res.json({ payment });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment.', error: error.message });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { billId, amountPaid, amount, paymentMode, transactionId, notes } = req.body;
    const paymentAmount = amountPaid || amount;

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    if (paymentAmount > bill.balanceAmount) {
      return res.status(400).json({ 
        message: 'Payment amount exceeds due amount.',
        dueAmount: bill.balanceAmount 
      });
    }

    const payment = await Payment.create({
      billId,
      shopkeeperId: req.user.id,
      amount: paymentAmount,
      paymentMode,
      transactionId: transactionId || '',
      notes: notes || ''
    });

    const newPaidAmount = Number(bill.paidAmount) + Number(paymentAmount);
    const newBalanceAmount = Math.max(0, Number(bill.totalAmount) - newPaidAmount);
    const paymentStatus = calculatePaymentStatus(bill.totalAmount, newPaidAmount);

    bill.paidAmount = newPaidAmount;
    bill.balanceAmount = newBalanceAmount;
    bill.paymentStatus = paymentStatus;
    await bill.save();

    res.status(201).json({ message: 'Payment recorded successfully.', payment, bill });
  } catch (error) {
    res.status(500).json({ message: 'Error creating payment.', error: error.message });
  }
};

exports.getPaymentsByBill = async (req, res) => {
  try {
    const payments = await Payment.find({ billId: req.params.billId }).sort({ created_at: -1 });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments by bill.', error: error.message });
  }
};

exports.getPaymentSummary = async (req, res) => {
  try {
    const payments = await Payment.find({ shopkeeperId: req.user.id });

    const summary = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      byMode: {}
    };

    payments.forEach(payment => {
      if (!summary.byMode[payment.paymentMode]) {
        summary.byMode[payment.paymentMode] = { count: 0, amount: 0 };
      }
      summary.byMode[payment.paymentMode].count++;
      summary.byMode[payment.paymentMode].amount += Number(payment.amount);
    });

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment summary.', error: error.message });
  }
};

exports.getPendingDues = async (req, res) => {
  try {
    const pendingBills = await Bill.find({
      shopkeeperId: req.user.id,
      paymentStatus: { $in: ['Pending', 'Partially Paid'] },
      balanceAmount: { $gt: 0 }
    }).sort({ created_at: -1 });

    const totalDue = pendingBills.reduce((sum, b) => sum + Number(b.balanceAmount), 0);

    res.json({
      pendingDues: pendingBills,
      totalPendingDues: totalDue,
      count: pendingBills.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending dues.', error: error.message });
  }
};

exports.getAllBillsForPayments = async (req, res) => {
  try {
    const bills = await Bill.find({ shopkeeperId: req.user.id })
      .select('billNumber customerName customerPhone totalAmount paidAmount balanceAmount paymentStatus')
      .sort({ created_at: -1 });

    res.json({ bills });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bills for payments.', error: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    const { paymentMode, transactionId, notes } = req.body;
    if (paymentMode) payment.paymentMode = paymentMode;
    if (transactionId !== undefined) payment.transactionId = transactionId;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    res.json({ message: 'Payment updated successfully.', payment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment.', error: error.message });
  }
};
