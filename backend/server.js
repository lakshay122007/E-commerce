const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

// config
dotenv.config();

// database
require("./config/db");

// routes
const productRoutes =
    require("./routes/productRoutes");

const authRoutes =
    require("./routes/authRoutes");

const orderRoutes =
    require("./routes/orderRoutes");

// app
const app =
    express();

// constants
const PORT =
    process.env.PORT || 5000;

const FRONTEND_URL =
    process.env.FRONTEND_URL
    || "http://localhost:5500";

// security
app.disable(
    "x-powered-by"
);

app.use(
    helmet()
);

// cors
app.use(
    cors({
        origin:
            FRONTEND_URL,

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "PATCH"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ],

        credentials: true
    })
);

// body parser
app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

// request logger
if (
    process.env.NODE_ENV !== "production"
) {
    app.use(
        (
            req,
            res,
            next
        ) => {

            console.log(
                `${req.method} ${req.originalUrl}`
            );

            next();
        }
    );
}

// rate limiter
const authLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max: 20,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many requests. Please try again later."
        }
    });

// auth limiter
app.use(
    "/api/auth/login",
    authLimiter
);

app.use(
    "/api/auth/signup",
    authLimiter
);

// health route
app.get(
    "/health",
    (
        req,
        res
    ) => {

        res.status(200).json({
            success: true,
            message:
                "Server is healthy"
        });
    }
);

// home route
app.get(
    "/",
    (
        req,
        res
    ) => {

        res.status(200).json({
            success: true,
            message:
                "E-Commerce Backend Running 🚀"
        });
    }
);

// api routes
app.use(
    "/api/products",
    productRoutes
);

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/orders",
    orderRoutes
);

// 404
app.use(
    (
        req,
        res
    ) => {

        res.status(404).json({
            success: false,
            message:
                "Route not found"
        });
    }
);

// global error handler
app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            err
        );

        if (
            res.headersSent
        ) {
            return next(err);
        }

        res.status(
            err.status || 500
        ).json({
            success: false,
            message:
                err.message ||
                "Internal server error"
        });
    }
);

// graceful shutdown
process.on(
    "SIGINT",
    () => {

        console.log(
            "\nShutting down server..."
        );

        process.exit(0);
    }
);

// start server
app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            `Environment: ${
                process.env.NODE_ENV
                || "development"
            }`
        );

        console.log(
            `Frontend URL: ${FRONTEND_URL}`
        );
    }
);