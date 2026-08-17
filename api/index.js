const app = require("../backend/server.js");
const { connectDB } = require("../backend/config/database.js");

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    console.error("Vercel API DB Connection Error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database Connection Failed",
      error: error.message,
    });
  }

  return app(req, res);
};
