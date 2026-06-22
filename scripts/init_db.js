const db = require('../lib/db');
const bcrypt = require('bcryptjs');

async function init() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created or already exists.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(100) DEFAULT 'Pegawai',
        department VARCHAR(100) DEFAULT 'Umum',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Employees table created or already exists.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS official_travel (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_number VARCHAR(50) NOT NULL UNIQUE,
        submitted_by INT NOT NULL,
        purpose TEXT NOT NULL,
        destination VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        approved_by_id INT NULL,
        approved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_submitted_by (submitted_by),
        INDEX idx_status (status)
      )
    `);
    console.log('Official travel table created or already exists.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS official_travel_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        official_travel_id INT NOT NULL,
        approver_id INT NOT NULL,
        employee_id INT NULL,
        status ENUM('approved', 'rejected') NOT NULL,
        notes TEXT NULL,
        action_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Official travel approvals table created or already exists.');

    const [users] = await db.query('SELECT * FROM users WHERE username = ?', ['admin']);
    let userId = 1;
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password', 10);
      const [result] = await db.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
      userId = result.insertId;
      console.log('Test user "admin" created with password "password".');
    } else {
      userId = users[0].id;
      console.log('Test user "admin" already exists.');
    }

    const [employees] = await db.query('SELECT * FROM employees WHERE id = ?', [userId]);
    if (employees.length === 0) {
      await db.query('INSERT INTO employees (id, name, position, department) VALUES (?, ?, ?, ?)', [userId, 'Vanesa Gociardi', 'Pegawai', 'Umum']);
      console.log('Demo employee created.');
    } else {
      console.log('Demo employee already exists.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

init();
