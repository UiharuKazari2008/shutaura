let systemglobal = require('../../config.json');
if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
    systemglobal.SystemName = process.env.SYSTEM_NAME.trim()

const os = require('os');
const { clone } = require('./tools');
const amqp = require('amqplib/callback_api');
const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`
const db = require('./shutauraSQL')("MQClient");

let staticChID = {};
db.safe(`SELECT * FROM discord_servers WHERE serverid = ?`, [systemglobal.DiscordHomeGuild], (err, homeGuild) => {
    if (err) {
        console.error(`Failed to get Home Guild, please make sure you have set the DiscordHomeGuild parameter and the server exists in the database!`)
    } else if (homeGuild && homeGuild.length > 0) {
        staticChID = {
            System         : `${homeGuild[0].chid_system}`,
            AlrmInfo       : `${homeGuild[0].chid_msg_info}`,
            AlrmWarn       : `${homeGuild[0].chid_msg_warn}`,
            AlrmErr        : `${homeGuild[0].chid_msg_err}`,
            AlrmCrit       : `${homeGuild[0].chid_msg_crit}`,
            AlrmNotif      : `${homeGuild[0].chid_msg_notif}`,
        }
    }
});

module.exports = function (facility, sgoveride) {
    if (sgoveride)
        systemglobal = sgoveride
    let module = {};
    let amqpConn = null;
    let pubChannel = null;
    const Logger = require('./logSystem')(facility);


    function publish(exchange, routingKey, content, callback) {
        try {
            pubChannel.publish(exchange, routingKey, content, { persistent: true },
                function(err, ok) {
                    if (err) {
                        Logger.printLine("KanmiMQ", "Failed to Publish Message", "critical", err)
                        pubChannel.connection.close();
                        callback(false)
                    } else {
                        callback(true)
                    }
                });
        } catch (e) {
            Logger.printLine("KanmiMQ", "Publish Error", "error", e)
            callback(false)
        }
    }
    function sendData(client, content, ok) {
        let exchange = "kanmi.exchange";
        let cleanObject = clone(content)
        if ( content.hasOwnProperty('itemFileData' ) ) {
            delete cleanObject.itemFileData
        }
        publish(exchange, client, new Buffer.from(JSON.stringify(content), 'utf-8'), function (callback) {
            if (callback) {
                ok(true);
                if (client !== systemglobal.Sequenzia_In) {
                    //Logger.printLine("KanmiMQ", `Sent message to ${client}`, "info", cleanObject)
                }
            } else {
                ok(false)
            }
        });
    }
    function publishData(client, content) {
        return new Promise(ok => {
            let exchange = "kanmi.exchange";
            let cleanObject = clone(content)
            if ( content.hasOwnProperty('itemFileData' ) ) {
                delete cleanObject.itemFileData
            }
            publish(exchange, client, new Buffer.from(JSON.stringify(content), 'utf-8'), function (callback) {
                ok(callback);
            });
        })

    }
    function closeOnErr(err) {
        if (!err) return false;
        Logger.printLine("KanmiMQ", "Connection Closed due to error", "error", err)
        amqpConn.close();
        return true;
    }

    amqp.connect(MQServer, function(err, conn) {
        if (err) {
            Logger.printLine("KanmiMQ", "Initialization Error", "critical", err)
            return setTimeout(function () {
                process.exit(1)
            }, 1000);
        }
        conn.on("error", function(err) {
            if (err.message !== "Connection closing") {
                Logger.printLine("KanmiMQ", "Initialization Connection Error", "emergency", err)
            }
        });
        conn.on("close", function() {
            Logger.printLine("KanmiMQ", "Attempting to Reconnect...", "debug")
            return setTimeout(function () {
                process.exit(1)
            }, 1000);
        });
        Logger.printLine("KanmiMQ", `Publisher Connected to Kanmi Exchange as ${systemglobal.SystemName}!`, "info")
        amqpConn = conn;
        amqpConn.createConfirmChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel Error", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel Closed", "critical", {
                    message: "null"
                })
            });
            pubChannel = ch;
        });
    });

    module.sendMessage = function (message, channel, proccess, inbody) {
        if (staticChID.System) {
            let body = 'undefined'
            let proc = 'Unknown'
            if (typeof proccess !== 'undefined' && proccess) {
                if (proccess !== 'Unknown') {
                    proc = proccess
                }
            }
            if (typeof inbody !== 'undefined' && inbody) {
                if (proc === "SQL") {
                    body = "" + inbody.sqlMessage
                } else if (Object.getPrototypeOf(inbody) === Object.prototype) {
                    if (inbody.message) {
                        body = "" + inbody.message
                    } else {
                        body = "" + JSON.stringify(inbody)
                    }
                } else {
                    body = "" + inbody
                }
            }

            let sendto = staticChID.System
            let errmessage = ""
            let loglevel = ''
            if (channel === "system") {
                sendto = staticChID.System
                loglevel = 'info'
                message = "" + message
            } else if (channel === "info") {
                sendto = staticChID.AlrmInfo
                loglevel = 'info'
                message = "🆗 " + message
            } else if (channel === "warn" || channel === "warning") {
                sendto = staticChID.AlrmWarn
                loglevel = 'warning'
                message = "⚠ " + message
            } else if (channel === "err" || channel === "error") {
                sendto = staticChID.AlrmErr
                loglevel = 'error'
                message = "❌ " + message
            } else if (channel === "crit" || channel === "critical") {
                sendto = staticChID.AlrmCrit
                loglevel = 'critical'
                message = "⛔ " + message
            } else if (channel === "message" || channel === "notify") {
                sendto = staticChID.AlrmNotif
                loglevel = 'notice'
            } else {
                message = "❕ " + message
                loglevel = 'alert'
                sendto = channel
            }
            if (body !== "undefined") {
                errmessage = ":\n```" + body.substring(0, 500) + "```"
            }
            if (channel === "err" || channel === "error" || channel === "crit" || channel === "critical") {
                Logger.printLine(proc, message, loglevel, inbody)
            } else {
                Logger.printLine(proc, message, loglevel)
            }
            sendData(`${systemglobal.Discord_Out}.priority`, {
                fromClient: `return.${facility}.${os.hostname()}`,
                messageReturn: false,
                messageType: 'stext',
                messageChannelID: sendto,
                messageText: message.substring(0, 255) + errmessage
            }, function (ok) {
            });
        } else {
            console.error(`Missing Home Guild, please make sure you have set the DiscordHomeGuild parameter and the server exists in the database!`)
        }
    }
    module.sendCmd = function (client, content, exchangeLevel) {
        let exchange = "kanmi.command";
        if (exchangeLevel) {
            exchange += "." + exchangeLevel
        }
        publish(exchange, `command.${client}`, new Buffer.from(JSON.stringify({
            command: content
        }), 'utf-8'), function (callback) {
            if (callback) {
                Logger.printLine("KanmiMQ", `Sent command to ${client}`, "info", content)
            } else {

            }
        });
    }
    module.sendData = sendData;
    module.publishData = publishData;

    return module
}

