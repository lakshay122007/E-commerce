const mysql =
    require("mysql2");

require("dotenv")
    .config();

// validate environment variables
const requiredEnvVars = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
        console.error(
            `Missing environment variable: ${key}`
        );

        process.exit(1);
    }
});

// create pool
const pool =
    mysql.createPool({

        host:
            process.env.DB_HOST,

        user:
            process.env.DB_USER,

        password:
            process.env.DB_PASSWORD,

        database:
            process.env.DB_NAME,

        waitForConnections: true,

        connectionLimit: 10,

        queueLimit: 0,

        connectTimeout: 10000,

        charset: "utf8mb4"
    });

// database connection test
pool.getConnection(
    (
        error,
        connection
    ) => {
        if (error) {
            console.error(
                "Database Connection Failed:"
            );

            console.error(error);

            process.exit(1);
        }

        console.log(
            "MySQL Connected Successfully"
        );

        if (connection) {
            connection.release();
        }
    }
);

// graceful shutdown
process.on(
    "SIGINT",
    () => {
        console.log(
            "\nClosing MySQL connections..."
        );

        pool.end(
            (error) => {
                if (error) {
                    console.error(
                        "Error closing MySQL pool:",
                        error
                    );

                    process.exit(1);
                }

                console.log(
                    "MySQL pool closed"
                );

                process.exit(0);
            }
        );
    }
);

// handle pool errors
pool.on(
    "error",
    (error) => {

        console.error(
            "MySQL Pool Error:",
            error
        );
    }
);

// export callback pool
module.exports =
    pool;