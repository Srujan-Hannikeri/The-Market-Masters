const cron = require('node-cron');
const { Bill, Payment, Expense, User } = require('../models');
const { Op } = require('sequelize');
const { sendPaymentReminder, sendDailyReport } = require('./whatsappService');

const startScheduler = () => {
  // Daily report at 9 PM
  cron.schedule('0 21 * * *', async () => {
    console.log('Running daily report scheduler...');
    await sendDailyReports();
  });

  // Payment reminders at 10 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('Running payment reminder scheduler...');
    await sendPendingReminders();
  });

  console.log('Scheduler started successfully.');
};

const sendDailyReports = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const shopkeepers = await User.findAll({ where: { role: 'shopkeeper', isActive: true } });

    for (const shopkeeper of shopkeepers) {
      // Today's sales
      const todaySales = await Bill.sum('totalAmount', {
        where: { 
          userId: shopkeeper.id,
          created_at: { [Op.gte]: today, [Op.lt]: tomorrow } 
        }
      }) || 0;

      // Today's expenses
      const todayExpenses = await Expense.sum('amount', {
        where: { 
          userId: shopkeeper.id,
          expenseDate: { [Op.gte]: today, [Op.lt]: tomorrow } 
        }
      }) || 0;

      // Payments by mode
      const payments = await Payment.findAll({
        include: [{
          model: Bill,
          where: { userId: shopkeeper.id },
          attributes: []
        }],
        where: { created_at: { [Op.gte]: today, [Op.lt]: tomorrow } },
        attributes: ['paymentMode', [require('sequelize').fn('SUM', require('sequelize').col('amountPaid')), 'total']],
        group: ['paymentMode'],
        raw: true
      });

      // Pending dues
      const pendingDues = await Bill.sum('dueAmount', {
        where: { 
          userId: shopkeeper.id,
          paymentStatus: { [Op.in]: ['Pending', 'Partially Paid'] } 
        }
      }) || 0;

      const report = {
        totalSales: todaySales,
        totalExpenses: todayExpenses,
        profit: todaySales - todayExpenses,
        cashPayments: payments.find(p => p.paymentMode === 'Cash')?.total || 0,
        upiPayments: payments.find(p => p.paymentMode === 'UPI')?.total || 0,
        cardPayments: payments.find(p => p.paymentMode === 'Card')?.total || 0,
        netBankingPayments: payments.find(p => p.paymentMode === 'Net Banking')?.total || 0,
        pendingDues
      };

      if (shopkeeper.phone) {
        await sendDailyReport(shopkeeper.phone, report);
      }
    }
  } catch (error) {
    console.error('Error sending daily reports:', error);
  }
};

const sendPendingReminders = async () => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const pendingBills = await Bill.findAll({
      where: {
        paymentStatus: { [Op.in]: ['Pending', 'Partially Paid'] },
        dueAmount: { [Op.gt]: 0 },
        created_at: { [Op.lte]: threeDaysAgo },
        customerPhone: { [Op.not]: null }
      },
      include: [{ model: require('../models').BillItem }]
    });

    for (const bill of pendingBills) {
      await sendPaymentReminder(bill);
    }

    console.log(`Sent ${pendingBills.length} payment reminders.`);
  } catch (error) {
    console.error('Error sending pending reminders:', error);
  }
};

module.exports = { startScheduler };
