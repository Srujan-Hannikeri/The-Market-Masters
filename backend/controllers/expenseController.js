const { Expense } = require('../models');

exports.getAllExpenses = async (req, res) => {
  try {
    const { category, type, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = { shopkeeperId: req.user.id };

    const cat = category || type;
    if (cat) query.category = cat;

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const count = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      expenses,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expenses.', error: error.message });
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    res.json({ expense });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expense.', error: error.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { category, type, amount, description, date, expenseDate, paymentMode } = req.body;

    const expense = await Expense.create({
      shopkeeperId: req.user.id,
      category: category || type || 'General',
      amount,
      description: description || '',
      date: date || expenseDate || new Date(),
      paymentMode: paymentMode || 'Cash'
    });

    res.status(201).json({ message: 'Expense created successfully.', expense });
  } catch (error) {
    res.status(500).json({ message: 'Error creating expense.', error: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    const { category, type, amount, description, date, expenseDate, paymentMode } = req.body;

    if (category || type) expense.category = category || type;
    if (amount !== undefined) expense.amount = amount;
    if (description !== undefined) expense.description = description;
    if (date || expenseDate) expense.date = date || expenseDate;
    if (paymentMode) expense.paymentMode = paymentMode;

    await expense.save();

    res.json({ message: 'Expense updated successfully.', expense });
  } catch (error) {
    res.status(500).json({ message: 'Error updating expense.', error: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting expense.', error: error.message });
  }
};

exports.getExpenseSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { shopkeeperId: req.user.id };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const expenses = await Expense.find(query);

    const summary = {
      totalExpenses: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
      byType: {}
    };

    expenses.forEach(expense => {
      const cat = expense.category || 'General';
      if (!summary.byType[cat]) {
        summary.byType[cat] = { count: 0, amount: 0 };
      }
      summary.byType[cat].count++;
      summary.byType[cat].amount += Number(expense.amount);
    });

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expense summary.', error: error.message });
  }
};

exports.getDailyExpenses = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDateStr = date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr + 'T00:00:00');

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const startOfDay = new Date(year, month, targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(year, month, targetDate.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const [todayExpenses, monthExpenses, yearExpenses] = await Promise.all([
      Expense.find({ shopkeeperId: req.user.id, date: { $gte: startOfDay, $lte: endOfDay } }).sort({ date: -1 }),
      Expense.find({ shopkeeperId: req.user.id, date: { $gte: startOfMonth, $lte: endOfMonth } }).sort({ date: -1 }),
      Expense.find({ shopkeeperId: req.user.id, date: { $gte: startOfYear, $lte: endOfYear } }).sort({ date: -1 })
    ]);

    const totalAmount = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const monthTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const yearTotal = yearExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    res.json({
      date: targetDateStr,
      expenses: todayExpenses,
      todayExpenses,
      monthExpenses,
      yearExpenses,
      totalAmount,
      monthTotal,
      yearTotal
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching daily expenses.', error: error.message });
  }
};
