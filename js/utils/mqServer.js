const systemglobal = require('../../config.json');

const os = require('os');
const { clone } = require('./tools');
const amqp = require('amqplib/callback_api');
const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`

module.exports = function (facility, options) {
    let amqpConn = null;
    const EventEmitter = require('events');
    const emitter = new EventEmitter();
    const Logger = require('./logSystem')(facility);

    emitter.on('uncaughtException', function (err) {
        console.error(err);
        process.exit(1)
    });

    amqp.connect(MQServer, function(err, conn) {
        if (err) {
            Logger.printLine("KanmiMQ", "Initialization Error", "critical", err)
            return setTimeout(start, 1000);
        }
        conn.on("error", function(err) {
            if (err.message !== "Connection closing") {
                Logger.printLine("KanmiMQ", "Initialization Connection Error", "emergency", err)
            }
        });
        conn.on("close", function() {
            Logger.printLine("KanmiMQ", "Attempting to Reconnect...", "debug")
            return setTimeout(start, 1000);
        });
        Logger.printLine("KanmiMQ", `Connected to Kanmi Exchange as ${systemglobal.SystemName}!`, "info")
        amqpConn = conn;
        startWorker();
    });
    function startWorker() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 1 Error", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 1 Closed", "critical" )
                start();
            });
            ch.prefetch(10);
            ch.assertQueue(MQWorker1, { durable: true }, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.consume(MQWorker1, processMsg, { noAck: false });
                Logger.printLine("KanmiMQ", "Channel 1 Worker Ready", "debug")
            });
            function processMsg(msg) {
                work(msg, function(ok) {
                    try {
                        if (ok)
                            ch.ack(msg);
                        else
                            ch.reject(msg, true);
                    } catch (e) {
                        closeOnErr(e);
                    }
                });
            }
        });
    }
    function work(msg, cb) {
        limiter3.removeTokens(1, function() {
            const MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
            doAction(MessageContents, cb);
        });
    }
    function closeOnErr(err) {
        if (!err) return false;
        Logger.printLine("KanmiMQ", "Connection Closed due to error", "error", err)
        amqpConn.close();
        return true;
    }

    return emitter;
}

