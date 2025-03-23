const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

// ROot
router.get("/", function (req, res) {
  res.redirect("/projects");
});

// Show Register Form
router.get("/register", function (req, res) {
  res.render("register");
});

// Handles Sign up i.e. Register
router.post("/register", async function (req, res) {
  const db = req.app.get("db");
  const {username, password, user, email} = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db
      .promise()
      .query(
        "INSERT INTO users (username, password_hash, display_name, user_type, email) VALUES (?, ?, ?, 'student', ?)",
        [username, hashedPassword, user, email]
      );

    req.session.userId = result.insertId;
    req.flash("success", "Welcome " + user + "(" + username + ")!!!");
    res.redirect("/projects");
  } catch (err) {
    console.log(err);
    res.render("register", {error: "Registration failed"});
  }
});

//changepassword
router.put("/changepassword", async function (req, res) {
  const {username, oldpassword, newpassword} = req.body;
  const db = req.app.get("db");

  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    const match = await bcrypt.compare(oldpassword, rows[0].password_hash);
    if (!match) {
      throw new Error("Invalid old password");
    }

    const hashedPassword = await bcrypt.hash(newpassword, 10);
    await db
      .promise()
      .query("UPDATE users SET password_hash = ? WHERE id = ?", [
        hashedPassword,
        rows[0].id,
      ]);

    req.flash("success", "Password changed");
    res.redirect("/projects");
  } catch (err) {
    console.log(err);
    req.flash("error", err.message);
    res.redirect("/projects");
  }
});

//forgotpassword
router.put("/forgotpassword", async function (req, res) {
  const {username, password} = req.body;
  const db = req.app.get("db");

  try {
    // Find user
    const [rows] = await db
      .promise()
      .query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await db
      .promise()
      .query("UPDATE users SET password_hash = ? WHERE id = ?", [
        hashedPassword,
        rows[0].id,
      ]);

    req.flash("success", "Password changed");
    res.redirect("/projects");
  } catch (err) {
    console.log(err);
    req.flash("error", err.message);
    res.redirect("/projects");
  }
});

// Show Login Form
router.get("/login", function (req, res) {
  res.redirect("/projects");
});

// Handle Login
router.post("/login", async function (req, res) {
  const {username, password} = req.body;
  const db = req.app.get("db");

  try {
    // Get user from database
    const [rows] = await db
      .promise()
      .query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/projects");
    }

    // Compare password
    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/projects");
    }

    // Set session
    req.session.userId = rows[0].id;
    req.flash("success", "Logged In");
    res.redirect("/projects");
  } catch (err) {
    console.log(err);
    req.flash("error", "Login failed");
    res.redirect("/projects");
  }
});

// Handle Logout
router.get("/logout", function (req, res) {
  // Set flash message before destroying session
  if (req.session) {
    req.flash("success", "Logged Out");
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
      }
      // Clear cookie and redirect
      res.clearCookie("connect.sid");
      res.redirect("/projects");
    });
  } else {
    res.redirect("/projects");
  }
});

module.exports = router;
