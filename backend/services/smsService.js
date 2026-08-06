const twilio = require('twilio');

let client = null;

// Initialize Twilio client if credentials are available
if (process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio SMS client initialized successfully');
  } catch (error) {
    console.log('❌ Twilio SMS initialization failed:', error.message);
    client = null;
  }
}

// Format phone number for SMS (international format)
const formatPhoneForSMS = (phone) => {
  let formatted = phone.replace(/\D/g, '');
  
  // For Indian numbers, add +91 country code
  if (!formatted.startsWith('91') && formatted.length === 10) {
    formatted = '+91' + formatted;
  } else if (formatted.startsWith('91') && formatted.length === 12) {
    formatted = '+' + formatted;
  } else if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  
  return formatted;
};

// Send SMS message
const sendSMS = async (to, message) => {
  if (!client) {
    console.log('\n' + '='.repeat(60));
    console.log('📱 SMS would be sent to:', to);
    console.log('📝 Message:', message);
    console.log('='.repeat(60) + '\n');
    return { 
      success: true, 
      mock: true, 
      message: 'Twilio not configured. SMS logged to console.' 
    };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER,
      to: formatPhoneForSMS(to)
    });

    console.log('✅ SMS sent successfully:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('❌ SMS send error:', error.message);
    return { success: false, error: error.message };
  }
};

// Send OTP via SMS
const sendOTPViaSMS = async (phone, otp) => {
  const message = `Your OTP for Market Masters password reset is: ${otp}. This OTP is valid for 5 minutes. Do not share this with anyone.`;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔐 OTP Generated for ${phone}: ${otp}`);
  console.log(`${'='.repeat(60)}\n`);
  
  return await sendSMS(phone, message);
};

module.exports = {
  sendSMS,
  sendOTPViaSMS,
  formatPhoneForSMS
};
