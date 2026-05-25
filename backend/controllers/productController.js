const db = require("../config/db");

// helper functions
const safeNumber = (value) => {
    const parsed =
        parseFloat(value);

    return isNaN(parsed)
        ? 0
        : parsed;
};

const safeInteger = (value) => {
    const parsed =
        parseInt(value);

    return isNaN(parsed)
        ? 0
        : parsed;
};

// get all products
const getProducts = (req, res) => {
    let query = `
        SELECT
            id,
            name,
            description,
            price,
            image,
            category,
            stock,
            featured
        FROM products
    `;
    const params = [];

    // category filter
    if (req.query.category) {
        query += " WHERE category = ?";
        params.push(
            String(
                req.query.category
            ).trim()
        );
    }

    // featured filter
    if (req.query.featured === "true") {
        query += params.length
            ? " AND featured = 1"
            : " WHERE featured = 1";
    }

    query += " ORDER BY id DESC";

    db.query(query, params, (error, results) => {
        if (error) {
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }

        res.status(200).json({
            success: true,
            products:
                Array.isArray(results)
                    ? results
                    : []
        });
    });
};

// get single product
const getSingleProduct = (req, res) => {
    const id =
        safeInteger(
            req.params.id
        );

    if (!id) {
        return res.status(400)
            .json({
                success: false,
                message:
                    "Invalid product ID"
            });
    }

    const query = `
        SELECT
            id,
            name,
            description,
            price,
            image,
            category,
            stock,
            featured
        FROM products
        WHERE id = ?
    `;

    db.query(query, [id], (error, results) => {
        if (error) {
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            product: results[0]
        });
    });
};

// create product
const createProduct = (req, res) => {
    const {
        name,
        description,
        price,
        image,
        category,
        stock,
        featured
    } = req.body;

    // basic validation
    if (!name || price === undefined) {
        return res.status(400).json({
            success: false,
            message: "Name and price are required"
        });
    }

    if (
        safeNumber(price) <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid product price"
        });
    }

    const query = `
        INSERT INTO products
        (name, description, price, image, category, stock, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [
            String(name).trim(),
            description || "",
            safeNumber(price),
            String(
                image || ""
            ).trim(),
            String(
                category || ""
            ).trim(),
            Math.max(
                0,
                safeInteger(stock)
            ),
            featured === true
            || featured === 1
            || featured === "1"
                ? 1
                : 0
        ],
        (error, result) => {
            if (error) {
                console.error(error);

                return res.status(500).json({
                    success: false,
                    message: "Server error"
                });
            }

            res.status(201).json({
                success: true,
                message: "Product created successfully",
                productId: result.insertId
            });
        }
    );
};

// update product
const updateProduct = (req, res) => {
    const id =
        safeInteger(
            req.params.id
        );

    const {
        name,
        description,
        price,
        image,
        category,
        stock,
        featured
    } = req.body;

    if (!id) {
        return res.status(400)
            .json({
                success: false,
                message:
                    "Invalid product ID"
            });
    }

    // basic validation
    if (!name || price === undefined) {
        return res.status(400).json({
            success: false,
            message: "Name and price are required"
        });
    }

    if (
        safeNumber(price) <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid product price"
        });
    }

    const query = `
        UPDATE products
        SET
            name = ?,
            description = ?,
            price = ?,
            image = ?,
            category = ?,
            stock = ?,
            featured = ?
        WHERE id = ?
    `;

    db.query(
        query,
        [
            String(name).trim(),
            description || "",
            safeNumber(price),
            String(
                image || ""
            ).trim(),
            String(
                category || ""
            ).trim(),
            Math.max(
                0,
                safeInteger(stock)
            ),
            featured === true
            || featured === 1
            || featured === "1"
                ? 1
                : 0,
            id
        ],
        (error, result) => {
            if (error) {
                console.error(error);

                return res.status(500).json({
                    success: false,
                    message: "Server error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            res.status(200).json({
                success: true,
                message: "Product updated successfully"
            });
        }
    );
};

// delete product
const deleteProduct = (req, res) => {
    const id =
        safeInteger(
            req.params.id
        );

    if (!id) {
        return res.status(400)
            .json({
                success: false,
                message:
                    "Invalid product ID"
            });
    }

    const query = "DELETE FROM products WHERE id = ?";

    db.query(query, [id], (error, result) => {
        if (error) {
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });
    });
};

module.exports = {
    getProducts,
    getSingleProduct,
    createProduct,
    updateProduct,
    deleteProduct
};