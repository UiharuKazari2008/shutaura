const systemglobal = require('../../config.json');

const os = require('os');
const mysql = require('mysql2');
const sqlConnection = mysql.createPool({
    host: systemglobal.SQLServer,
    user: systemglobal.SQLUsername,
    password: systemglobal.SQLPassword,
    database: systemglobal.SQLDatabase,
    charset : 'utf8mb4',
    collation : 'utf8mb4_0900_ai_ci',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
const sqlPromise = sqlConnection.promise();


module.exports = function (facility, options) {
    let module = {};

    const Logger = require('./logSystem')(facility);
    module.simple = function (sql_q, callback) {
        sqlConnection.query(sql_q, function (err, rows) {
            //here we return the results of the query
            callback(err, rows);
        });
    }
    module.safe = function (sql_q, inputs, callback) {
        sqlConnection.query(mysql.format(sql_q, inputs), function (err, rows) {
            callback(err, rows);
        });
    }
    module.query = async function (sql_q, inputs) {
        try {
            const [rows,fields] = await sqlPromise.query(sql_q, inputs);
            return {
                rows, fields, sql_q, inputs
            }
        } catch (error) {
            Logger.printLine("SQL", error.message, "error", error);
            console.error(sql_q);
            console.error(inputs);
            console.error(error);
            return {
                rows: [],
                fields: {},
                sql_q,
                inputs,
                error
            }
        }
    }

    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err);
        process.exit(1);
    });

    return module;
}

