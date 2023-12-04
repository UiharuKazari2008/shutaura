/*    ___                  __                        _______ __
     /   | _________ _____/ /__  ____ ___  __  __   / ____(_) /___  __
    / /| |/ ___/ __ `/ __  / _ \/ __ `__ \/ / / /  / /   / / __/ / / /
   / ___ / /__/ /_/ / /_/ /  __/ / / / / / /_/ /  / /___/ / /_/ /_/ /
  /_/  |_\___/\__,_/\__,_/\___/_/ /_/ /_/\__, /   \____/_/\__/\__, /
                                        /____/               /____/
Developed at Academy City Research
"Developing a better automated future"
======================================================================================
Shutaura Project - Discord I/O System
Copyright 2020
======================================================================================
This code is under a strict NON-DISCLOSURE AGREEMENT, If you have the rights
to access this project you understand that release, demonstration, or sharing
of this project or its content will result in legal consequences. All questions
about release, "snippets", or to report spillage are to be directed to:

- ACR Docutrol -----------------------------------------
(Academy City Research Document & Data Control Services)
docutrol@acr.moe - 301-399-3671 - docs.acr.moe/docutrol
====================================================================================== */

(async () => {
    let systemglobal = require('../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Download-IO';

    const path = require('path');
    const amqp = require('amqplib/callback_api');
    const RateLimiter = require('limiter').RateLimiter;
    const limiter1 = new RateLimiter(1, 250);
    const limiter2 = new RateLimiter(1, 250);
    const request = require('request').defaults({ encoding: null });
    const { spawn, exec } = require("child_process");
    const fsEx = require("fs-extra");
    const fs = require("fs");
    const minimist = require("minimist");
    const sharp = require("sharp");
    let args = minimist(process.argv.slice(2));
    const Discord_CDN_Accepted_Files = ['jpg','jpeg','jfif','png','webp'];

    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
        systemglobal.MQServer = process.env.MQ_HOST.trim()
    if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
        systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
    if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
        systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

    let runCount = 0;
    Logger.printLine("Init", "Download I/O", "info");

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'cdn' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.HostID])
        if (_systemparams.error) { Logger.printLine("SQL", "Error getting system parameter records!", "emergency", _systemparams.error); return false }
        const systemparams_sql = _systemparams.rows.reverse();

        if (systemparams_sql.length > 0) {
            const _mq_account = systemparams_sql.filter(e => e.param_key === 'mq.login');
            if (_mq_account.length > 0 && _mq_account[0].param_data) {
                if (_mq_account[0].param_data.host)
                    systemglobal.MQServer = _mq_account[0].param_data.host;
                if (_mq_account[0].param_data.username)
                    systemglobal.MQUsername = _mq_account[0].param_data.username;
                if (_mq_account[0].param_data.password)
                    systemglobal.MQPassword = _mq_account[0].param_data.password;
            }
            const _watchdog_host = systemparams_sql.filter(e => e.param_key === 'watchdog.host');
            if (_watchdog_host.length > 0 && _watchdog_host[0].param_value) {
                systemglobal.Watchdog_Host = _watchdog_host[0].param_value;
            }
            const _watchdog_id = systemparams_sql.filter(e => e.param_key === 'watchdog.id');
            if (_watchdog_id.length > 0 && _watchdog_id[0].param_value) {
                systemglobal.Watchdog_ID = _watchdog_id[0].param_value;
            }
            const _mq_discord_out = systemparams_sql.filter(e => e.param_key === 'mq.discord.out');
            if (_mq_discord_out.length > 0 && _mq_discord_out[0].param_value) {
                systemglobal.Discord_Out = _mq_discord_out[0].param_value;
            }
            const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
            if (_home_guild.length > 0 && _home_guild[0].param_value) {
                systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
            }
            const _backup_config = systemparams_sql.filter(e => e.param_key === 'seq_cdn');
            if (_backup_config.length > 0 && _backup_config[0].param_data) {
                if (_backup_config[0].param_data.id)
                    systemglobal.CDN_ID = _backup_config[0].param_data.id;
                if (_backup_config[0].param_data.interval_min)
                    systemglobal.CDN_Interval_Min = _backup_config[0].param_data.interval_min;
                if (_backup_config[0].param_data.items_per_backup)
                    systemglobal.CDN_N_Per_Interval = _backup_config[0].param_data.items_per_backup;
                if (_backup_config[0].param_data.base_path)
                    systemglobal.CDN_Base_Path = _backup_config[0].param_data.base_path;
            }
            // {"backup_parts": true, "interval_min": 5, "backup_base_path": "/mnt/backup/", "pickup_base_path": "/mnt/data/kanmi-files/", "items_per_backup" : 2500}
            const _backup_ignore = systemparams_sql.filter(e => e.param_key === 'seq_cdn.ignore');
            if (_backup_ignore.length > 0 && _backup_ignore[0].param_data) {
                if (_backup_ignore[0].param_data.channels)
                    systemglobal.CDN_Ignore_Channels = _backup_ignore[0].param_data.channels;
                if (_backup_ignore[0].param_data.servers)
                    systemglobal.CDN_Ignore_Servers = _backup_ignore[0].param_data.servers;
            }
            const _mq_cdn_in = systemparams_sql.filter(e => e.param_key === 'mq.cdn.in');
            if (_mq_cdn_in.length > 0 && _mq_cdn_in[0].param_value)
                systemglobal.CDN_In = _mq_cdn_in[0].param_value;
            const _backup_focus = systemparams_sql.filter(e => e.param_key === 'seq_cdn.focus');
            if (_backup_focus.length > 0 && _backup_focus[0].param_data) {
                if (_backup_focus[0].param_data.channels)
                    systemglobal.CDN_Focus_Channels = _backup_focus[0].param_data.channels;
            }
            backupSystemName = `${systemglobal.SystemName}${(systemglobal.CDN_ID) ? '-' + systemglobal.CDN_ID : ''}`
        }
    }
    await loadDatabaseCache();
    if (args.whost) {
        systemglobal.Watchdog_Host = args.whost
    }
    if (args.wid) {
        systemglobal.Watchdog_ID = args.wid
    }
    console.log(systemglobal)
    Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug")

    const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`;
    const MQWorker1 = systemglobal.CDN_In + '.' + systemglobal.CDN_ID;
    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    // Kanmi MQ Backend
    function startWorker() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 1 Error", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 1 Closed", "critical")
                start();
            });
            ch.prefetch(25);
            ch.assertQueue(MQWorker1, { durable: true }, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.consume(MQWorker1, processMsg, { noAck: false });
                Logger.printLine("KanmiMQ", "Channel 1 Worker Ready", "info")
            });
            ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.bindQueue(MQWorker1, "kanmi.exchange", MQWorker1, [], function(err, _ok) {
                    if (closeOnErr(err)) return;
                    Logger.printLine("KanmiMQ", "Channel 1 Worker Bound to Exchange", "debug")
                })
            });
            ch.assertExchange("kanmi.cdn", "fanout", {}, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.bindQueue(MQWorker1, "kanmi.cdn", systemglobal.CDN_In, [], function(err, _ok) {
                    if (closeOnErr(err)) return;
                    Logger.printLine("KanmiMQ", "Channel 1 Worker Bound to FanoutExchange", "debug")
                })
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
        const MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
        doAction(MessageContents, cb);
    }
    function start() {
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
            whenConnected();
        });
    }
    function closeOnErr(err) {
        if (!err) return false;
        Logger.printLine("KanmiMQ", "Connection Closed due to error", "error", err)
        amqpConn.close();
        return true;
    }
    async function whenConnected() {
        startWorker();
        if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${backupSystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
            setInterval(() => {
                request.get(`http://${systemglobal.Watchdog_Host}/watchdog/ping?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${backupSystemName}`, async (err, res) => {
                    if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                        console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                    }
                })
            }, 60000)
        }
    }

    async function doAction(message, complete) {
        const object = {...message.messageData, ...message.messageUpdate};
        switch (message.messageIntent) {
            case "Reload" :
                if (!!object.attachment_hash && object.eid) {
                    const cacheItem = await db.query(`SELECT eid, path_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [object.eid, systemglobal.CDN_ID]);
                    if (cacheItem.rows.length > 0) {
                        moveMessage(cacheItem.rows[0], object, complete, true);
                    } else {
                        backupMessage(object, complete, true);
                    }
                } else {
                    complete(true);
                }
                break;
            case "Delete" :
                const cacheItem = await db.query(`SELECT eid, path_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE id_hint = ? AND host = ?`, [object.id, systemglobal.CDN_ID]);
                if (cacheItem.rows.length > 0)
                    await deleteCacheItem(cacheItem.rows[0], true);
                complete(true);
                break;
            default :
                complete(true);
                break;
        }
    }

    async function deleteCacheItem(deleteItem, deleteRow) {
        if (deleteItem.full_hint) {
            try {
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'full', deleteItem.path_hint, deleteItem.full_hint));
                Logger.printLine("CDN Manager", `Delete full copy: ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete full copy: ${deleteItem.eid}`, "err", e.message);
                console.error(e);
            }
        }
        if (deleteItem.preview_hint) {
            try {
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'preview', deleteItem.path_hint, deleteItem.preview_hint));
                Logger.printLine("CDN Manager", `Delete preview copy: ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete preview copy: ${deleteItem.eid}`, "err", e.message);
                console.error(e);
            }
        }
        if (deleteItem.ext_0_hint) {
            try {
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'extended_preview', deleteItem.path_hint, deleteItem.ext_0_hint));
                Logger.printLine("CDN Manager", `Delete extended preview copy: ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete extended preview copy: ${deleteItem.eid}`, "err", e.message);
                console.error(e);
            }
        }
        if (deleteRow) {
            db.query(`DELETE FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [deleteItem.eid, systemglobal.CDN_ID]);
        }
    }

    try {
        if (!fs.existsSync(systemglobal.TempFolder))
            fs.mkdirSync(systemglobal.TempFolder)
        if (!fs.existsSync(systemglobal.CDN_Base_Path))
            fs.mkdirSync(systemglobal.CDN_Base_Path)
    } catch (e) {
        console.error('Failed to create the temp folder, not a issue if your using docker');
        console.error(e);
    }
    async function backupMessage (message, cb, requested_remotely) {
        let attachements = {};

        async function backupCompleted(path, preview, full, ext_0) {
            const saveBackupSQL = await db.query(`INSERT INTO kanmi_records_cdn
                                                  SET heid         = ?,
                                                      eid          = ?,
                                                      host         = ?,
                                                      id_hint      = ?,
                                                      path_hint    = ?,
                                                      preview      = ?,
                                                      preview_hint = ?,
                                                      full         = ?,
                                                      full_hint    = ?,
                                                      ext_0        = ?,
                                                      ext_0_hint   = ? 
                                                  ON DUPLICATE KEY UPDATE
                                                      id_hint      = ?,
                                                      path_hint    = ?,
                                                      preview      = ?,
                                                      preview_hint = ?,
                                                      full         = ?,
                                                      full_hint    = ?,
                                                      ext_0        = ?,
                                                      ext_0_hint   = ?`, [
                (parseInt(message.eid.toString()) * parseInt(systemglobal.CDN_ID.toString())),
                message.eid,
                systemglobal.CDN_ID,
                message.id,
                path,
                (!!preview) ? 1 : 0,
                (!!preview) ? preview : null,
                (!!full) ? 1 : 0,
                (!!full) ? full : null,
                (!!ext_0) ? 1 : 0,
                (!!ext_0) ? ext_0 : null,
                message.id,
                path,
                (!!preview) ? 1 : 0,
                (!!preview) ? preview : null,
                (!!full) ? 1 : 0,
                (!!full) ? full : null,
                (!!ext_0) ? 1 : 0,
                (!!ext_0) ? ext_0 : null,
            ])
            if (saveBackupSQL.error) {
                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as download to CDN`, "err", saveBackupSQL.error)
            }
        }
        function getimageSizeParam() {
            if (message.sizeH && message.sizeW && Discord_CDN_Accepted_Files.indexOf(message.attachment_name.split('.').pop().split('?')[0].toLowerCase()) !== -1 && (message.sizeH > 512 || message.sizeW > 512)) {
                let ih = 512;
                let iw = 512;
                if (message.sizeW >= message.sizeH) {
                    iw = (message.sizeW * (512 / message.sizeH)).toFixed(0)
                } else {
                    ih = (message.sizeH * (512 / message.sizeW)).toFixed(0)
                }
                return `?width=${iw}&height=${ih}`
            } else {
                return ''
            }
        }

        if (message.attachment_hash) {
            attachements['full'] = {
                src: `https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name.split('?')[0]}`),
                dest: path.join(systemglobal.CDN_Base_Path, 'full', message.server, message.channel),
            }
        }
        if (message.cache_proxy) {
            attachements['preview'] = {
                src: message.cache_proxy.startsWith('http') ? message.cache_proxy : `https://media.discordapp.net/attachments${message.cache_proxy}`,
                dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
                ext: message.cache_proxy.split('?')[0].split('.').pop()
            }
        } else if (message.attachment_hash && message.attachment_name && (message.sizeH && message.sizeW && Discord_CDN_Accepted_Files.indexOf(message.attachment_name.split('.').pop().split('?')[0].toLowerCase()) !== -1 && (message.sizeH > 512 || message.sizeW > 512))) {
            attachements['preview'] = {
                src: `https://media.discordapp.net/attachments/` + ((message.attachment_hash.includes('/')) ? `${message.attachment_hash}${getimageSizeParam()}` : `${message.channel}/${message.attachment_hash}/${message.attachment_name}${getimageSizeParam()}`),
                dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
                ext: (message.attachment_hash.includes('/')) ? message.attachment_hash.split('?')[0].split('.').pop() : undefined,
            }
        }
        if (message.data && message.data.preview_image && message.data.preview_image) {
            attachements['extended_preview'] = {
                src: `https://media.discordapp.net${message.data.preview_image}`,
                dest: path.join(systemglobal.CDN_Base_Path, 'extended_preview', message.server, message.channel),
                ext: message.data.preview_image.split('?')[0].split('.').pop()
            }
        }

        if (Object.keys(attachements).length > 0) {
            let res = {};
            let requests = Object.keys(attachements).reduce((promiseChain, k) => {
                return promiseChain.then(() => new Promise(async (blockOk) => {
                    const val = attachements[k];
                    let destName = `${message.eid}`
                    if (val.ext) {
                        destName += '.' + val.ext;
                    } else if (message.attachment_name) {
                        destName += '.' +  message.attachment_name.replace(message.id, '').split('?')[0].split('.').pop()
                    }
                    const data = await new Promise(ok => {
                        const url = val.src;
                        //Logger.printLine("BackupFile", `Downloading ${message.id} for ${k} ${destName}...`, "debug")
                        request.get({
                            url,
                            headers: {
                                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                                'accept-language': 'en-US,en;q=0.9',
                                'cache-control': 'max-age=0',
                                'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Microsoft Edge";v="92"',
                                'sec-ch-ua-mobile': '?0',
                                'sec-fetch-dest': 'document',
                                'sec-fetch-mode': 'navigate',
                                'sec-fetch-site': 'none',
                                'sec-fetch-user': '?1',
                                'upgrade-insecure-requests': '1',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73'
                            },
                        }, async (err, res, body) => {
                            if (err || res && res.statusCode && res.statusCode !== 200) {
                                if (res && res.statusCode && (res.statusCode === 404 || res.statusCode === 403) && k === 'full' && !requested_remotely) {
                                    Logger.printLine("DownloadFile", `Failed to download attachment "${url}" - Requires revalidation!`, "err", (err) ? err : undefined)
                                    mqClient.sendData(systemglobal.Discord_Out, {
                                        fromClient: `return.CDN.${systemglobal.SystemName}`,
                                        messageReturn: false,
                                        messageID: message.id,
                                        messageChannelID: message.channel,
                                        messageServerID: message.server,
                                        messageType: 'command',
                                        messageAction: 'ValidateMessage'
                                    }, function (callback) {
                                        if (callback) {
                                            Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out}`, "debug")
                                        } else {
                                            Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out}`, "error")
                                        }
                                    });
                                } else {
                                    Logger.printLine("DownloadFile", `Failed to download attachment "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                }
                                ok(false)
                            } else {
                                ok(body);
                            }
                        })
                    })
                    if (data) {
                        fsEx.ensureDirSync(path.join(val.dest));
                        const write = await new Promise(ok => {
                            fs.writeFile(path.join(val.dest, destName), data, async (err) => {
                                if (err) {
                                    Logger.printLine("CopyFile", `Failed to write download ${message.id} in ${message.channel} for ${k}`, "err", err)
                                }
                                ok(!err);
                            })
                        });
                        res[k] = (write) ? destName : null;
                        blockOk();
                    } else {
                        Logger.printLine("DownloadFile", `Can't download item ${message.id}, No Data Returned`, "error")
                        if (k === 'extended_preview' || val['src'].includes('t9-preview')) {
                            mqClient.sendData(systemglobal.Discord_Out, {
                                messageReturn: false,
                                messageType: 'command',
                                messageAction: (destName.split('.').pop().toLowerCase() === 'gif') ? 'CacheVideo' : 'CacheImage',
                                fromClient: `return.CDN.${systemglobal.SystemName}`,
                                messageID: message.id,
                                messageChannelID: message.channel,
                                messageServerID: message.server,
                            }, function (callback) {
                                if (callback) {
                                    Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out}`, "debug")
                                } else {
                                    Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out}`, "error")
                                }
                            });
                            res[k] = false;
                            blockOk();
                        } else if (k === 'preview') {
                            const full_data = await new Promise(ok => {
                                const url = attachements.full.src;
                                Logger.printLine("BackupFile", `Downloading ${message.id} for ${k} (Sharp Convert) ${destName}...`, "debug")
                                request.get({
                                    url,
                                    headers: {
                                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                                        'accept-language': 'en-US,en;q=0.9',
                                        'cache-control': 'max-age=0',
                                        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Microsoft Edge";v="92"',
                                        'sec-ch-ua-mobile': '?0',
                                        'sec-fetch-dest': 'document',
                                        'sec-fetch-mode': 'navigate',
                                        'sec-fetch-site': 'none',
                                        'sec-fetch-user': '?1',
                                        'upgrade-insecure-requests': '1',
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.73'
                                    },
                                }, async (err, res, body) => {
                                    if (err || res && res.statusCode && res.statusCode !== 200) {
                                        Logger.printLine("DownloadFile", `Failed to download attachment "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                        ok(false)
                                    } else {
                                        ok(body);
                                    }
                                })
                            })
                            if (full_data) {
                                let resizeParam = {
                                    fit: sharp.fit.inside,
                                    withoutEnlargement: true,
                                    width: 512,
                                    height: 512
                                }
                                if (message.sizeW >= message.sizeH) {
                                    resizeParam.width = parseInt((message.sizeW * (512 / message.sizeH)).toFixed(0).toString())
                                } else {
                                    resizeParam.height = parseInt((message.sizeH * (512 / message.sizeW)).toFixed(0).toString())
                                }
                                if (isNaN(resizeParam.width))
                                    resizeParam.width = 512;
                                if (isNaN(resizeParam.height))
                                    resizeParam.height = 512;
                                res[k] = (await new Promise(image_saved => {
                                    sharp(full_data)
                                        .resize(resizeParam)
                                        .toFormat(destName.split('.').pop().toLowerCase())
                                        .withMetadata()
                                        .toFile(path.join(val.dest, destName), function (err) {
                                            if (err) {
                                                Logger.printLine("CopyFile", `Failed to write preview ${message.id} in ${message.channel} for ${k}`, "err", err);
                                                console.error(err);
                                                if ((attachements['full'].ext || message.attachment_name.replace(message.id, '').split('?')[0].split('.').pop()).toLowerCase() === destName.split('.').pop().toLowerCase()) {
                                                    fs.writeFile(path.join(val.dest, destName), full_data, async (err) => {
                                                        if (err) {
                                                            Logger.printLine("CopyFile", `Failed to write full/preview ${message.id} in ${message.channel} for ${k}`, "err", err)
                                                        }
                                                        image_saved((!err) ? destName : false);
                                                    })
                                                } else {
                                                    image_saved(false);
                                                }
                                            } else {
                                                image_saved(destName);
                                            }
                                        })
                                }));
                                blockOk();
                            } else {
                                Logger.printLine("DownloadFile", `Can't download item for conversion ${message.id}, No Data Returned`, "error")
                                res[k] = false;
                                blockOk();
                            }
                        } else {
                            res[k] = false;
                            blockOk();
                        }
                    }
                }))
            }, Promise.resolve());
            requests.then(async () => {
                Logger.printLine("BackupFile", `Download ${message.id}`, "debug")
                if (Object.values(res).filter(f => !f).length === 0)
                    await backupCompleted(`${message.server}/${message.channel}`, res.preview, res.full, res.extended_preview);
                cb(requested_remotely || (Object.values(res).filter(f => !f).length === 0));
            });
        } else {
            Logger.printLine("BackupParts", `Can't download item ${message.id}, No URLs Available`, "error")
            cb(requested_remotely || false)
        }
    }
    async function moveMessage (previous, message, cb, requested_remotely) {
        let attachements = {};

        async function backupCompleted(path, preview, full, ext_0) {
            const saveBackupSQL = await db.query(`UPDATE kanmi_records_cdn
                                                  SET id_hint      = ?,
                                                      path_hint    = ?,
                                                      preview      = ?,
                                                      preview_hint = ?,
                                                      full         = ?,
                                                      full_hint    = ?,
                                                      ext_0        = ?,
                                                      ext_0_hint   = ? 
                                                  WHERE
                                                      eid      = ? AND 
                                                      host    = ?`, [
                (parseInt(message.eid.toString()) * parseInt(systemglobal.CDN_ID.toString())),
                message.id,
                path,
                (!!preview) ? 1 : 0,
                (!!preview) ? preview : null,
                (!!full) ? 1 : 0,
                (!!full) ? full : null,
                (!!ext_0) ? 1 : 0,
                (!!ext_0) ? ext_0 : null,
                message.eid,
                systemglobal.CDN_ID,
            ])
            if (saveBackupSQL.error) {
                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as download to CDN`, "err", saveBackupSQL.error)
            }
        }

        if (previous.full_hint) {
            attachements['full'] = {
                src: path.join(systemglobal.CDN_Base_Path, 'full', previous.path_hint, previous.full_hint),
                dest: path.join(systemglobal.CDN_Base_Path, 'full', message.server, message.channel, previous.full_hint),
                base: path.join(systemglobal.CDN_Base_Path, 'full', message.server, message.channel),
            }
        }
        if (previous.preview_hint) {
            attachements['preview'] = {
                src: path.join(systemglobal.CDN_Base_Path, 'preview', previous.path_hint, previous.preview_hint),
                dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel, previous.preview_hint),
                base: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
            }
        }
        if (previous.ext_0_hint) {
            attachements['extended_preview'] = {
                src: path.join(systemglobal.CDN_Base_Path, 'extended_preview', previous.path_hint, previous.ext_0_hint),
                dest: path.join(systemglobal.CDN_Base_Path, 'extended_preview', message.server, message.channel, previous.ext_0_hint),
                base: path.join(systemglobal.CDN_Base_Path, 'extended_preview', message.server, message.channel),
            }
        }

        if (Object.keys(attachements).length > 0) {
            let res = {};
            let requests = Object.keys(attachements).reduce((promiseChain, k) => {
                return promiseChain.then(() => new Promise(async (blockOk) => {
                    const val = attachements[k];
                    fsEx.ensureDirSync(path.join(val.base));
                    fs.rename(val.src, val.dest, err => {
                        if (err) {
                            Logger.printLine("MoveFile", `Failed to move ${k} file for ${message.id} in ${message.channel}`, "err", err);
                            console.error(err)
                        }
                        res[k] = !err;
                        blockOk();
                    })
                }))
            }, Promise.resolve());
            requests.then(async () => {
                Logger.printLine("BackupFile", `Moved ${message.id}`, "debug")
                if (Object.values(res).filter(f => !f).length === 0)
                    await backupCompleted(`${message.server}/${message.channel}`, res.preview, res.full, res.extended_preview);
                cb(requested_remotely || (Object.values(res).filter(f => !f).length === 0));
            });
        } else {
            Logger.printLine("BackupParts", `Nothing to do for item ${message.id}, No Data Available`, "error")
            cb(requested_remotely || false)
        }
    }

    async function findBackupItems(focus_list) {
        return new Promise(async completed => {
            runCount++
            let ignoreQuery = [];
            if (systemglobal.CDN_Ignore_Channels && systemglobal.CDN_Ignore_Channels.length > 0)
                ignoreQuery.push(...systemglobal.CDN_Ignore_Channels.map(e => `channel != '${e}'`))
            if (systemglobal.CDN_Ignore_Servers && systemglobal.CDN_Ignore_Servers.length > 0)
                ignoreQuery.push(...systemglobal.CDN_Ignore_Servers.map(e => `server != '${e}'`))

            const q = `SELECT x.*, y.heid
                       FROM (SELECT rec.*, ext.data
                             FROM (SELECT * FROM kanmi_records WHERE source = 0 ${(focus_list) ? 'AND (' + focus_list.map(f => 'channel = ' + f).join(' OR ') + ')' : ''} AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL)${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''})) rec
                                      LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) ext ON (rec.eid = ext.eid)) x
                                LEFT OUTER JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)
                       WHERE y.heid IS NULL
                       ORDER BY RAND()
                       LIMIT ?`
            Logger.printLine("Search", `Preparing Search....`, "info");
            const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
            if (backupItems.error) {
                Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
                completed();
            } else if (backupItems.rows.length > 0) {
                let total = backupItems.rows.length
                let ticks = 0
                let requests = backupItems.rows.reduce((promiseChain, m, i, a) => {
                    return promiseChain.then(() => new Promise(async (resolve) => {
                        await backupMessage(m, async ok => {
                            ticks++
                            if (ticks >= 100 || a.length <= 100) {
                                ticks = 0
                            }
                            resolve(ok)
                            m = null
                        })
                    }))
                }, Promise.resolve());
                requests.then(async () => {
                    if (total > 0) {
                        Logger.printLine("Download", `Completed Download #${runCount} with ${total} files`, "info");
                    } else {
                        Logger.printLine("Download", `Nothing to Download #${runCount}`, "info");
                    }
                    completed();
                    setTimeout(findBackupItems, (systemglobal.CDN_Interval_Min) ? systemglobal.CDN_Interval_Min * 60000 : 3600000);
                })
            } else {
                Logger.printLine("Download", `Nothing to Download #${runCount}`, "info");
                setTimeout(findBackupItems, (systemglobal.CDN_Interval_Min) ? systemglobal.CDN_Interval_Min * 60000 : 3600000);
                completed();
            }
        });
    }

    async function validateStorage() {
        return new Promise(async (completed) => {
            const channels = await db.query(`SELECT channelid, serverid FROM kanmi_channels WHERE source = 0`)
            let requests = channels.rows.reduce((promiseChain, c, i, a) => {
                return promiseChain.then(() => new Promise(async (resolveChannel) => {
                    const dir_previews = path.join(systemglobal.CDN_Base_Path, 'preview', c.serverid, c.channelid);
                    const dir_full = path.join(systemglobal.CDN_Base_Path, 'full', c.serverid, c.channelid);
                    const previews = (fs.existsSync(dir_previews)) ? fs.readdirSync(dir_previews) : [];
                    const full = (fs.existsSync(dir_full)) ? fs.readdirSync(dir_full) : [];

                    console.log(`${c.channelid} : Preview = ${previews.length} | Full = ${full.length}`)

                    if (full.length > 0 || previews.length > 0) {
                        const messages = await db.query(`SELECT x.eid, y.heid, server, channel, attachment_name, attachment_hash, attachment_extra, data
                                                 FROM (SELECT rec.eid, server, channel, attachment_name, attachment_hash, attachment_extra, ext.data
                                                       FROM (SELECT eid, source, server, channel, attachment_name, attachment_hash, attachment_extra FROM kanmi_records WHERE source = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL)) AND channel = ?) rec
                                                                LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) ext ON (rec.eid = ext.eid)) x
                                                          LEFT JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)`, [c.channelid, systemglobal.CDN_ID]);
                        if (messages.rows.length > 0) {
                            let messages_verify = messages.rows.filter(e => !!e.heid).reduce((promiseChain, message, i, a) => {
                                return promiseChain.then(() => new Promise(async (resolveMessages) => {
                                    attachements = {};
                                    if (message.attachment_hash) {
                                        attachements['full'] = {
                                            dest: path.join(systemglobal.CDN_Base_Path, 'full', message.server, message.channel),
                                        }
                                    }
                                    if (message.cache_proxy) {
                                        attachements['preview'] = {
                                            dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
                                            ext: message.cache_proxy.split('?')[0].split('.').pop()
                                        }
                                    } else if (message.attachment_hash && message.attachment_name && (message.sizeH && message.sizeW && Discord_CDN_Accepted_Files.indexOf(message.attachment_name.split('.').pop().split('?')[0].toLowerCase()) !== -1 && (message.sizeH > 512 || message.sizeW > 512))) {
                                        attachements['preview'] = {
                                            dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
                                            ext: (message.attachment_hash.includes('/')) ? message.attachment_hash.split('?')[0].split('.').pop() : undefined,
                                        }
                                    }
                                    if (message.data && message.data.preview_image && message.data.preview_image) {
                                        attachements['extended_preview'] = {
                                            dest: path.join(systemglobal.CDN_Base_Path, 'extended_preview', message.server, message.channel),
                                            ext: message.data.preview_image.split('?')[0].split('.').pop()
                                        }
                                    }

                                    let file_verify = Object.keys(attachements).reduce((promiseChain, k) => {
                                        return promiseChain.then(() => new Promise(async (blockOk) => {
                                            const val = attachements[k];
                                            let destName = `${message.eid}`
                                            if (val.ext) {
                                                destName += '.' + val.ext;
                                            } else if (message.attachment_name) {
                                                destName += '.' + message.attachment_name.replace(message.id, '').split('?')[0].split('.').pop()
                                            }
                                            if (!fs.existsSync(path.join(val.dest, destName))) {
                                                console.error(`Invalid Cache File = ${path.join(val.dest, destName)}`);
                                                db.query(`DELETE FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [message.eid, systemglobal.CDN_ID]);
                                            }
                                            blockOk();
                                        }))
                                    }, Promise.resolve());
                                    file_verify.then(() => {
                                        resolveMessages();
                                    })
                                }))
                            }, Promise.resolve());
                            messages_verify.then(() => {
                                resolveChannel();
                            });
                        } else {
                            resolveChannel();
                        }
                    } else {
                        resolveChannel();
                    }
                }))
            }, Promise.resolve());
            requests.then(() => {
                setTimeout(findBackupItems, (systemglobal.CDN_Verify_Interval_Min) ? systemglobal.CDN_Verify_Interval_Min * 60000 : 3610000);
                completed();
            });
        })
    }

    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err)
        console.log(err)
        setTimeout(function() {
            process.exit(1)
        }, 3000)
    });


    if (process.send && typeof process.send === 'function') {
        process.send('ready');
    }
    start();
    if (systemglobal.CDN_Base_Path) {
        console.log(await db.query(`UPDATE kanmi_records_cdn c INNER JOIN kanmi_records r ON c.eid = r.eid SET id_hint = r.id WHERE id_hint IS NULL`));
        console.log("Waiting 30sec before normal tasks..")
        setTimeout(async () => {
            if (systemglobal.CDN_Focus_Channels) {
                await findBackupItems(systemglobal.CDN_Focus_Channels);
            }
            await findBackupItems();
            await validateStorage();
        }, 30000)
    } else {
        Logger.printLine("Init", "Unable to start Download client, no directory setup!", "error")
    }
})()
