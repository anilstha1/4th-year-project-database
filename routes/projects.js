const express = require('express');
var router = express.Router();
const middleware = require("../middleware/index1");

// Get all projects
router.get("/", function (req, res) {
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
    res.render("projects/index", {projects});
  });
});

router.get("/new", middleware.isLoggedIn, function (req, res) {
  res.render("projects/new");
});

//Add project
router.post("/", middleware.isLoggedIn, async function (req, res) {
  const db = req.app.get("db");
  const {title, year, description, link, image, supervisor, member, abstract} =
    req.body;

  // Get a connection from the pool
  const connection = await db.promise().getConnection();

  try {
    // Start transaction
    await connection.beginTransaction();

    // Insert project
    const [projectResult] = await connection.query(
      "INSERT INTO projects (title, year, description, link, image, supervisor, review_status, abstract) VALUES (?, ?, ?, ?, ?, ?, false, ?)",
      [title, year, description, link, image, supervisor, abstract]
    );

    // Get user IDs for all members
    const [users] = await connection.query(
      "SELECT id FROM users WHERE username IN (?)",
      [member]
    );

    // Insert project authors
    if (users.length) {
      const authorValues = users.map((user) => [
        projectResult.insertId,
        user.id,
      ]);
      await connection.query(
        "INSERT INTO project_authors (project_id, user_id) VALUES ?",
        [authorValues]
      );
    }

    // Commit transaction
    await connection.commit();
    res.redirect("/projects");
  } catch (err) {
    // Rollback transaction on error
    await connection.rollback();
    console.log("error", err);
    res.redirect("/projects");
  } finally {
    // Release connection back to pool
    connection.release();
  }
});

//my project
router.get("/myprojects/:id", middleware.isLoggedIn, (req, res) => {
  const query = `
    SELECT p.*, GROUP_CONCAT(u.display_name) as author_names, 
           GROUP_CONCAT(u.username) as author_usernames
    FROM projects p
    JOIN project_authors pa ON p.id = pa.project_id
    JOIN users u ON pa.user_id = u.id
    WHERE EXISTS (
      SELECT 1 FROM project_authors pa2 
      JOIN users u2 ON pa2.user_id = u2.id
      WHERE pa2.project_id = p.id AND u2.username = ?
    )
    GROUP BY p.id`;

  req.app.get("db").query(query, [req.params.id], (err, projects) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    projects = projects.map((p) => ({
      ...p,
      author: [
        {
          username: p.author_usernames.split(","),
          user: p.author_names.split(","),
        },
      ],
    }));
    res.render("projects/index", {projects});
  });
});

//search
router.get("/search", async (req, res) => {
  try {
    const searchQuery = req.query.dsearch;
    const query = `
      SELECT p.*, GROUP_CONCAT(u.display_name) as author_names, 
             GROUP_CONCAT(u.username) as author_usernames
      FROM projects p
      LEFT JOIN project_authors pa ON p.id = pa.project_id
      LEFT JOIN users u ON pa.user_id = u.id
      WHERE p.title LIKE ? OR p.supervisor LIKE ? OR p.abstract LIKE ? OR p.year LIKE ? OR u.username LIKE ?
      GROUP BY p.id`;

    const projects = await req.app
      .get("db")
      .promise()
      .query(query, [
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
      ]);

    res.render("projects/index", {projects: projects[0]});
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/:id", function (req, res) {
  const query = `
    SELECT p.*, GROUP_CONCAT(u.display_name) as author_names, 
           GROUP_CONCAT(u.username) as author_usernames
    FROM projects p
    LEFT JOIN project_authors pa ON p.id = pa.project_id
    LEFT JOIN users u ON pa.user_id = u.id
    WHERE p.id = ?
    GROUP BY p.id`;

  req.app.get("db").query(query, [req.params.id], (err, projects) => {
    if (err) {
      console.log("ERRORORORORO:", err);
      return res.status(500).send("Database error");
    }
    const project = projects[0];
    project.author = [
      {
        username: project.author_usernames
          ? project.author_usernames.split(",")
          : [],
        user: project.author_names ? project.author_names.split(",") : [],
      },
    ];
    res.render("projects/show", {project});
  });
});

// edit route
router.get("/:id/edit", middleware.checkProjectOwnership, function (req, res) {
  const query = `
    SELECT p.*, GROUP_CONCAT(u.display_name) as author_names, 
           GROUP_CONCAT(u.username) as author_usernames
    FROM projects p
    LEFT JOIN project_authors pa ON p.id = pa.project_id
    LEFT JOIN users u ON pa.user_id = u.id
    WHERE p.id = ?
    GROUP BY p.id`;

  req.app.get("db").query(query, [req.params.id], (err, projects) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    const project = projects[0];
    project.author = [
      {
        username: project.author_usernames
          ? project.author_usernames.split(",")
          : [],
        user: project.author_names ? project.author_names.split(",") : [],
      },
    ];
    res.render("projects/edit", {project});
  });
});

// Update Route
router.put("/:id", middleware.checkProjectOwnership, async function (req, res) {
  const db = req.app.get("db");
  const {title, year, description, link, image, supervisor, abstract} =
    req.body.project;
  const member = req.body.project.author[0].username.filter(Boolean); // Filter out empty values

  // Get a connection from the pool
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      "UPDATE projects SET title = ?, year = ?, description = ?, link = ?, image = ?, supervisor = ?, abstract = ? WHERE id = ?",
      [
        title,
        year,
        description,
        link,
        image,
        supervisor,
        abstract,
        req.params.id,
      ]
    );

    await connection.query("DELETE FROM project_authors WHERE project_id = ?", [
      req.params.id,
    ]);

    if (member.length) {
      const [users] = await connection.query(
        "SELECT id FROM users WHERE username IN (?)",
        [member]
      );

      if (users.length) {
        const authorValues = users.map((user) => [req.params.id, user.id]);
        await connection.query(
          "INSERT INTO project_authors (project_id, user_id) VALUES ?",
          [authorValues]
        );
      }
    }

    await connection.commit();
    res.redirect("/projects/" + req.params.id);
  } catch (err) {
    await connection.rollback();
    console.log("error", err);
    res.redirect("/projects");
  } finally {
    connection.release();
  }
});

// DESTROY PROJECT ROUTE
router.delete("/:id", middleware.checkProjectOwnership, function (req, res) {
  const query = "DELETE FROM projects WHERE id = ?";

  req.app.get("db").query(query, [req.params.id], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database error");
    }
    console.log("deleted");
    res.redirect("/projects");
  });
});

module.exports = router