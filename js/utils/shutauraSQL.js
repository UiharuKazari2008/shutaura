let systemglobal = require('../../config.json');
if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
if (process.env.DATABASE_HOST && process.env.DATABASE_HOST.trim().length > 0)
    systemglobal.SQLServer = process.env.DATABASE_HOST.trim()
if (process.env.DATABASE_NAME && process.env.DATABASE_NAME.trim().length > 0)
    systemglobal.SQLDatabase = process.env.DATABASE_NAME.trim()
if (process.env.DATABASE_USERNAME && process.env.DATABASE_USERNAME.trim().length > 0)
    systemglobal.SQLUsername = process.env.DATABASE_USERNAME.trim()
if (process.env.DATABASE_PASSWORD && process.env.DATABASE_PASSWORD.trim().length > 0)
    systemglobal.SQLPassword = process.env.DATABASE_PASSWORD.trim()
if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
    systemglobal.MQServer = process.env.MQ_HOST.trim()
if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
    systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
    systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

const os = require('os');
const mysql = require('mysql2');
const sqlConnection = mysql.createPool({
    host: systemglobal.SQLServer,
    user: systemglobal.SQLUsername,
    password: systemglobal.SQLPassword,
    database: systemglobal.SQLDatabase,
    charset : 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 1,
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
            const [rows,fields,affectedRows] = await sqlPromise.query(sql_q, inputs);
            return {
                rows, fields, sql_q, inputs, affectedRows
            }
        } catch (error) {
            Logger.printLine("SQL", error.message, "error", error);
            console.error(sql_q);
            console.error(inputs);
            console.error(error);
            return {
                rows: [],
                affectedRows: 0,
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

