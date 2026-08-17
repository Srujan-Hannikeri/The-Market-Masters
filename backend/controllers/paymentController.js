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

    const { amount, paymentMode, transactionId, notes } = req.body;
    const oldAmount = Number(payment.amount);
    const newAmount = amount !== undefined ? Number(amount) : oldAmount;

    if (paymentMode) payment.paymentMode = paymentMode;
    if (amount !== undefined) payment.amount = newAmount;
    if (transactionId !== undefined) payment.transactionId = transactionId;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    // If amount changed, recalculate bill totals
    if (amount !== undefined && newAmount !== oldAmount) {
      const bill = await Bill.findById(payment.billId);
      if (bill) {
        // Recalculate from all payments
        const { Payment: PaymentModel } = require('../models');
        const allPayments = await PaymentModel.find({ billId: bill._id });
        const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const newBalance = Math.max(0, Number(bill.totalAmount) - totalPaid);
        bill.paidAmount = totalPaid;
        bill.balanceAmount = newBalance;
        bill.paymentStatus = calculatePaymentStatus(bill.totalAmount, totalPaid);
        await bill.save();
      }
    }

    res.json({ message: 'Payment updated successfully.', payment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment.', error: error.message });
  }
};

// Shopkeeper confirms a pending payment made by customer
exports.confirmPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    // Only the shopkeeper of this payment can confirm it
    if (payment.shopkeeperId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (payment.paymentStatus !== 'Verification Pending') {
      return res.status(400).json({ message: 'Payment is not pending verification.' });
    }

    // Confirm the payment
    payment.paymentStatus = 'Paid';
    await payment.save();

    // Now update the bill amounts
    const bill = await Bill.findById(payment.billId);
    if (bill) {
      const newPaidAmount = Number(bill.paidAmount) + Number(payment.amount);
      const newBalanceAmount = Math.max(0, Number(bill.totalAmount) - newPaidAmount);
      bill.paidAmount = newPaidAmount;
      bill.balanceAmount = newBalanceAmount;
      bill.paymentStatus = calculatePaymentStatus(bill.totalAmount, newPaidAmount);
      await bill.save();

      // Also update the linked order if any (find by order number in notes)
      try {
        const { Order } = require('../models');
        if (bill.notes && bill.notes.includes('Order:')) {
          const orderNumberMatch = bill.notes.match(/Order:\s*(ORD-[A-Z0-9-]+)/);
          if (orderNumberMatch) {
            const orderNumber = orderNumberMatch[1];
            const order = await Order.findOne({ orderNumber });
            if (order) {
              order.paymentStatus = bill.paymentStatus;
              await order.save();
            }
          }
        }
      } catch (orderErr) {
        console.error('Error updating linked order:', orderErr);
      }
    }

    res.json({ message: 'Payment confirmed successfully.', payment, bill });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Error confirming payment.', error: error.message });
  }
};

// Get all bills that have payments pending shopkeeper verification
exports.getVerificationPendingBills = async (req, res) => {
  try {
    const { Payment: PaymentModel } = require('../models');
    const pendingPayments = await PaymentModel.find({
      shopkeeperId: req.user.id,
      paymentStatus: 'Verification Pending'
    }).populate('billId', 'billNumber customerName customerPhone totalAmount paidAmount balanceAmount paymentStatus')
      .populate('customerId', 'name phone')
      .sort({ created_at: -1 });

    res.json({ payments: pendingPayments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending verification bills.', error: error.message });
  }
};
