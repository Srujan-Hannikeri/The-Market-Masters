const {testConnection} = require('./config/database');

console.log('Testing database connection...');
console.log('');

testConnection().then(success => {
  if (success) {
    console.log('');
    console.log('✓ Database connection successful!');
    console.log('✓ You can now start the server with Start.bat');
    process.exit(0);
  } else {
    console.log('');
    console.log('✗ Database connection failed.');
    console.log('✗ Please check the error messages above.');
    process.exit(1);
  }
}).catch(error => {
  console.error('');
  console.error('✗ Unexpected error:', error.message);
  process.exit(1);
});
