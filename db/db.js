const mysql = require("mysql2");
const bcrypt = require("bcrypt");
require("dotenv").config();

const initializeDatabase = async () => {
  try {
    // Create initial connection without database
    const initPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Create database if it doesn't exist
    await initPool
      .promise()
      .query(`CREATE DATABASE IF NOT EXISTS ${process.env.MYSQL_DATABASE}`);

    // Close initial connection
    await initPool.end();

    // Create main connection pool with database
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        user_type VARCHAR(255) NOT NULL DEFAULT 'student',
        email VARCHAR(255),
        display_name VARCHAR(255)
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id INT,
        expires TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        year VARCHAR(4) NOT NULL,
        link TEXT,
        description TEXT,
        image TEXT,
        review_status BOOLEAN DEFAULT FALSE,
        abstract TEXT,
        supervisor VARCHAR(255)
      )`,
      `CREATE TABLE IF NOT EXISTS project_authors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT,
        user_id INT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    ];

    for (const table of tables) {
      await pool.promise().query(table);
    }

    // Create admin user
    const adminPW = "admin123";
    const hashedPassword = await bcrypt.hash(adminPW, 10);

    await pool.promise().query(
      `
      INSERT IGNORE INTO users (username, password_hash, user_type, email, display_name) 
      VALUES ('admin', ?, 'admin', 'admin@gmail.com', 'Administrator')
    `,
      [hashedPassword]
    );

    console.log("Database initialized successfully");
    return pool;
  } catch (err) {
    console.error("Database initialization error:", err);
    process.exit(1);
  }
};

module.exports = {initializeDatabase};
