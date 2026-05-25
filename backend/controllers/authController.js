const bcrypt =
    require("bcryptjs");

const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");

const db =
    require("../config/db");

// validation patterns
const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

// environment validation
if (!process.env.JWT_SECRET) {
    throw new Error(
        "JWT_SECRET environment variable is not set"
    );
}

// helper utilities
const sanitizeString = (value) => {
    return String(
        value || ""
    ).trim();
};

const generateAccessToken =
    (user) => {
        return jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "15m"
            }
        );
    };

const generateRefreshToken =
    () => {
        return crypto
            .randomBytes(40)
            .toString("hex");
    };

// signup
const signup =
    async (req, res) => {
        try {
            const {
                name,
                email,
                password
            } = req.body;

            const cleanName =
                sanitizeString(name);

            const cleanEmail =
                sanitizeString(email)
                    .toLowerCase();

            // validation
            if (
                !cleanName
                || !cleanEmail
                || !password
            ) {
                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "All fields are required"
                    });
            }

            if (
                cleanName.length < 2
            ) {
                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Name must be at least 2 characters"
                    });
            }

            if (
                !emailRegex.test(
                    cleanEmail
                )
            ) {
                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid email format"
                    });
            }

            if (
                password.length < 8
            ) {
                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Password must be at least 8 characters"
                    });
            }

            if (
                !strongPasswordRegex
                    .test(password)
            ) {
                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Password must contain uppercase, lowercase, number and special character"
                    });
            }

            // check existing user
            db.query(
                `
                    SELECT id
                    FROM users
                    WHERE email = ?
                `,
                [cleanEmail],
                async (
                    error,
                    result
                ) => {
                    if (error) {
                        console.error(
                            error
                        );

                        return res.status(500)
                            .json({
                                success: false,
                                message:
                                    "Server error"
                            });
                    }

                    if (
                        result.length > 0
                    ) {
                        return res.status(400)
                            .json({
                                success: false,
                                message:
                                    "User already exists"
                            });
                    }

                    // hash password
                    const hashedPassword =
                        await bcrypt.hash(
                            password,
                            10
                        );

                    // insert user
                    db.query(
                        `
                            INSERT INTO users
                            (
                                name,
                                email,
                                password,
                                role
                            )
                            VALUES (?, ?, ?, ?)
                        `,
                        [
                            cleanName,
                            cleanEmail,
                            hashedPassword,
                            "user"
                        ],
                        (
                            insertError
                        ) => {
                            if (
                                insertError
                            ) {
                                console.error(
                                    insertError
                                );

                                return res.status(500)
                                    .json({
                                        success: false,
                                        message:
                                            "Server error"
                                    });
                            }

                            res.status(201)
                                .json({
                                    success: true,
                                    message:
                                        "User registered successfully"
                                });
                        }
                    );
                }
            );

        } catch (error) {
            console.error(error);

            res.status(500)
                .json({
                    success: false,
                    message:
                        "Server error"
                });
        }
    };

// login
const login =
    async (req, res) => {
        try {
            const {
                email,
                password
            } = req.body;

            const cleanEmail =
                sanitizeString(email)
                    .toLowerCase();

            if (
                !cleanEmail
                || !password
            ) {
                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Email and password required"
                    });
            }

            db.query(
                `
                    SELECT *
                    FROM users
                    WHERE email = ?
                `,
                [cleanEmail],
                async (
                    error,
                    result
                ) => {
                    if (error) {
                        console.error(
                            error
                        );

                        return res.status(500)
                            .json({
                                success: false,
                                message:
                                    "Server error"
                            });
                    }

                    if (
                        !Array.isArray(result)
                        || !result.length
                    ) {
                        return res.status(400)
                            .json({
                                success: false,
                                message:
                                    "Invalid credentials"
                            });
                    }

                    const user =
                        result[0];

                    // inactive account check
                    if (
                        user.isActive === 0
                    ) {
                        return res.status(403)
                            .json({
                                success: false,
                                message:
                                    "Account has been deactivated"
                            });
                    }

                    const isMatch =
                        await bcrypt.compare(
                            password,
                            user.password
                        );

                    if (!isMatch) {
                        return res.status(400)
                            .json({
                                success: false,
                                message:
                                    "Invalid credentials"
                            });
                    }

                    // generate tokens
                    const accessToken =
                        generateAccessToken(
                            user
                        );

                    const refreshToken =
                        generateRefreshToken();

                    // save refresh token
                    db.query(
                        `
                            UPDATE users
                            SET refresh_token = ?
                            WHERE id = ?
                        `,
                        [
                            refreshToken,
                            user.id
                        ],
                        (
                            refreshError
                        ) => {
                            if (
                                refreshError
                            ) {
                                console.error(
                                    "Failed to save refresh token:",
                                    refreshError
                                );

                                return res.status(500)
                                    .json({
                                        success: false,
                                        message:
                                            "Server error"
                                    });
                            }

                            res.status(200)
                                .json({
                                    success: true,
                                    message:
                                        "Login successful",

                                    accessToken,

                                    refreshToken,

                                    user: {
                                        id:
                                            user.id,

                                        name:
                                            user.name,

                                        email:
                                            user.email,

                                        role:
                                            user.role
                                    }
                                });
                        }
                    );
                }
            );

        } catch (error) {
            console.error(error);

            res.status(500)
                .json({
                    success: false,
                    message:
                        "Server error"
                });
        }
    };

// refresh access token
const refreshAccessToken =
    async (req, res) => {
        try {
            const {
                refreshToken
            } = req.body;

            const cleanRefreshToken =
                sanitizeString(
                    refreshToken
                );

            if (
                !cleanRefreshToken
            ) {
                return res.status(401)
                    .json({
                        success: false,
                        message:
                            "Refresh token required"
                    });
            }

            db.query(
                `
                    SELECT
                        id,
                        role
                    FROM users
                    WHERE refresh_token = ?
                `,
                [
                    cleanRefreshToken
                ],
                (
                    error,
                    result
                ) => {
                    if (error) {
                        console.error(
                            error
                        );

                        return res.status(500)
                            .json({
                                success: false,
                                message:
                                    "Server error"
                            });
                    }

                    if (
                        !Array.isArray(result)
                        || !result.length
                    ) {
                        return res.status(401)
                            .json({
                                success: false,
                                message:
                                    "Invalid refresh token"
                            });
                    }

                    const user =
                        result[0];

                    const newAccessToken =
                        generateAccessToken(
                            user
                        );

                    // rotate refresh token
                    const newRefreshToken =
                        generateRefreshToken();

                    db.query(
                        `
                            UPDATE users
                            SET refresh_token = ?
                            WHERE id = ?
                        `,
                        [
                            newRefreshToken,
                            user.id
                        ],
                        (
                            updateError
                        ) => {
                            if (
                                updateError
                            ) {
                                console.error(
                                    updateError
                                );

                                return res.status(500)
                                    .json({
                                        success: false,
                                        message:
                                            "Server error"
                                    });
                            }

                            res.status(200)
                                .json({
                                    success: true,

                                    accessToken:
                                        newAccessToken,

                                    refreshToken:
                                        newRefreshToken
                                });
                        }
                    );
                }
            );

        } catch (error) {
            console.error(error);

            res.status(500)
                .json({
                    success: false,
                    message:
                        "Server error"
                });
        }
    };

module.exports = {
    signup,
    login,
    refreshAccessToken
};