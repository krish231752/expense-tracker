require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    },
    connectTimeout: 20000
});

db.connect(err => {
    if (err) {
        console.error('MySQL connection error:', err);
        process.exit(1); 
    }
    console.log('MySQL Connected!');
});

// =======================================================
// CATEGORY ROUTES
// =======================================================

// GET all categories
app.get('/categories', (req, res) => {
    db.query('SELECT * FROM categories', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST new category
app.post('/categories', (req, res) => {
    const { name, budget_limit } = req.body;
    db.query('INSERT INTO categories (name, budget_limit) VALUES (?, ?)', [name, budget_limit || 0], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: result.insertId, message: 'Category added!' });
    });
});

// PUT update category (by ID)
app.put('/categories/:id', (req, res) => {
    const { id } = req.params;
    const { name, budget_limit } = req.body;
    
    // Check if any fields are actually being updated
    if (name === undefined && budget_limit === undefined) {
        return res.status(400).json({ error: 'No fields provided for update' });
    }

    let sql = 'UPDATE categories SET ';
    let params = [];
    
    // Dynamically build the SQL query based on what is provided
    if (name !== undefined) {
        sql += 'name = ?, ';
        params.push(name);
    }
    
    if (budget_limit !== undefined) {
        sql += 'budget_limit = ?, ';
        params.push(budget_limit);
    }
    
    // Remove the trailing comma and space
    sql = sql.slice(0, -2); 
    
    // Add the WHERE clause
    sql += ' WHERE id = ?';
    params.push(id);
    
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category updated!' });
    });
});

// DELETE category (by ID)
app.delete('/categories/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM categories WHERE id=?', [id], (err, result) => {
        if (err) {
            // Check for foreign key constraint violation (expenses linked to category)
            if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
                 return res.status(400).json({ error: 'Cannot delete category: Expenses are linked to it. Please delete linked expenses first.' });
            }
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted!' });
    });
});

// =======================================================
// EXPENSE ROUTES
// =======================================================

// GET all expenses (with optional filters: category_id, start_date, end_date)
app.get('/expenses', (req, res) => {
    let query = 'SELECT e.*, c.name AS category_name FROM expenses e JOIN categories c ON e.category_id = c.id';
    let params = [];

    // Simple conditional logic for filtering (needs refinement for multiple filters)
    if (req.query.category_id) {
        query += ' WHERE e.category_id = ?';
        params.push(req.query.category_id);
    } else if (req.query.start_date && req.query.end_date) {
        query += ' WHERE e.expense_date BETWEEN ? AND ?';
        params.push(req.query.start_date, req.query.end_date);
    }
    
    // Add sorting by date
    query += ' ORDER BY e.expense_date DESC';

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST new expense
app.post('/expenses', (req, res) => {
    const { category_id, amount, description, expense_date } = req.body;
    db.query(
        'INSERT INTO expenses (category_id, amount, description, expense_date) VALUES (?, ?, ?, ?)',
        [category_id, amount, description, expense_date],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: result.insertId, message: 'Expense added!' });
        }
    );
});

// PUT update expense (by ID)
app.put('/expenses/:id', (req, res) => {
    const { id } = req.params;
    // Client-side only sends 'amount' and 'description' for expense update
    const { amount, description } = req.body; 
    
    // Ensure all required fields for this specific update are present
    if (amount === undefined || description === undefined) {
         return res.status(400).json({ error: 'Must provide amount and description for expense update.' });
    }

    db.query(
        'UPDATE expenses SET amount=?, description=? WHERE id=?',
        [amount, description, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Expense not found' });
            res.json({ message: 'Expense updated!' });
        }
    );
});
   
// DELETE expense (by ID)
app.delete('/expenses/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM expenses WHERE id=?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json({ message: 'Expense deleted!' });
    });
});

// =======================================================
// REPORT ROUTES
// =======================================================

// GET report: Monthly spending by category (current month by default)
app.get('/reports/monthly', (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);  // YYYY-MM format
    db.query(
        `SELECT c.name, SUM(e.amount) AS total_spent, c.budget_limit,
         CASE WHEN SUM(e.amount) > c.budget_limit THEN 'Over Budget' ELSE 'Under Budget' END AS status
         FROM expenses e JOIN categories c ON e.category_id = c.id
         WHERE DATE_FORMAT(e.expense_date, '%Y-%m') = ?
         GROUP BY c.id, c.name, c.budget_limit`, 
        [month],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

// =======================================================
// GLOBAL ERROR HANDLER (MUST BE LAST MIDDLEWARE)
// =======================================================

// This catches any unhandled error (like a database connection failure or code crash) 
// and ensures a JSON response is returned instead of an HTML page.
app.use((err, req, res, next) => {
    // Check if headers were already sent (if so, defer to Express default)
    if (res.headersSent) {
        return next(err);
    }
    
    // Log the full error stack on the server side for debugging
    console.error(err.stack); 
    
    // Send a generic 500 JSON response
    res.status(500).json({
        error: "Internal Server Error: Unhandled crash on the server.",
        details: err.message // Provides the specific error message to the client
    });
});

// =======================================================
// START SERVER
// =======================================================

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

});

