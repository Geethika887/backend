const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const methodOverride = require('method-override');

const app = express();
const port = 3005;

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));

// Set up MySQL connection pool
const connection = mysql.createPool({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: 'root',
    database: 'my_database'
});

// Set up bodyParser middleware
app.use(bodyParser.json());

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static('uploads'));

// Check if connected to MySQL database
connection.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Render form for creating a new product
app.get('/products/new', (req, res) => {
    res.render('new-product', { errors: null });
});

// Create a new product
app.post('/products', upload.single('image'), (req, res) => {
    const { name, price, description, category } = req.body;
    const imagePath = req.file ? req.file.filename : null;

    if (!name || !price || !description || !category) {
        res.status(400).json({ error: 'Name, price, description, and category are required' });
        return;
    }

    connection.query(
        'INSERT INTO products (name, price, description, category, imagePath) VALUES (?, ?, ?, ?, ?)',
        [name, price, description, category, imagePath],
        (err, result) => {
            if (err) {
                console.error('Error inserting product:', err);
                res.status(500).json({ error: 'Error inserting product' });
                return;
            }
            res.redirect('/products');
        }
    );
});

// Render list of products
app.get('/products', (req, res) => {
    connection.query('SELECT * FROM products', (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            res.status(500).send(err);
            return;
        }
        res.render('product-list', { products });
    });
});

// Delete a product by ID
app.delete('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id; // Retrieve product ID from the URL parameters
        connection.query('DELETE FROM products WHERE id = ?', [productId], (err, result) => {
            if (err) {
                console.error('Error deleting product:', err);
                return res.status(500).json({ error: 'Error deleting product' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.redirect('/products'); 
        });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Render form for editing a product
app.get('/products/:id/edit', (req, res) => {
    const productId = req.params.id;
    connection.query('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            res.status(500).send(err);
            return;
        }
        if (product.length === 0) {
            res.status(404).send('Product not found');
            return;
        }
        res.render('edit-product', { product: product[0], errors: null });
    });
});

// Update a product by ID
app.put('/products/:id', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    const { name, price, description, category } = req.body;

    if (!name || !price || !description || !category) {
        res.status(400).json({ error: 'Name, price, description, and category are required' });
        return;
    }

    connection.query('SELECT * FROM products WHERE id = ?', [productId], (err, rows) => {
        if (err) {
            console.error('Error finding product:', err);
            res.status(500).json({ error: 'Error updating product' });
            return;
        }
        if (rows.length === 0) {
            res.status(404).send('Product not found');
            return;
        }

        const imagePath = req.file ? req.file.filename : rows[0].imagePath;
        connection.query(
            'UPDATE products SET name = ?, price = ?, description = ?, category = ?, imagePath = ? WHERE id = ?',
            [name, price, description, category, imagePath, productId],
            (updateErr, updateResult) => {
                if (updateErr) {
                    console.error('Error updating product:', updateErr);
                    res.status(500).json({ error: 'Error updating product' });
                    return;
                }
                res.redirect('/products');
            }
        );
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});