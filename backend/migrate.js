require('dotenv').config({ path: '.env' });
const { sequelize } = require('./config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to DB');

    const queries = [
      'ALTER TABLE products ADD COLUMN mrp DECIMAL(10,2) DEFAULT 0.00',
      'ALTER TABLE products ADD COLUMN costPrice DECIMAL(10,2) DEFAULT 0.00',
      'ALTER TABLE products ADD COLUMN agencyName VARCHAR(200) DEFAULT NULL',
      'ALTER TABLE bill_items ADD COLUMN mrp DECIMAL(10,2) DEFAULT 0.00'
    ];

    for (const q of queries) {
      try {
        await sequelize.query(q);
        console.log('✓ Added:', q.split('ADD COLUMN')[1].trim().split(' ')[0]);
      } catch (e) {
        if (e.message.includes('Duplicate column name') || e.message.includes('already exists')) {
          console.log('✓ Already exists:', q.split('ADD COLUMN')[1].trim().split(' ')[0]);
        } else {
          console.error('✗ Error:', e.message);
        }
      }
    }

    const [prodCols] = await sequelize.query('SHOW COLUMNS FROM products');
    console.log('\nProducts columns:', prodCols.map(c => c.Field).join(', '));

    const [billCols] = await sequelize.query('SHOW COLUMNS FROM bill_items');
    console.log('BillItems columns:', billCols.map(c => c.Field).join(', '));

    console.log('\n✓ Migration complete! Please restart your server.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
