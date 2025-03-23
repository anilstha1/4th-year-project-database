const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("fast-csv");
const fs = require("fs");
const {isAdmin} = require("../middleware/index1");
const nodemailer = require("nodemailer");
const path = require("path");
const bcrypt = require("bcrypt");

async function sendEmail(to, subject, text) {
  // Create a transporter
  let transporter = nodemailer.createTransport({
    service: "gmail", // Use your email service
    auth: {
      user: "jeevan.neupane003@gmail.com", // Your email address
      pass: "tuyp rllp jcgi noyv", // Your email password
    },
  });

  // Email options
  let mailOptions = {
    from: "jeevan.neupane003@gmail.com",
    to: to,
    subject: subject,
    text: text,
  };

  // Send email
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email: " + error);
  }
}
function generateNonce() {
  return require("crypto").randomBytes(16).toString("base64");
}

const csvDir = path.join(__dirname, "csvfiles");

// Ensure the directory exists
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir, {recursive: true});
}

const fileStorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Checking directory");
    cb(null, csvDir); // Use the absolute path
  },
  filename: (req, file, cb) => {
    cb(null, "test.csv");
  },
});

const upload = multer({storage: fileStorageEngine});

router.get("/", isAdmin, function (req, res) {
  const nonce = generateNonce();
  const query = `
    SELECT p.*, GROUP_CONCAT(u.display_name) as author_names, 
           GROUP_CONCAT(u.username) as author_usernames
    FROM projects p
    LEFT JOIN project_authors pa ON p.id = pa.project_id
    LEFT JOIN users u ON pa.user_id = u.id
    GROUP BY p.id`;

  req.app.get("db").query(query, (err, projects) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    projects = projects.map((p) => ({
      ...p,
      author: [
        {
          username: p.author_usernames ? p.author_usernames.split(",") : [],
          user: p.author_names ? p.author_names.split(",") : [],
        },
      ],
    }));
    res.render("admin/admin", {projects, nonce});
  });
});

router.post("/upload-csv", isAdmin, upload.single("file"), function (req, res) {
  const db = req.app.get("db");
  let newCount = 0;
  let errorCount = 0;
  const fileRows = [];

  csv
    .parseFile(req.file.path)
    .on("data", (data) => fileRows.push(data))
    .on("end", async () => {
      for (const row of fileRows) {
        if (row[0]?.toLowerCase() === "username") continue;

        try {
          const hashedPassword = await bcrypt.hash(row[1], 10);
          await db
            .promise()
            .query(
              "INSERT INTO users (username, password_hash, display_name, email) VALUES (?, ?, ?, ?)",
              [row[0], hashedPassword, row[2], row[3]]
            );
          newCount++;
          await sendEmail(
            row[3],
            "Account Creation",
            `Your account has been created. Username: ${row[0]}, Password: ${row[1]}`
          );
        } catch (err) {
          console.log(err);
          errorCount++;
        }
      }

      if (newCount > 0)
        req.flash("success", `Successfully added ${newCount} new accounts`);
      if (errorCount > 0)
        req.flash("error", `Failed to add ${errorCount} accounts`);
      res.redirect("/admin");
    });
});

router.post("/register", isAdmin, async function (req, res) {
  const db = req.app.get("db");
  const {username, password, user} = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db
      .promise()
      .query(
        "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)",
        [username, hashedPassword, user]
      );

    req.flash("success", "User created successfully");
    res.redirect("/admin");
  } catch (err) {
    console.log(err);
    res.render("register", {error: "Registration failed"});
  }
});

router.put("/:id", isAdmin, async function (req, res) {
  const db = req.app.get("db");
  try {
    await db
      .promise()
      .query(
        "UPDATE projects SET review_status = NOT review_status WHERE id = ?",
        [req.params.id]
      );

    const project = await db
      .promise()
      .query("SELECT * FROM projects WHERE id = ?", [req.params.id]);

    res.redirect("/admin");
  } catch (err) {
    console.log(err);
    res.redirect("/admin");
  }
});

module.exports = router;