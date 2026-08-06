const twilio = require('twilio');

let client = null;

if (process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (error) {
    console.log('Twilio initialization failed:', error.message);
    client = null;
  }
}

const formatPhoneForWhatsApp = (phone) => {
  let formatted = phone.replace(/\D/g, '');
  if (!formatted.startsWith('91') && formatted.length === 10) {
    formatted = '91' + formatted;
  }
  return `whatsapp:+${formatted}`;
};

const sendWhatsAppMessage = async (to, message) => {
  if (!client) {
    console.log('WhatsApp would be sent:', { to, message });
    return { success: true, mock: true, message: 'Twilio not configured. Message logged to console.' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
      to: formatPhoneForWhatsApp(to)
    });

    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error.message };
  }
};

const sendBillWhatsApp = async (bill) => {
  const message = `
*Market Masters Bill*

Bill #: ${bill.billNumber}
Date: ${new Date(bill.created_at).toLocaleDateString()}

*Items:*
${bill.BillItems.map(item => `- ${item.productName}: ${item.quantity} x ₹${item.unitPrice} = ₹${item.total}`).join('\n')}

*Total: ₹${bill.totalAmount}*
*Paid: ₹${bill.paidAmount}*
*Due: ₹${bill.dueAmount}*
*Status: ${bill.paymentStatus}*

Thank you for your business!
  `.trim();

  return await sendWhatsAppMessage(bill.customerPhone, message);
};

const sendPaymentReminder = async (bill) => {
  const message = `
*Payment Reminder - Market Masters*

Dear ${bill.customerName || 'Customer'},

This is a friendly reminder for your pending payment.

Bill #: ${bill.billNumber}
Total Amount: ₹${bill.totalAmount}
Paid: ₹${bill.paidAmount}
*Due Amount: ₹${bill.dueAmount}*

Please clear your dues at the earliest.

Thank you!
  `.trim();

  return await sendWhatsAppMessage(bill.customerPhone, message);
};

const sendDailyReport = async (shopkeeperPhone, report) => {
  const message = `
*Daily Report - Market Masters*

Date: ${new Date().toLocaleDateString()}

*Sales:* ₹${report.totalSales}
*Expenses:* ₹${report.totalExpenses}
*Profit:* ₹${report.profit}

*Payments:*
- Cash: ₹${report.cashPayments}
- UPI: ₹${report.upiPayments}
- Card: ₹${report.cardPayments}
- Net Banking: ₹${report.netBankingPayments}

*Pending Dues:* ₹${report.pendingDues}

Have a great day!
  `.trim();

  return await sendWhatsAppMessage(shopkeeperPhone, message);
};

module.exports = {
  sendWhatsAppMessage,
  sendBillWhatsApp,
  sendPaymentReminder,
  sendDailyReport
};
