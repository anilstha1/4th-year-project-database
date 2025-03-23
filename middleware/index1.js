var middlewareObj = {};

middlewareObj.checkProjectOwnership = async function (req, res, next) {
  if (!req.session.userId) {
    req.flash("error", "You need to be Logged in to do that.");
    return res.redirect("back");
  }

  try {
    const [rows] = await req.app
      .get("db")
      .promise()
      .query(
        "SELECT * FROM projects p JOIN project_authors pa ON p.id = pa.project_id WHERE p.id = ? AND pa.user_id = ?",
        [req.params.id, req.session.userId]
      );

    if (rows.length === 0) {
      req.flash("error", "Project not found or not authorized");
      return res.redirect("back");
    }
    next();
  } catch (err) {
    console.error(err);
    req.flash("error", "Database error occurred");
    return res.redirect("back");
  }
};

middlewareObj.isAdmin = async function (req, res, next) {
  if (!req.session.userId) {
    req.flash("error", "You need to be logged in to do that.");
    return res.redirect("/projects");
  }

  try {
    const [rows] = await req.app
      .get("db")
      .promise()
      .query("SELECT user_type FROM users WHERE id = ?", [req.session.userId]);

    if (rows.length === 0 || rows[0].user_type !== "admin") {
      req.flash("error", "Administrator access required");
      return res.redirect("/projects");
    }
    next();
  } catch (err) {
    console.error(err);
    req.flash("error", "Database error occurred");
    res.redirect("/projects");
  }
};

middlewareObj.isLoggedIn = function (req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.flash("error", "You need to be Logged in to do that.");
  res.redirect("/projects");
};

// Remove checkCommentOwnership since it's not used with MySQL implementation

module.exports = middlewareObj;
