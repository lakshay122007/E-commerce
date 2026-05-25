const db =
    require("../config/db");

// safe helpers
const safeNumber = (
    value
) => {
    const parsed =
        parseFloat(value);

    return isNaN(parsed)
        ? 0
        : parsed;
};

const safeInteger = (
    value
) => {
    const parsed =
        parseInt(value);

    return isNaN(parsed)
        ? 0
        : parsed;
};

// create order service
const createOrderService =
    (
        orderData
    ) => {
        return new Promise(
            (
                resolve,
                reject
            ) => {

                db.getConnection(
                    (
                        connectionError,
                        connection
                    ) => {

                        if (
                            connectionError
                        ) {
                            return reject(
                                connectionError
                            );
                        }

                        connection.beginTransaction(
                            (
                                transactionError
                            ) => {

                                if (
                                    transactionError
                                ) {
                                    connection.release();

                                    return reject(
                                        transactionError
                                    );
                                }

                                const {
                                    user_id,
                                    customer_name,
                                    customer_email,
                                    customer_phone,
                                    city,
                                    state,
                                    zip,
                                    full_address,
                                    payment_method,
                                    items
                                } =
                                    orderData;

                                // validate items
                                if (
                                    !Array.isArray(
                                        items
                                    )
                                    ||
                                    !items.length
                                ) {
                                    connection.release();

                                    return reject(
                                        new Error(
                                            "Order items are required"
                                        )
                                    );
                                }

                                // calculate total server-side
                                const calculatedTotal =
                                    items.reduce(
                                        (
                                            sum,
                                            item
                                        ) => {
                                            return (
                                                sum +
                                                (
                                                    safeNumber(
                                                        item.price
                                                    ) *
                                                    Math.max(
                                                        1,
                                                        safeInteger(
                                                            item.qty
                                                        )
                                                    )
                                                )
                                            );
                                        },
                                        0
                                    );

                                // create order
                                const orderQuery = `
                                    INSERT INTO orders
                                    (
                                        user_id,
                                        customer_name,
                                        customer_email,
                                        customer_phone,
                                        city,
                                        state,
                                        zip,
                                        full_address,
                                        payment_method,
                                        total
                                    )
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `;

                                connection.query(
                                    orderQuery,
                                    [
                                        user_id,
                                        customer_name,
                                        customer_email,
                                        customer_phone,
                                        city,
                                        state,
                                        zip,
                                        full_address,
                                        payment_method,
                                        calculatedTotal
                                    ],
                                    (
                                        orderError,
                                        orderResult
                                    ) => {

                                        if (
                                            orderError
                                        ) {
                                            return connection.rollback(
                                                () => {
                                                    connection.release();

                                                    reject(
                                                        orderError
                                                    );
                                                }
                                            );
                                        }

                                        const orderId =
                                            orderResult.insertId;

                                        // insert items
                                        const itemPromises =
                                            items.map(
                                                (
                                                    item
                                                ) => {

                                                    return new Promise(
                                                        (
                                                            itemResolve,
                                                            itemReject
                                                        ) => {

                                                            const itemQuery = `
                                                                INSERT INTO order_items
                                                                (
                                                                    order_id,
                                                                    product_id,
                                                                    name,
                                                                    price,
                                                                    qty,
                                                                    color,
                                                                    size
                                                                )
                                                                VALUES (?, ?, ?, ?, ?, ?, ?)
                                                            `;

                                                            connection.query(
                                                                itemQuery,
                                                                [
                                                                    orderId,
                                                                    item.id,
                                                                    item.name,
                                                                    safeNumber(
                                                                        item.price
                                                                    ),
                                                                    Math.max(
                                                                        1,
                                                                        safeInteger(
                                                                            item.qty
                                                                        )
                                                                    ),
                                                                    item.color || "",
                                                                    item.size || ""
                                                                ],
                                                                (
                                                                    itemError
                                                                ) => {

                                                                    if (
                                                                        itemError
                                                                    ) {
                                                                        return itemReject(
                                                                            itemError
                                                                        );
                                                                    }

                                                                    // update stock
                                                                    const stockQuery = `
                                                                        UPDATE products
                                                                        SET stock = stock - ?
                                                                        WHERE id = ?
                                                                        AND stock >= ?
                                                                    `;

                                                                    connection.query(
                                                                        stockQuery,
                                                                        [
                                                                            Math.max(
                                                                                1,
                                                                                safeInteger(
                                                                                    item.qty
                                                                                )
                                                                            ),
                                                                            item.id,
                                                                            Math.max(
                                                                                1,
                                                                                safeInteger(
                                                                                    item.qty
                                                                                )
                                                                            )
                                                                        ],
                                                                        (
                                                                            stockError,
                                                                            stockResult
                                                                        ) => {

                                                                            if (
                                                                                stockError
                                                                            ) {
                                                                                return itemReject(
                                                                                    stockError
                                                                                );
                                                                            }

                                                                            if (
                                                                                stockResult.affectedRows === 0
                                                                            ) {
                                                                                return itemReject(
                                                                                    new Error(
                                                                                        `Insufficient stock for ${item.name}`
                                                                                    )
                                                                                );
                                                                            }

                                                                            itemResolve();
                                                                        }
                                                                    );
                                                                }
                                                            );
                                                        }
                                                    );
                                                }
                                            );

                                        Promise.all(
                                            itemPromises
                                        )

                                            .then(
                                                () => {

                                                    connection.commit(
                                                        (
                                                            commitError
                                                        ) => {

                                                            if (
                                                                commitError
                                                            ) {
                                                                return connection.rollback(
                                                                    () => {
                                                                        connection.release();

                                                                        reject(
                                                                            commitError
                                                                        );
                                                                    }
                                                                );
                                                            }

                                                            connection.release();

                                                            resolve({
                                                                success: true,
                                                                orderId,
                                                                total:
                                                                    calculatedTotal
                                                            });
                                                        }
                                                    );
                                                }
                                            )

                                            .catch(
                                                (
                                                    itemError
                                                ) => {

                                                    connection.rollback(
                                                        () => {
                                                            connection.release();

                                                            reject(
                                                                itemError
                                                            );
                                                        }
                                                    );
                                                }
                                            );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    };

module.exports = {
    createOrderService
};