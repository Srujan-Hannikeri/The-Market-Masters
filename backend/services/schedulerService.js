// Scheduler Service (Mongoose Version)
// Note: In a Serverless environment (like Vercel), cron jobs won't run continuously.
// To use crons on Vercel, you need to use Vercel Cron Jobs calling an API endpoint.

const startScheduler = () => {
  console.log('Scheduler is disabled in serverless mode to prevent crashes.');
  // If moving to a dedicated server (like Render/DigitalOcean), implement node-cron here
};

module.exports = { startScheduler };
