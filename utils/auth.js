const bcrypt = require("bcrypt");

const auth = {
  async login(pool, username, password) {
    const query = "SELECT * FROM users WHERE username = ?";
    try {
      const [rows] = await pool.promise().query(query, [username]);
      if (rows.length === 0) return null;

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        return user;
      }
      return null;
    } catch (err) {
      console.error("Login error:", err);
      return null;
    }
  },

  async register(pool, userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const query = `
      INSERT INTO users (username, password_hash, user_type, email, display_name)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool
        .promise()
        .query(query, [
          userData.username,
          hashedPassword,
          userData.user_type || "student",
          userData.email,
          userData.display_name,
        ]);
      return result.insertId;
    } catch (err) {
      console.error("Registration error:", err);
      return null;
    }
  },

  isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
      return next();
    }
    req.flash("error", "You must be logged in to do that");
    res.redirect("/login");
  },

  isAdmin(req, res, next) {
    if (req.user && req.user.user_type === "admin") {
      return next();
    }
    req.flash("error", "You must be an admin to do that");
    res.redirect("back");
  },
};

module.exports = auth;
