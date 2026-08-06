const { Bill, Payment, Expense, Product } = require('../models');

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const shopkeeperId = req.user.id;

    // Today's bills & expenses
    const todayBills = await Bill.find({
      shopkeeperId,
      created_at: { $gte: today, $lt: tomorrow }
    });
    const todaySales = todayBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    const todayExpenseList = await Expense.find({
      shopkeeperId,
      date: { $gte: today, $lt: tomorrow }
    });
    const todayExpenses = todayExpenseList.reduce((sum, e) => sum + Number(e.amount), 0);

    // All bills & expenses
    const allBills = await Bill.find({ shopkeeperId });
    const totalSales = allBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const paidAmount = allBills.reduce((sum, b) => sum + Number(b.paidAmount), 0);
    const pendingAmount = allBills.reduce((sum, b) => sum + Number(b.balanceAmount), 0);

    const allExpenses = await Expense.find({ shopkeeperId });
    const totalExpenses = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const billsByStatus = { Paid: 0, Pending: 0, 'Partially Paid': 0 };
    allBills.forEach(b => {
      if (b.paymentStatus) billsByStatus[b.paymentStatus] = (billsByStatus[b.paymentStatus] || 0) + 1;
    });

    const lowStockCount = await Product.countDocuments({
      userId: shopkeeperId,
      isActive: true,
      $expr: { $lte: ['$stock', '$minStock'] }
    });

    const recentBills = await Bill.find({ shopkeeperId })
      .sort({ created_at: -1 })
      .limit(5)
      .select('billNumber customerName totalAmount paymentStatus created_at');

    res.json({
      stats: {
        todaySales,
        todayExpenses,
        todayProfit: todaySales - todayExpenses,
        totalSales,
        totalExpenses,
        totalProfit: totalSales - totalExpenses,
        paidAmount,
        pendingAmount,
        lowStockCount
      },
      billsByStatus,
      recentBills
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats.', error: error.message });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { shopkeeperId: req.user.id };

    if (startDate && endDate) {
      query.created_at = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const bills = await Bill.find(query).sort({ created_at: 1 });

    const salesMap = {};
    bills.forEach(bill => {
      const date = new Date(bill.created_at).toISOString().split('T')[0];
      if (!salesMap[date]) {
        salesMap[date] = { date, billCount: 0, totalSales: 0, totalPaid: 0, totalDue: 0 };
      }
      salesMap[date].billCount++;
      salesMap[date].totalSales += Number(bill.totalAmount);
      salesMap[date].totalPaid += Number(bill.paidAmount);
      salesMap[date].totalDue += Number(bill.balanceAmount);
    });

    res.json({ sales: Object.values(salesMap) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales report.', error: error.message });
  }
};

exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const billQuery = { shopkeeperId: req.user.id };
    const expenseQuery = { shopkeeperId: req.user.id };

    if (startDate && endDate) {
      billQuery.created_at = { $gte: new Date(startDate), $lte: new Date(endDate) };
      expenseQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const bills = await Bill.find(billQuery);
    const expenses = await Expense.find(expenseQuery);
    const payments = await Payment.find(billQuery);

    const totalSales = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const salesByMode = {};
    payments.forEach(p => {
      salesByMode[p.paymentMode] = (salesByMode[p.paymentMode] || 0) + Number(p.amount);
    });

    const expensesByType = {};
    expenses.forEach(e => {
      const cat = e.category || 'General';
      expensesByType[cat] = (expensesByType[cat] || 0) + Number(e.amount);
    });

    res.json({
      summary: {
        totalSales,
        totalExpenses,
        netProfit: totalSales - totalExpenses
      },
      salesByMode,
      expensesByType
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profit/loss report.', error: error.message });
  }
};

exports.getPaymentModeAnalysis = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { shopkeeperId: req.user.id };

    if (startDate && endDate) {
      query.created_at = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const payments = await Payment.find(query);
    const modeMap = {};

    payments.forEach(p => {
      const mode = p.paymentMode || 'Cash';
      if (!modeMap[mode]) {
        modeMap[mode] = { count: 0, totalAmount: 0 };
      }
      modeMap[mode].count++;
      modeMap[mode].totalAmount += Number(p.amount);
    });

    const totalTransactions = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const analysis = Object.keys(modeMap).map(mode => {
      const item = modeMap[mode];
      return {
        paymentMode: mode,
        transactionCount: item.count,
        totalAmount: item.totalAmount,
        averageAmount: item.count > 0 ? (item.totalAmount / item.count).toFixed(2) : 0,
        percentage: totalAmount > 0 ? ((item.totalAmount / totalAmount) * 100).toFixed(2) : 0
      };
    });

    res.json({
      analysis,
      summary: { totalTransactions, totalAmount }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment mode analysis.', error: error.message });
  }
};

exports.getTrendData = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const bills = await Bill.find({
      shopkeeperId: req.user.id,
      created_at: { $gte: startDate, $lte: endDate }
    }).sort({ created_at: 1 });

    const expenses = await Expense.find({
      shopkeeperId: req.user.id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const salesMap = {};
    bills.forEach(bill => {
      const date = new Date(bill.created_at).toISOString().split('T')[0];
      if (!salesMap[date]) salesMap[date] = { date, amount: 0 };
      salesMap[date].amount += Number(bill.totalAmount);
    });

    const expensesMap = {};
    expenses.forEach(expense => {
      const date = new Date(expense.date).toISOString().split('T')[0];
      if (!expensesMap[date]) expensesMap[date] = { date, amount: 0 };
      expensesMap[date].amount += Number(expense.amount);
    });

    res.json({
      sales: Object.values(salesMap),
      expenses: Object.values(expensesMap)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trend data.', error: error.message });
  }
};
