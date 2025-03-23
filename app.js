const express = require("express"),
  app = express();
require("dotenv").config();
const cors = require("cors");
const flash = require("connect-flash");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const session = require("express-session");
const {initializeDatabase} = require("./db/db");

// Basic middleware setup
app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");

// Initialize database and start server
const startServer = async () => {
  const pool = await initializeDatabase();
  app.set("db", pool);

  // Session configuration - MUST come before other middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // Flash middleware - after session
  app.use(flash());

  // Auth middleware - after session and flash
  app.use(async (req, res, next) => {
    if (req.session && req.session.userId) {
      try {
        const [rows] = await pool
          .promise()
          .query("SELECT * FROM users WHERE id = ?", [req.session.userId]);
        if (rows.length > 0) {
          req.user = rows[0];
          res.locals.currentUser = rows[0];
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    }
    res.locals.currentUser = req.user || null;
    next();
  });

  // Flash messages middleware
  app.use((req, res, next) => {
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
  });

  //loading routes (url to req,res  handler) scripts
  const projectRoutes = require("./routes/projects");
  const indexRoutes = require("./routes/index");
  const adminRoutes = require("./routes/admin");

  app.use("/", indexRoutes);
  app.use("/projects", projectRoutes);
  app.use("/admin", adminRoutes);

  const port = process.env.PORT || 3000;
  app.listen(port, process.env.IP, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
};

startServer();
