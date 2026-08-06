# The Market Masters
## Smart Billing & Inventory Management System

A complete web-based solution for shopkeepers to manage billing, inventory, payments, and customer orders.

---

## Quick Start

### Prerequisites
- Node.js (v14+)
- MySQL Server (v5.7+)

### Setup (One-Time)
1. Double-click `Setup.bat`
2. Enter MySQL root password
3. Wait for setup to complete

### Start Application
1. Double-click `Start.bat`
2. Browser opens at http://localhost:5000
3. Create your shopkeeper account

---

## Features

### For Shopkeepers
- Product management with stock tracking
- Bill generation with PDF export
- Inventory control with low-stock alerts
- Payment tracking and expense management
- Analytics dashboard with reports
- Order processing system
- SMS/WhatsApp notifications (Twilio)

### For Customers
- Browse products from all shopkeepers
- Place orders online
- Track order status
- View bill history

---

## Configuration

Edit `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=market_masters
DB_USER=root
DB_PASSWORD=your_mysql_password

JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

PORT=5000
NODE_ENV=production

# Optional: Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
TWILIO_PHONE_NUMBER=
```

---

## Project Structure

```
The Market Masters/
├── backend/           # Node.js + Express API
│   ├── config/        # Database config
│   ├── controllers/   # Request handlers
│   ├── middleware/    # Auth & errors
│   ├── models/        # Database models
│   ├── routes/        # API endpoints
│   ├── services/      # PDF, SMS, WhatsApp
│   └── server.js      # Entry point
├── frontend/          # Vanilla JS application
│   ├── css/           # Stylesheets
│   ├── js/            # JavaScript modules
│   └── index.html     # Main file
├── database/          # SQL schema
├── Setup.bat          # Setup wizard
├── Start.bat          # Start server
└── README.md          # This file
```

---

## API Endpoints

Base URL: `http://localhost:5000/api`

### Authentication
- POST `/auth/register` - Create account
- POST `/auth/login` - Login
- GET `/auth/profile` - Get profile

### Inventory
- GET `/inventory` - List products
- POST `/inventory` - Add product (Shopkeeper)
- PUT `/inventory/:id` - Update product
- DELETE `/inventory/:id` - Delete product

### Billing
- GET `/bills` - List bills
- POST `/bills` - Create bill
- POST `/bills/:id/pdf` - Generate PDF

### Orders
- GET `/orders/cart` - Get cart
- POST `/orders/place` - Place order
- GET `/orders/my-orders` - My orders

### Reports
- GET `/reports/dashboard` - Dashboard stats
- GET `/reports/sales` - Sales report
- GET `/reports/profit-loss` - P&L report

---

## Database

Auto-created on first run. Manual creation:
```sql
CREATE DATABASE market_masters CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Production Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start backend/server.js --name market-masters
pm2 save
pm2 startup
```

### Security Checklist
- [ ] Change JWT_SECRET
- [ ] Set NODE_ENV=production
- [ ] Configure Twilio (optional)
- [ ] Enable HTTPS
- [ ] Setup database backups
- [ ] Configure firewall

---

## Troubleshooting

**Server won't start?**
- Check if MySQL is running
- Verify database credentials in `.env`
- Ensure port 5000 is not in use

**Can't delete products?**
- Foreign key constraints removed in v1.0
- Products now delete successfully

**Low stock alerts showing for customers?**
- Fixed in v1.0 - only shopkeepers see alerts

---

## License

MIT License

---

**The Market Masters - Empowering Small Businesses** 🚀
