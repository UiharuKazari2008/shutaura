// Logging System


const systemglobal = require('../../config.json');
const colors = require('colors');
const { hostname } = require("os");
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
const graylog2 = require("graylog2");
let logger1 = undefined
let logger2 = undefined
let remoteLogging1 = false
let remoteLogging2 = false

module.exports = function (facility, options) {
    let module = {};
    if (systemglobal.LogServer && systemglobal.LogServer.length > 0) {
        if (systemglobal.LogServer.length >= 1) {
            remoteLogging1 = true
            logger1 = new graylog2.graylog({
                servers: [systemglobal.LogServer[0]],
                hostname: hostname(),
                facility: facility,
                bufferSize: 1350
            });
            logger1.on('error', (error) => { console.error('Error while trying to write to graylog host NJA:'.red, error) });

            logger1.debug(`Init : Forwarding logs to Graylog Server 1`, { process: 'Init' });
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][Init] Forwarding logs to Graylog Server 1 - ${facility}`.gray);
        }
        if (systemglobal.LogServer.length >= 2) {
            remoteLogging2 = true
            logger2 = new graylog2.graylog({
                servers: [systemglobal.LogServer[1]],
                hostname: hostname(),
                facility: facility,
                bufferSize: 1350
            });
            logger2.on('error', (error) => { console.error('Error while trying to write to graylog host END:'.red, error) });

            logger1.debug(`Init : Forwarding logs to Graylog Server 2`, { process: 'Init' });
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][Init] Forwarding logs to Graylog Server 2 - ${facility}`.gray);
        }
    }
    module.printLine = async function printLine(proccess, text, level, object, object2) {
        let logObject = {}
        let logClient = "Unknown"
        if (proccess) {
            logClient = proccess
        }
        logObject.process = logClient
        let logString =  `${logClient} : ${text}`
        if (typeof object !== 'undefined' || (object && object !== null)) {
            if ( (typeof (object) === 'string' || typeof (object) === 'number' || object instanceof String) ) {
                logString += ` : ${object}`
            } else if (typeof(object) === 'object') {
                logObject = Object.assign({}, logObject, object)
                if (object.hasOwnProperty('message')) {
                    logString += ` : ${object.message}`
                } else if (object.hasOwnProperty('sqlMessage')) {
                    logString += ` : ${object.sqlMessage}`
                } else if (object.hasOwnProperty('itemFileData')) {
                    delete logObject.itemFileData
                    logObject.itemFileData = object.itemFileData.length
                } else if (object.hasOwnProperty('itemFileArray')) {
                    delete logObject.itemFileArray
                }
            }
        }
        if (typeof object2 !== 'undefined' || (object2 && object2 !== null)) {
            if (typeof(object2) === 'string' || typeof(object2) === 'number' || object2 instanceof String) {
                logObject.extraMessage = object2.toString()
            } else if (typeof(object2) === 'object') {
                logObject = Object.assign({}, logObject, object2)
                if (object2.hasOwnProperty('itemFileData')) {
                    delete logObject.itemFileData
                    logObject.itemFileData = object2.itemFileData.length
                } else if (object.hasOwnProperty('itemFileArray')) {
                    delete logObject.itemFileArray
                }
            }
        }
        if (level === "warn" || level === "warning") {
            if (remoteLogging1) { logger1.warning(logString, logObject) }
            if (remoteLogging2) { logger2.warning(logString, logObject) }
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgYellow)
            if (!text.toLowerCase().includes('block') && systemglobal.log_objects) {
                console.error(logObject)
            }
        } else if (level === "error" || level === "err") {
            if (remoteLogging1) { logger1.error(logString, logObject) }
            if (remoteLogging2) { logger2.error(logString, logObject) }
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgRed)
            console.error(logObject)
        } else if (level === "critical" || level === "crit") {
            if (remoteLogging1) { logger1.critical(logString, logObject) }
            if (remoteLogging2) { logger2.critical(logString, logObject) }
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.bgMagenta)
            console.error(logObject)
        } else if (level === "alert") {
            if (remoteLogging1) { logger1.alert(logString, logObject) }
            if (remoteLogging2) { logger2.alert(logString, logObject) }
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.red)
            console.log(logObject)
        } else if (level === "emergency") {
            if (remoteLogging1) { logger1.emergency(logString, logObject) }
            if (remoteLogging2) { logger2.emergency(logString, logObject) }
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.bgMagenta)
            console.error(logObject)
            sleep(250).then(() => {
                process.exit(4);
            })
        } else if (level === "notice") {
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.green)
            if (remoteLogging1) { logger1.notice(logString, logObject) } else if (systemglobal.log_objects) { console.log(logObject) }
            if (remoteLogging2) { logger2.notice(logString, logObject) }
        } else if (level === "alert") {
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.green)
            if (remoteLogging1) { logger1.alert(logString, logObject) } else if (systemglobal.log_objects) { console.log(logObject) }
            if (remoteLogging2) { logger2.alert(logString, logObject) }
        } else if (level === "debug") {
            if (remoteLogging1) { logger1.debug(logString, logObject) } else if (systemglobal.log_objects) { console.log(logObject) }
            if (remoteLogging2) { logger2.debug(logString, logObject) }
            if (text.includes("New Message: ") || text.includes("Reaction Added: ")) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgCyan)
            } else if (text.includes('Message Deleted: ') || text.includes('Reaction Removed: ')) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgBlue)
            } else if (text.includes('Send Message: ') || text.includes('Status Update: ')) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgGreen)
            } else if (text.includes('Send Package: ')) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgCyan)
            } else {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.gray)
            }
        } else if (level === "info") {
            if (remoteLogging1) { logger1.info(logString, logObject) } else if (systemglobal.log_objects) { console.log(logObject) }
            if (remoteLogging2) { logger2.info(logString, logObject) }
            if (text.includes("Sent message to ") || text.includes("Connected to Kanmi Exchange as ")) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.gray)
            } else if (text.includes('New Media Tweet in')) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgGreen)
            } else if (text.includes('New Text Tweet in')) {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.black.bgGreen)
            } else {
                console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`.blue)
            }
        } else {
            if (remoteLogging1) { logger1.error(logString, logObject) } else if (systemglobal.log_objects) { console.log(logObject) }
            if (remoteLogging2) { logger2.error(logString, logObject) }
            console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][${proccess}] ${text}`)
        }
    }

    process.on('uncaughtException', function(err) {
        console.log(err)
        console.log(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}][uncaughtException] ${err.message}`.bgRed);
        if (remoteLogging1) { logger1.critical(`uncaughtException : ${err.message}`, { process: 'Init' }); }
        if (remoteLogging2) { logger2.critical(`uncaughtException : ${err.message}`, { process: 'Init' }); }
    });

    return module;
};
