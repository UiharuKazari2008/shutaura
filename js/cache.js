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
    const facilityName = 'CDN';
    let backupSystemName;

    const moment = require('moment');
    const eris = require('eris');
    const path = require('path');
    const amqp = require('amqplib/callback_api');
    const request = require('request').defaults({ encoding: null });
    const fsEx = require("fs-extra");
    const splitFile = require('split-file');
    const fs = require("fs");
    const minimist = require("minimist");
    const sharp = require("sharp");
    const md5 = require("md5");
    const tx2 = require('tx2');
    let args = minimist(process.argv.slice(2));
    const sizeOf = require('image-size');
    const remoteSize = require('remote-file-size');
    const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
    const Discord_CDN_Accepted_Files = ['jpg','jpeg','jfif','png','gif', 'webp'];

    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
        systemglobal.MQServer = process.env.MQ_HOST.trim()
    if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
        systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
    if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
        systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

    let runCount = 0;
    let init = 0;
    Logger.printLine("Init", "CDN", "info");
    let skipped = {};

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'cdn' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.HostID])
        if (_systemparams.error) { Logger.printLine("SQL", "Error getting system parameter records!", "emergency", _systemparams.error); return false }
        const systemparams_sql = _systemparams.rows.reverse();

        if (systemparams_sql.length > 0) {
            const _discord_account = systemparams_sql.filter(e => e.param_key === 'cdn.login');
            if (_discord_account.length > 0 && _discord_account[0].param_value) {
                systemglobal.CDN_Discord_Key = _discord_account[0].param_value
            }
            const _discord_values = systemparams_sql.filter(e => e.param_key === 'authware.info');
            if (_discord_values.length > 0 && _discord_values[0].param_data) {
                if (_discord_values[0].param_data.owner)
                    systemglobal.DiscordOwner = _discord_values[0].param_data.owner;
                if (_discord_values[0].param_data.description)
                    systemglobal.DiscordDescription = _discord_values[0].param_data.description;
                if (_discord_values[0].param_data.prefix)
                    systemglobal.DiscordPrefix = _discord_values[0].param_data.prefix;

            }
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
                if (_backup_config[0].param_data.items_per_backup)
                    systemglobal.CDN_N_Episodes_Per_Interval = _backup_config[0].param_data.episodes_per_backup;
                if (_backup_config[0].param_data.base_path)
                    systemglobal.CDN_Base_Path = _backup_config[0].param_data.base_path;
                if (_backup_config[0].param_data.download_path)
                    systemglobal.CDN_TempDownload_Path = _backup_config[0].param_data.download_path;
                if (_backup_config[0].param_data.temp_channel)
                    systemglobal.CDN_TempChannel = _backup_config[0].param_data.temp_channel;
                if (_backup_config[0].param_data.trash_channels)
                    systemglobal.CDN_Trash_Channels = _backup_config[0].param_data.trash_channels;
                if (_backup_config[0].param_data.trash_path)
                    systemglobal.CDN_Trash_Path = _backup_config[0].param_data.trash_path;
            }
            // {"backup_parts": true, "interval_min": 5, "backup_base_path": "/mnt/backup/", "pickup_base_path": "/mnt/data/kanmi-files/", "items_per_backup" : 2500}
            const _backup_ignore = systemparams_sql.filter(e => e.param_key === 'seq_cdn.ignore');
            if (_backup_ignore.length > 0 && _backup_ignore[0].param_data) {
                if (_backup_ignore[0].param_data.channels)
                    systemglobal.CDN_Ignore_Channels = _backup_ignore[0].param_data.channels;
                if (_backup_ignore[0].param_data.servers)
                    systemglobal.CDN_Ignore_Servers = _backup_ignore[0].param_data.servers;
                if (_backup_ignore[0].param_data.master_channels)
                    systemglobal.CDN_Ignore_Master_Channels = _backup_ignore[0].param_data.master_channels;
                if (_backup_ignore[0].param_data.master_servers)
                    systemglobal.CDN_Ignore_Master_Servers = _backup_ignore[0].param_data.master_servers;
            }
            const _mq_cdn_in = systemparams_sql.filter(e => e.param_key === 'mq.cdn.in');
            if (_mq_cdn_in.length > 0 && _mq_cdn_in[0].param_value)
                systemglobal.CDN_In = _mq_cdn_in[0].param_value;
            const _backup_focus = systemparams_sql.filter(e => e.param_key === 'seq_cdn.focus');
            if (_backup_focus.length > 0 && _backup_focus[0].param_data) {
                if (_backup_focus[0].param_data.channels)
                    systemglobal.CDN_Focus_Channels = _backup_focus[0].param_data.channels;
                if (_backup_focus[0].param_data.master_channels)
                    systemglobal.CDN_Focus_Master_Channels = _backup_focus[0].param_data.master_channels;
                if (_backup_focus[0].param_data.media_groups)
                    systemglobal.CDN_Focus_Media_Groups = _backup_focus[0].param_data.media_groups;
                if (_backup_focus[0].param_data.prefetch_episodes)
                    systemglobal.CDN_PreFetch_Episodes = _backup_focus[0].param_data.prefetch_episodes;
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

    const discordClient = new eris.CommandClient(systemglobal.CDN_Discord_Key, {
        compress: true,
        restMode: true,
        intents: [
            'guilds',
            'guildMessages'
        ],
    }, {
        name: "CDN",
        description: (systemglobal.DiscordDescription) ? systemglobal.DiscordDescription : "Local Storage Framework for Sequenzia enabled servers",
        owner: (systemglobal.DiscordOwner) ? systemglobal.DiscordOwner : "Unset",
        prefix: (systemglobal.DiscordPrefix) ? systemglobal.DiscordPrefix + " " : "!cdn ",
        restMode: true,
    });

    const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`;``
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
            case "DownloadMaster" :
                const foundItem = await db.query(`SELECT * FROM kanmi_records WHERE eid = ?`, [object.eid]);
                if (foundItem.rows.length > 0) {
                    await backupMessage({...foundItem.rows[0], ...object}, complete, true, true);
                } else {
                    complete(true);
                }
                break;
            case "RemoveMaster" :
                const cacheItemToRemove = await db.query(`SELECT * FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [object.eid, systemglobal.CDN_ID]);
                if (cacheItemToRemove.rows.length > 0) {
                    await deleteMasterCacheItem(cacheItemToRemove.rows[0]);
                }
                complete(true);
                break;
            case "Reload" :
                if (!!object.attachment_hash && object.eid && !(object.channel && systemglobal.CDN_Ignore_Channels && systemglobal.CDN_Ignore_Channels.indexOf(object.channel) !== -1) && !(object.server && systemglobal.CDN_Ignore_Servers && systemglobal.CDN_Ignore_Servers.indexOf(object.server) !== -1)) {
                    const cacheItem = await db.query(`SELECT eid, path_hint, mfull_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [object.eid, systemglobal.CDN_ID]);
                    if (cacheItem.rows.length > 0 && !message.reCache) {
                        await moveMessage(cacheItem.rows[0], object, complete, true);
                    } else {
                        await backupMessage(object, complete, true);
                    }
                } else {
                    complete(true);
                }
                break;
            case "Delete" :
                const cacheItem = await db.query(`SELECT eid, path_hint, mfull_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE id_hint = ? AND host = ?`, [object.id, systemglobal.CDN_ID]);
                if (cacheItem.rows.length > 0)
                    await deleteCacheItem(cacheItem.rows[0], true);
                complete(true);
                break;
            default :
                Logger.printLine("Inbox", `Failed to parse intent: ${JSON.stringify(message)}`, "err");
                complete(true);
                break;
        }
    }

    async function deleteCacheItem(deleteItem, deleteRow) {
        let deletedAction = false;
        const shouldTrash = (systemglobal.CDN_Trash_Path && systemglobal.CDN_Trash_Channels && systemglobal.CDN_Trash_Channels.length > 0) ? systemglobal.CDN_Trash_Channels.indexOf(deleteItem.path_hint.split('/')[1]) !== -1 : false;
        const channel = deleteItem.path_hint.split('/')[1];
        if (deleteItem.mfull_hint) {
            try {
                if (shouldTrash) {
                    try {
                        fsEx.ensureDirSync(path.join(systemglobal.CDN_Trash_Path, 'master', channel));
                        fs.copyFileSync(
                            path.join(systemglobal.CDN_Base_Path, 'master', deleteItem.path_hint, deleteItem.mfull_hint),
                            path.join(systemglobal.CDN_Trash_Path, 'master', channel, deleteItem.mfull_hint))
                    } catch (e) {
                        Logger.printLine("CDN Cleaner", `Failed to Trash master copy: ${deleteItem.eid}: ${e.message}`, "error");
                    }
                }
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'master', deleteItem.path_hint, deleteItem.mfull_hint));
                Logger.printLine("CDN Manager", `${(shouldTrash)? "Delete" : "Trash"} master copy: ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete master copy: ${deleteItem.eid}`, "err", e.message);
                console.error(e);
            }
        }
        if (deleteItem.full_hint) {
            try {
                if (shouldTrash) {
                    try {
                        fsEx.ensureDirSync(path.join(systemglobal.CDN_Trash_Path, 'full', channel));
                        fs.copyFileSync(
                            path.join(systemglobal.CDN_Base_Path, 'full', deleteItem.path_hint, deleteItem.full_hint),
                            path.join(systemglobal.CDN_Trash_Path, 'full', channel, deleteItem.full_hint))
                    } catch (e) {
                        Logger.printLine("CDN Cleaner", `Failed to Trash master copy: ${deleteItem.eid}: ${e.message}`, "error");
                    }
                }
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'full', deleteItem.path_hint, deleteItem.full_hint));
                Logger.printLine("CDN Manager", `${(shouldTrash)? "Delete" : "Trash"} full copy: ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete full copy: ${deleteItem.eid}`, "err", e.message);
                console.error(e);
            }
        }
        if (deleteItem.preview_hint) {
            try {
                if (shouldTrash) {
                    try {
                        fsEx.ensureDirSync(path.join(systemglobal.CDN_Trash_Path, 'preview', channel));
                        fs.copyFileSync(
                            path.join(systemglobal.CDN_Base_Path, 'preview', deleteItem.path_hint, deleteItem.preview_hint),
                            path.join(systemglobal.CDN_Trash_Path, 'preview', channel, deleteItem.preview_hint))
                    } catch (e) {
                        Logger.printLine("CDN Cleaner", `Failed to Trash preview copy: ${deleteItem.eid}: ${e.message}`, "error");
                    }
                }
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'preview', deleteItem.path_hint, deleteItem.preview_hint));
                Logger.printLine("CDN Manager", `${(shouldTrash)? "Delete" : "Trash"} preview copy: ${deleteItem.eid}`, "info");
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
    async function deleteMasterCacheItem(deleteItem) {
        if (deleteItem.mfull_hint) {
            try {
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'master', deleteItem.path_hint, deleteItem.mfull_hint));
                Logger.printLine("CDN Manager", `Delete master copy (by request): ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete master copy (by request): ${deleteItem.eid}`, "err", e.message);
                console.error(e);
            }
            if (deleteItem.full_hint || deleteItem.preview_hint || deleteItem.ext_0_hint) {
                db.query(`UPDATE kanmi_records_cdn SET mfull = 0, mfull_hint = null WHERE eid = ? AND host = ?`, [deleteItem.eid, systemglobal.CDN_ID]);
            } else {
                db.query(`DELETE FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [deleteItem.eid, systemglobal.CDN_ID]);
            }
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
    async function backupMessage (input, cb, requested_remotely, allow_master_files) {
        let attachements = {};
        let message = { ...input };

        if ((!input.channel || !input.server || !input.id) && input.eid) {
            const _md = await db.query(`SELECT id, channel, server FROM kanmi_records WHERE eid = ? LIMIT 1`, [input.eid]);
            if (_md && _md.rows.length > 0) {
                if (!message.id)
                    message.id = _md.rows[0].id;
                message.channel = _md.rows[0].channel;
                message.server = _md.rows[0].server;
            }
        }

        async function backupCompleted(path, preview, full, ext_0, master) {
            if (message.id) {
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
                                                          mfull        = ?,
                                                          mfull_hint   = ?,
                                                          ext_0        = ?,
                                                          ext_0_hint   = ?
                                                      ON DUPLICATE KEY UPDATE id_hint      = ?,
                                                                              path_hint    = ?,
                                                                              preview      = ?,
                                                                              preview_hint = ?,
                                                                              full         = ?,
                                                                              full_hint    = ?,
                                                                              mfull        = ?,
                                                                              mfull_hint   = ?,
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
                    (!!master) ? 1 : 0,
                    (!!master) ? master : null,
                    (!!ext_0) ? 1 : 0,
                    (!!ext_0) ? ext_0 : null,
                    message.id,
                    path,
                    (!!preview) ? 1 : 0,
                    (!!preview) ? preview : null,
                    (!!full) ? 1 : 0,
                    (!!full) ? full : null,
                    (!!master) ? 1 : 0,
                    (!!master) ? master : null,
                    (!!ext_0) ? 1 : 0,
                    (!!ext_0) ? ext_0 : null,
                ])
                if (saveBackupSQL.error) {
                    Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.eid} as download to CDN`, "err", saveBackupSQL.error)
                }
            } else {
                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.eid} as download to CDN: No Message ID passed`, "err")
            }
        }

        function getimageSizeParam(auth) {
            if (message.sizeH && message.sizeW && Discord_CDN_Accepted_Files.indexOf(message.attachment_name.split('.').pop().split('?')[0].toLowerCase()) !== -1 && (message.sizeH > 512 || message.sizeW > 512)) {
                let ih = 512;
                let iw = 512;
                if (message.sizeW >= message.sizeH) {
                    iw = (message.sizeW * (512 / message.sizeH)).toFixed(0)
                } else {
                    ih = (message.sizeH * (512 / message.sizeW)).toFixed(0)
                }
                return ((auth) ? auth + "&" : '?') + `width=${iw}&height=${ih}`
            } else {
                return auth || ''
            }
        }

        let cm;

        if (message && message.server && message.channel && message.id) {
            try {
                cm = await discordClient.getMessage(message.channel, message.id);
            } catch (e) {
                Logger.printLine("Backup", `Failed to get attachment from Discord ${message.channel}/${message.id}: ${e.message}`, "err", e);
            }
        }
        let auth = undefined
        if (message.attachment_hash) {
            if (message.attachment_auth && message.attachment_auth_valid === 1) {
                auth = `?${message.attachment_auth}`
            } else if (cm && !message.attachment_hash.includes('/')) {
                try {
                    const a = cm.attachments[0].url.split('?')[1];
                    let ex = null;
                    try {
                        let exSearch = new URLSearchParams(a);
                        const _ex = Number('0x' + exSearch.get('ex'));
                        ex = moment.unix(_ex).format('YYYY-MM-DD HH:mm:ss');
                    } catch (err) {
                        Logger.printLine("Discord", `Failed to get auth expire time value for database row!`, "debug", err);
                    }
                    auth = `?${a}`;
                    await db.query(`UPDATE kanmi_records
                                    SET attachment_auth    = ?,
                                        attachment_auth_ex = ?
                                    WHERE eid = ?`, [a, ex, message.eid])
                } catch (e) {
                    console.error(e)
                }
            }
            if (auth) {
                attachements['full'] = {
                    src: `https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name.split('?')[0]}`) + auth,
                    dest: path.join(systemglobal.CDN_Base_Path, 'full', message.server, message.channel),
                }
            }
        }
        if (message.cache_proxy) {
            let auth2 = undefined;
            if (message.cache_auth && message.cache_auth_valid === 1) {
                auth2 = `?${message.cache_auth}`
            } else if (cm) {
                try {
                    const li = cm.attachments.filter(e => e.filename.toLowerCase().includes(message.cache_proxy.toLowerCase()))
                    if (li.length > 0) {
                        const as = li[0].url.split('?');
                        if (as.length === 2) {
                            let ex = null;
                            try {
                                let exSearch = new URLSearchParams(as[1]);
                                const _ex = Number('0x' + exSearch.get('ex'));
                                ex = moment.unix(_ex).format('YYYY-MM-DD HH:mm:ss');
                            } catch (err) {
                                Logger.printLine("Discord", `Failed to get auth expire time value for database row!`, "debug", err);
                            }
                            auth2 = `?${as[1]}`;
                            await db.query(`UPDATE kanmi_records
                                            SET cache_auth    = ?,
                                                cache_auth_ex = ?
                                            WHERE eid = ?`, [as[1], ex, message.eid])
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
            }
            if (auth2) {
                attachements['preview'] = {
                    src: (message.cache_proxy.startsWith('http') ? message.cache_proxy : `https://media.discordapp.net/attachments${message.cache_proxy}`) + auth2,
                    dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
                    ext: message.cache_proxy.split('?')[0].split('.').pop()
                }
            }
        } else if (message.attachment_hash && message.attachment_name && (message.sizeH && message.sizeW && Discord_CDN_Accepted_Files.indexOf(message.attachment_name.split('.').pop().split('?')[0].toLowerCase()) !== -1 && (message.sizeH > 512 || message.sizeW > 512))) {
            attachements['preview'] = {
                src: `https://media.discordapp.net/attachments/` + ((message.attachment_hash.includes('/')) ? `${message.attachment_hash}${getimageSizeParam(auth)}` : `${message.channel}/${message.attachment_hash}/${message.attachment_name}${getimageSizeParam(auth)}`),
                dest: path.join(systemglobal.CDN_Base_Path, 'preview', message.server, message.channel),
                ext: (message.attachment_hash.includes('/')) ? message.attachment_hash.split('?')[0].split('.').pop() : undefined,
            }
        } else if (message.attachment_hash && message.attachment_name) {
            attachements['preview'] = {
                src: `https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name.split('?')[0]}`) + auth,
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
        if (message.fileid && (allow_master_files || !(systemglobal.CDN_Ignore_Master_Channels && systemglobal.CDN_Ignore_Master_Channels.indexOf(message.channel) !== -1))) {
            const master_urls = await db.query(`SELECT channelid,
                                                       messageid,
                                                       url,
                                                       valid,
                                                       auth,
                                                       IF(auth_expire > NOW(), 1, 0) AS auth_valid,
                                                       hash
                                                FROM discord_multipart_files
                                                WHERE fileid = ?
                                                  AND messageid NOT IN (SELECT id FROM kanmi_cdn_skipped)`, [message.fileid]);
            if (master_urls.rows.length > 0) {
                attachements['mfull'] = {
                    id: message.fileid,
                    filename: message.real_filename,
                    src: master_urls.rows,
                    dest: path.join(systemglobal.CDN_Base_Path, 'master', message.server, message.channel),
                    ext: message.real_filename.split('?')[0].split('.').pop()
                }
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
                        destName += '.' + message.attachment_name.split('?')[0].split('.').pop()
                    }
                    if (k === 'mfull') {
                        let part_urls = [];
                        let part_download = val.src.reduce((promiseChainParts, u, i) => {
                            return promiseChainParts.then(() => new Promise(async (partOk) => {
                                const data = await new Promise(async ok => {
                                    let url
                                    /*if (u.auth_valid === 1) {
                                        url = await new Promise((resolve) => {
                                            remoteSize(`https://cdn.discordapp.com/attachments${u.url}?${u.auth}`, async (err, size) => {
                                                if (!err || (size !== undefined && size > 0)) {
                                                    resolve(`https://cdn.discordapp.com/attachments${u.url}?${u.auth}`)
                                                } else {
                                                    resolve(null)
                                                }
                                            })
                                        })
                                    }*/
                                    if (!url) {
                                        let pm;
                                        try {
                                            pm = await discordClient.getMessage(u.channelid, u.messageid);
                                            if (pm && pm.attachments && pm.attachments.length > 0) {
                                                (async () => {
                                                    try {
                                                        const a = pm.attachments[0].url.split('?')[1];
                                                        let ex = null;
                                                        try {
                                                            let exSearch = new URLSearchParams(a);
                                                            const _ex = Number('0x' + exSearch.get('ex'));
                                                            ex = moment.unix(_ex).format('YYYY-MM-DD HH:mm:ss');
                                                        } catch (err) {
                                                            Logger.printLine("Discord", `Failed to get auth expire time value for parity database row!`, "debug", err);
                                                        }
                                                        auth = `?${a}`;
                                                        await db.query(`UPDATE discord_multipart_files
                                                                        SET url         = ?,
                                                                            auth        = ?,
                                                                            auth_expire = ?
                                                                        WHERE channelid = ?
                                                                          AND messageid = ?`, [pm.attachments[0].url.split('/attachments').pop().split('?')[0], a, ex, u.channelid, u.messageid])
                                                    } catch (e) {
                                                        console.error(e)
                                                    }
                                                })()
                                                url = pm.attachments[0].url;
                                            }
                                        } catch (e) {
                                            console.error("Failed to get parity attachemnt from discord", e)
                                            url = null
                                        }
                                    }
                                    if (url) {
                                        Logger.printLine("BackupFile", `Downloading Parity Part ${url.split('/').pop().split('?')[0]} for ${k} ${destName}...`, "debug");
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
                                            if (err || (res && res.statusCode && res.statusCode !== 200)) {
                                                if (res && res.statusCode && (res.statusCode === 404 || res.statusCode === 403) && !requested_remotely) {
                                                    Logger.printLine("DownloadFile", `Failed to download attachment "${url}" - Requires revalidation!`, "err", (err) ? err : undefined)
                                                    await db.query(`UPDATE discord_multipart_files
                                                                    SET valid = 0
                                                                    WHERE url = ?`, [u.url])
                                                } else {
                                                    Logger.printLine("DownloadFile", `Failed to download attachment "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'} Size: ${(body) ? body.length : 0}`, "err", (err) ? err : undefined)
                                                }
                                                ok(false)
                                            } else {
                                                ok(body);
                                            }
                                        })
                                    } else {
                                        ok(false)
                                    }
                                })
                                if (data) {
                                    fsEx.ensureDirSync(path.join(systemglobal.CDN_TempDownload_Path, message.eid.toString()));
                                    const filepath = path.join(systemglobal.CDN_TempDownload_Path, message.eid.toString(), u.url.split('?')[0].split('/').pop());
                                    const write = await new Promise(ok => {
                                        fs.writeFile(filepath, data, async (err) => {
                                            if (err) {
                                                Logger.printLine("CopyFile", `Failed to write download ${u.url.split('?')[0].split('/').pop()} for ${message.eid}`, "err", err)
                                            }
                                            ok(!err);
                                        })
                                    });
                                    part_urls[i] = (write) ? filepath : null;
                                    partOk();
                                } else {
                                    Logger.printLine("DownloadFile", `Can't download item ${u.url.split('?')[0].split('/').pop()} for ${message.eid}, No Data Returned`, "error")
                                    part_urls[i] = false;
                                    partOk();
                                }
                            }))
                        }, Promise.resolve());
                        part_download.then(async () => {
                            if (Object.values(part_urls).filter(f => !f).length === 0 && message.paritycount === part_urls.length) {
                                const files = part_urls.sort((x, y) => (x.split('.').pop() < y.split('.').pop()) ? -1 : (y.split('.').pop() > x.split('.').pop()) ? 1 : 0);
                                fsEx.ensureDirSync(path.join(val.dest));
                                fsEx.removeSync(path.join(val.dest, destName));
                                await splitFile.mergeFiles(files, path.join(val.dest, destName));
                                fsEx.removeSync(path.join(systemglobal.CDN_TempDownload_Path, message.eid.toString()));
                                try {
                                    res[k] = (fs.existsSync(path.join(val.dest, destName))) ? destName : null;
                                    Logger.printLine("BackupFile", `Download Master File ${message.real_filename}`, "debug")
                                } catch (e) {
                                    res[k] = false;
                                }
                            } else {
                                Logger.printLine("BackupFile", `Did not save ${message.real_filename}, Files OK: ${Object.values(part_urls).filter(f => !f).length === 0} Parity OK: ${message.paritycount === part_urls.length}`, "error")
                                await db.query(`UPDATE kanmi_records
                                                    SET flagged = 1
                                                    WHERE id = ?`, [message.id])
                                res[k] = false;
                            }
                            blockOk();
                        });
                    } else {
                        const data = await new Promise(ok => {
                            if (val.src && val.src.includes("ex=")) {
                                const url = val.src;
                                Logger.printLine("BackupFile", `Downloading Attachment ${url.split('/').pop().split('?')[0]} for ${k} ${destName}...`, "debug");
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
                                        } else {
                                            Logger.printLine("DownloadFile", `Failed to download attachment "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                        }
                                        ok(false)
                                    } else {
                                        ok(body);
                                    }
                                })
                            } else {
                                ok(false);
                                return false;
                            }
                        })
                        let validData = true;
                        if (data && data.length > 1000) {
                            if (val.ext && Discord_CDN_Accepted_Files.indexOf(val.ext.toLowerCase()) !== -1) {
                                try {
                                    const dimensions = sizeOf(data);
                                    if (!(dimensions && dimensions.width > 100 && dimensions.height > 100))
                                        validData = false;
                                } catch (e) {
                                    console.error(`Image failed to pass image validation: ${e.message}`);
                                    validData = false;
                                }
                            }
                        } else {
                            validData = false;
                        }
                        if (validData) {
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
                            const pm = await (async () => {
                                try {
                                    let pm = await discordClient.createMessage(systemglobal.CDN_TempChannel, val.src.split('?')[0]);
                                    await sleep(5000);
                                    let om = await discordClient.getMessage(pm.channel.id, pm.id)
                                    await discordClient.deleteMessage(pm.channel.id, pm.id)
                                    if (om.embeds && om.embeds[0] && om.embeds[0].thumbnail && om.embeds[0].thumbnail.url) {
                                        return om.embeds[0].thumbnail.url
                                    } else {
                                        console.error("Failed to get valid parity attachemnt from discord")
                                        return false
                                    }
                                } catch (e) {
                                    console.error("Failed to get parity attachemnt from discord", e)
                                    return false
                                }
                            })()
                            if (pm) {
                                const dataTake2 = await new Promise(ok => {
                                    const url = pm;
                                    Logger.printLine("BackupFile", `Downloading Attachment (Research) ${url.split('/').pop().split('?')[0]} for ${k} ${destName}...`, "debug");
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
                                        if (err || (res && res.statusCode && res.statusCode !== 200) || body.length < 1000) {
                                            if (res && res.statusCode && (res.statusCode === 404 || res.statusCode === 403) && message.id && message.channel && k === 'full' && !requested_remotely) {
                                                Logger.printLine("DownloadFile", `Failed to download attachment (ReQuery) "${url}" - Requires revalidation!`, "err", (err) ? err : undefined)
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
                                                Logger.printLine("DownloadFile", `Failed to download attachment (ReQuery) "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                            }
                                            ok(false)
                                        } else {
                                            ok(body);
                                        }
                                    })
                                })
                                let validData2 = true;
                                if (dataTake2 && dataTake2.length > 1000) {
                                    if (val.ext && Discord_CDN_Accepted_Files.indexOf(val.ext.toLowerCase()) !== -1) {
                                        try {
                                            const dimensions = sizeOf(dataTake2);
                                            if (!(dimensions && dimensions.width > 100 && dimensions.height > 100))
                                                validData2 = false;
                                        } catch (e) {
                                            console.error(`Image failed to pass image validation: ${e.message}`);
                                            validData2 = false;
                                        }
                                    }
                                } else {
                                    validData2 = false;
                                }
                                if (validData2) {
                                    fsEx.ensureDirSync(path.join(val.dest));
                                    const write = await new Promise(ok => {
                                        fs.writeFile(path.join(val.dest, destName), dataTake2, async (err) => {
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
                                    if ((k === 'extended_preview' || val['src'].includes('t9-preview')) && message.id) {
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
                                        let validData3 = true;
                                        if (full_data && full_data.length > 1000) {
                                            if (val.ext && Discord_CDN_Accepted_Files.indexOf(val.ext.toLowerCase()) !== -1) {
                                                try {
                                                    const dimensions = sizeOf(full_data);
                                                    if (!(dimensions && dimensions.width > 100 && dimensions.height > 100))
                                                        validData3 = false;
                                                } catch (e) {
                                                    console.error(`Image failed to pass image validation: ${e.message}`);
                                                    validData3 = false;
                                                }
                                            }
                                        } else {
                                            validData3 = false;
                                        }
                                        if (validData3) {
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
                            } else {
                                Logger.printLine("DownloadFile", `Can't download item ${message.id}, No URL Returned`, "error");
                                res[k] = false;
                                blockOk();
                            }
                        }
                    }
                }))
            }, Promise.resolve());
            requests.then(async () => {
                Logger.printLine("BackupFile", `Download ${message.id}`, "debug")
                if (Object.values(res).filter(f => !f).length === 0)
                    await backupCompleted(`${message.server}/${message.channel}`, res.preview, res.full, res.extended_preview, res.mfull);
                cb(true);
            });
        } else {
            Logger.printLine("BackupParts", `Can't download item ${message.id}, No URLs Available`, "error")
            console.log(message)
            if (message && message.server && message.channel && message.id) {
                if (systemglobal.CDN_Fast_Skip) {
                    await db.query(`INSERT INTO kanmi_cdn_skipped
                                    SET id = ?`, message.id);
                    await db.query(`UPDATE kanmi_records
                                    SET flagged = 1
                                    WHERE id = ?`, message.id);
                } else {
                    if (!skipped[message.id])
                        skipped[message.id] = 0;
                    skipped[message.id] = skipped[message.id] + 1;
                    if (skipped[message.id] > 4) {
                        await db.query(`UPDATE kanmi_records
                                        SET flagged = 1
                                        WHERE id = ?`, message.id);
                        await db.query(`INSERT INTO kanmi_cdn_skipped
                                        SET id = ?`, message.id);
                    }
                }
            }
            cb(false)
        }
    }
    async function moveMessage (previous, message, cb, requested_remotely) {
        let attachements = {};

        async function backupCompleted(path) {
            const saveBackupSQL = await db.query(`UPDATE kanmi_records_cdn
                                                  SET id_hint      = ?,
                                                      path_hint    = ?
                                                  WHERE
                                                      eid      = ? AND 
                                                      host    = ?`, [
                message.id,
                path,
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
        if (previous.mfull_hint) {
            attachements['mfull'] = {
                src: path.join(systemglobal.CDN_Base_Path, 'master', previous.path_hint, previous.mfull_hint),
                dest: path.join(systemglobal.CDN_Base_Path, 'master', message.server, message.channel, previous.mfull_hint),
                base: path.join(systemglobal.CDN_Base_Path, 'master', message.server, message.channel),
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
                            db.query(`DELETE FROM kanmi_records_cdn WHERE eid      = ? AND  host    = ?`, [ message.eid, systemglobal.CDN_ID ])
                            console.error(err)
                        }
                        res[k] = (!err)
                        blockOk();
                    })
                }))
            }, Promise.resolve());
            requests.then(async () => {
                Logger.printLine("BackupFile", `Moved ${message.id}`, "debug")
                if (Object.values(res).filter(f => !f).length === 0) {
                    await backupCompleted(`${message.server}/${message.channel}`);
                    cb(requested_remotely || (Object.values(res).filter(f => !f).length === 0));
                } else {
                    cb(true);
                }
            });
        } else {
            Logger.printLine("BackupParts", `Nothing to do for item ${message.id}, No Data Available`, "error")
            cb(requested_remotely || false)
        }
    }

    let activeParseing = false;
    async function findBackupItems(focus_list) {
        activeParseing = true;
        let ignoreQuery = [];
        if (systemglobal.CDN_Ignore_Channels && systemglobal.CDN_Ignore_Channels.length > 0)
            ignoreQuery.push(...systemglobal.CDN_Ignore_Channels.map(e => `channel != '${e}'`))
        if (systemglobal.CDN_Ignore_Servers && systemglobal.CDN_Ignore_Servers.length > 0)
            ignoreQuery.push(...systemglobal.CDN_Ignore_Servers.map(e => `server != '${e}'`))

        const included_focus = (() => {
            if (focus_list) {
                if (systemglobal.CDN_Ignore_Master_Channels)
                    return `AND (channel IN (${focus_list.join(', ')})) AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL) OR (fileid IS NOT NULL AND channel NOT IN (${systemglobal.CDN_Ignore_Master_Channels.join(', ')})))`
                return `AND (channel IN (${focus_list.join(', ')})) AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL) OR fileid IS NOT NULL)`
            }
            return 'AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL) OR fileid IS NOT NULL)'
        })()
        const q = `SELECT x.*, y.heid, y.full, y.mfull, y.preview, y.ext_0, y.ext_1, y.ext_2, y.ext_3, IF(x.attachment_auth_ex > NOW(), 1, 0) AS attachment_auth_valid, IF(x.cache_auth_ex > NOW(), 1, 0) AS cache_auth_valid
                       FROM (SELECT rec.*, ext.data
                             FROM (SELECT * FROM kanmi_records WHERE source = 0 AND flagged = 0 AND hidden = 0 ${included_focus} ${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) rec
                                      LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) ext ON (rec.eid = ext.eid)) x
                                LEFT OUTER JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)
                       WHERE (y.heid IS NULL OR (data IS NOT NULL AND y.ext_0 = 0) OR (x.fileid IS NOT NULL AND y.mfull = 0 ${(systemglobal.CDN_Ignore_Master_Channels) ? 'AND x.channel NOT IN (' + systemglobal.CDN_Ignore_Master_Channels.join(', ') + ')' : ''}))
                         AND x.id NOT IN (SELECT id FROM kanmi_cdn_skipped)
                       ORDER BY RAND()
                       LIMIT ?`;
        console.log(q)
        Logger.printLine("Search", `Preparing Search (Uncached Files)....`, "info");
        const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
        } else {
            await handleBackupItems(backupItems);
            if (!focus_list) {
                await clearDeadFiles();
            }
        }
    }
    async function findEpisodeItems() {
        activeParseing = true;
        const q = `SELECT x.*,
                          y.heid,
                          y.full,
                          y.mfull,
                          y.preview,
                          y.ext_0,
                          y.ext_1,
                          y.ext_2,
                          y.ext_3
                   FROM (SELECT rec.*, ext.data
                         FROM (SELECT *
                               FROM kanmi_records
                               WHERE source = 0 AND flagged = 0  AND hidden = 0 
                                 AND eid IN (SELECT eid
                                             FROM (SELECT eid, episode_num, show_id
                                                   FROM kongou_episodes
                                                   WHERE season_num > 0 AND episode_num <= ${systemglobal.CDN_PreFetch_Episodes || 3}) episodes
                                                      INNER JOIN (SELECT s.*
                                                                  FROM (SELECT * FROM kongou_shows) s
                                                                           INNER JOIN (SELECT * FROM kongou_media_groups WHERE type = 2 ${(systemglobal.CDN_Focus_Media_Groups) ? 'AND (' + systemglobal.CDN_Focus_Media_Groups.map(e => 'media_group = "' + e + '"').join(' OR ') + ')' : ''}) g
                                                                                      ON (g.media_group = s.media_group)) shows
                                                                 ON (episodes.show_id = shows.show_id))
                                 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL) OR fileid IS NOT NULL)) rec
                                  LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) ext ON (rec.eid = ext.eid)) x
                            LEFT OUTER JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)
                   WHERE (y.heid IS NULL OR (x.fileid IS NOT NULL AND y.mfull = 0))
                     AND x.id NOT IN (SELECT id FROM kanmi_cdn_skipped)
                   ORDER BY RAND()
                   LIMIT ?`;
        Logger.printLine("Prefetch", `Preparing Search (Episodes)....`, "info");
        const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Episodes_Per_Interval) ? systemglobal.CDN_N_Episodes_Per_Interval : 150])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
        } else {
            await handleBackupItems(backupItems, true);
        }
    }
    async function findShowData() {
        activeParseing = true;
        const q = `SELECT x.* ,
                          y.hrid, y.host, y.record_int, y.record_id, id_hint, path_hint, dat_0, dat_0_hint, dat_1, dat_1_hint
                   FROM (SELECT show_id, media_group, name, background, poster, md5(CONCAT(COALESCE(poster,''), COALESCE(background,''), show_id)) as hash FROM kongou_shows WHERE (background IS NOT NULL OR poster IS NOT NULL)) x
                            LEFT OUTER JOIN (SELECT * FROM kanmi_aux_cdn WHERE host = ?) y ON (x.hash = y.record_id)
                   WHERE (y.hrid IS NULL)
                   ORDER BY RAND()
                   LIMIT ?`;
        Logger.printLine("Metadata", `Preparing Search (Show Metadata)....`, "info");
        const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
        } else {
            await new Promise(async completed => {
                runCount++;
                if (backupItems.rows.length > 0) {
                    let total = backupItems.rows.length
                    let ticks = 0
                    let requests = backupItems.rows.reduce((promiseChain, m, i, a) => {
                        return promiseChain.then(() => new Promise(async (resolve) => {
                            await (async (message, cb) => {
                                let attachements = {};

                                async function backupCompleted(hash, poster, background) {
                                    if (message.hash) {
                                        const saveBackupSQL = await db.query(`INSERT INTO kanmi_aux_cdn
                                                  SET hrid         = ?,
                                                      record_int = ?,
                                                      host = ?,
                                                      record_id = ?,
                                                      path_hint = ?,
                                                      dat_0 = ?,
                                                      dat_0_hint = ?,
                                                      dat_1 = ?,
                                                      dat_1_hint = ?
                                                  ON DUPLICATE KEY UPDATE
                                                      record_id = ?,
                                                      dat_0 = ?,
                                                      dat_0_hint = ?,
                                                      dat_1 = ?,
                                                      dat_1_hint = ?`, [
                                            (parseInt(message.show_id.toString()) * parseInt(systemglobal.CDN_ID.toString())),
                                            message.show_id,
                                            systemglobal.CDN_ID,
                                            hash,
                                            "kongou",
                                            (!!poster) ? 1 : 0,
                                            (!!poster) ? poster : null,
                                            (!!background) ? 1 : 0,
                                            (!!background) ? background : null,
                                            hash,
                                            (!!poster) ? 1 : 0,
                                            (!!poster) ? poster : null,
                                            (!!background) ? 1 : 0,
                                            (!!background) ? background : null,
                                        ])
                                        if (saveBackupSQL.error) {
                                            Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.eid} as download to CDN`, "err", saveBackupSQL.error)
                                        }
                                    } else {
                                        Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.name} as download to CDN: No Message ID passed`, "err")
                                    }
                                }

                                if (message.background) {
                                    attachements['kongou_bg'] = {
                                        src: `https://cdn.discordapp.com/attachments${message.background}`,
                                        dest: path.join(systemglobal.CDN_Base_Path, 'kongou', 'backdrop'),
                                        ext: message.background.split('?')[0].split('.').pop()
                                    }
                                }
                                if (message.poster) {
                                    attachements['kongou_poster'] = {
                                        src: `https://cdn.discordapp.com/attachments${message.poster}`,
                                        dest: path.join(systemglobal.CDN_Base_Path, 'kongou', 'poster'),
                                        ext: message.poster.split('?')[0].split('.').pop()
                                    }
                                }
                                const hash = md5(`${(message.poster) ? message.poster : ''}${(message.background) ? message.background : ''}${message.show_id}`)

                                if (Object.keys(attachements).length > 0) {
                                    let res = {};
                                    let requests = Object.keys(attachements).reduce((promiseChain, k) => {
                                        return promiseChain.then(() => new Promise(async (blockOk) => {
                                            const val = attachements[k];
                                            let destName = `${message.show_id}`
                                            if (val.ext) {
                                                destName += '.' + val.ext;
                                            }
                                            const pm = await (async () => {
                                                try {
                                                    let pm = await discordClient.createMessage(systemglobal.CDN_TempChannel, val.src.split('?')[0]);
                                                    await sleep(5000);
                                                    let om = await discordClient.getMessage(pm.channel.id, pm.id)
                                                    await discordClient.deleteMessage(pm.channel.id, pm.id)
                                                    return om.embeds[0].thumbnail.url
                                                } catch (e) {
                                                    Logger.printLine("Metadata", `Failed to get attachment from Discord "${val.src}": ${e.message}`, "err", e);
                                                }
                                            })()
                                            const dataTake2 = await new Promise(ok => {
                                                const url = pm;
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
                                                        Logger.printLine("Metadata", `Failed to download attachment "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                                        ok(false)
                                                    } else {
                                                        ok(body);
                                                    }
                                                })
                                            })
                                            if (dataTake2) {
                                                fsEx.ensureDirSync(path.join(val.dest));
                                                const write = await new Promise(ok => {
                                                    fs.writeFile(path.join(val.dest, destName), dataTake2, async (err) => {
                                                        if (err) {
                                                            Logger.printLine("Metadata", `Failed to write download ${message.name} for ${k}`, "err", err)
                                                        }
                                                        ok(!err);
                                                    })
                                                });
                                                res[k] = (write) ? destName : null;
                                                blockOk();
                                            } else {
                                                Logger.printLine("Metadata", `Can't download item ${message.name}, No Data Returned`, "error")
                                                res[k] = false;
                                                blockOk();
                                            }
                                        }))
                                    }, Promise.resolve());
                                    requests.then(async () => {
                                        Logger.printLine("Metadata", `Download ${message.name}`, "debug")
                                        if (Object.values(res).filter(f => !f).length === 0)
                                            await backupCompleted(hash, res.kongou_poster, res.kongou_bg);
                                        cb(true);
                                    });
                                } else {
                                    Logger.printLine("Metadata", `Can't download item ${message.show_id}, No URLs Available`, "error")
                                    cb(false)
                                }
                            })(m, async ok => {
                                ticks++
                                if (ticks >= 100 || a.length <= 100) {
                                    ticks = 0
                                }
                                resolve(ok)
                                m = null
                            }, false)
                        }))
                    }, Promise.resolve());
                    requests.then(async () => {
                        if (total > 0) {
                            Logger.printLine("Metadata", `Completed Download #${runCount} with ${total} files`, "info");
                        } else {
                            Logger.printLine("Metadata", `Nothing to Download #${runCount}`, "info");
                        }
                        completed();
                    })
                } else {
                    Logger.printLine("Metadata", `Nothing to Download #${runCount}`, "info");
                    completed();
                }
            })
        }
    }
    async function findUserData() {
        activeParseing = true;
        const q = `SELECT x.* ,
                          y.hrid, y.host, y.record_int, y.record_id, id_hint, path_hint, dat_0, dat_0_hint, dat_1, dat_1_hint
                   FROM (SELECT id, avatar_custom, banner_custom, md5(CONCAT(COALESCE(avatar_custom,''), COALESCE(banner_custom,''))) as hash FROM discord_users_extended WHERE (banner_custom IS NOT NULL OR avatar_custom IS NOT NULL)) x
                            LEFT OUTER JOIN (SELECT * FROM kanmi_aux_cdn WHERE host = ?) y ON (x.hash = y.record_id)
                   WHERE (y.hrid IS NULL)
                   ORDER BY RAND()
                   LIMIT ?`;
        Logger.printLine("Cache", `Preparing Search (User Metadata)....`, "info");
        const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
        } else {
            await new Promise(async completed => {
                runCount++;
                if (backupItems.rows.length > 0) {
                    let total = backupItems.rows.length
                    let ticks = 0
                    let requests = backupItems.rows.reduce((promiseChain, m, i, a) => {
                        return promiseChain.then(() => new Promise(async (resolve) => {
                            await (async (message, cb) => {
                                let attachements = {};

                                async function backupCompleted(hash, avatar, background) {
                                    if (message.hash) {
                                        const foundRecord = (await db.query(`SELECT hrid FROM kanmi_aux_cdn WHERE record_ref = ? AND path_hint = 'user' AND host = ?`, [message.id, systemglobal.CDN_ID])).rows
                                        if (foundRecord.length > 0) {
                                            const saveBackupSQL = await db.query(`UPDATE kanmi_aux_cdn
                                                  SET record_id = ?,
                                                      dat_0 = ?,
                                                      dat_0_hint = ?,
                                                      dat_1 = ?,
                                                      dat_1_hint = ? WHERE hrid = ?`, [
                                                hash,
                                                (!!avatar) ? 1 : 0,
                                                (!!avatar) ? avatar : null,
                                                (!!background) ? 1 : 0,
                                                (!!background) ? background : null,
                                                foundRecord[0].hrid
                                            ])
                                            if (saveBackupSQL.error) {
                                                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as download to CDN`, "err", saveBackupSQL.error)
                                            }
                                        } else {
                                            const saveBackupSQL = await db.query(`INSERT INTO kanmi_aux_cdn
                                                  SET record_ref = ?,
                                                      host = ?,
                                                      record_id = ?,
                                                      path_hint = ?,
                                                      dat_0 = ?,
                                                      dat_0_hint = ?,
                                                      dat_1 = ?,
                                                      dat_1_hint = ?`, [
                                                message.id,
                                                systemglobal.CDN_ID,
                                                hash,
                                                "user",
                                                (!!avatar) ? 1 : 0,
                                                (!!avatar) ? avatar : null,
                                                (!!background) ? 1 : 0,
                                                (!!background) ? background : null,
                                                hash,
                                                (!!avatar) ? 1 : 0,
                                                (!!avatar) ? avatar : null,
                                                (!!background) ? 1 : 0,
                                                (!!background) ? background : null,
                                            ])
                                            if (saveBackupSQL.error) {
                                                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as download to CDN`, "err", saveBackupSQL.error)
                                            }
                                        }

                                    } else {
                                        Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as download to CDN: No Message ID passed`, "err")
                                    }
                                }

                                if (message.banner_custom) {
                                    attachements['banner'] = {
                                        src: `https://cdn.discordapp.com/attachments${message.banner_custom}`,
                                        dest: path.join(systemglobal.CDN_Base_Path, 'user', 'banner'),
                                        ext: message.banner_custom.split('?')[0].split('.').pop()
                                    }
                                }
                                if (message.avatar_custom) {
                                    attachements['avatar'] = {
                                        src: `https://cdn.discordapp.com/attachments${message.avatar_custom}`,
                                        dest: path.join(systemglobal.CDN_Base_Path, 'user', 'avatar'),
                                        ext: message.avatar_custom.split('?')[0].split('.').pop()
                                    }
                                }
                                const hash = md5(`${(message.avatar_custom) ? message.avatar_custom : ''}${(message.banner_custom) ? message.banner_custom : ''}`)

                                if (Object.keys(attachements).length > 0) {
                                    let res = {};
                                    let requests = Object.keys(attachements).reduce((promiseChain, k) => {
                                        return promiseChain.then(() => new Promise(async (blockOk) => {
                                            const val = attachements[k];
                                            let destName = `${message.id}`
                                            if (val.ext) {
                                                destName += '.' + val.ext;
                                            }
                                            const pm = await (async () => {
                                                try {
                                                    let pm = await discordClient.createMessage(systemglobal.CDN_TempChannel, val.src.split('?')[0]);
                                                    await sleep(5000);
                                                    let om = await discordClient.getMessage(pm.channel.id, pm.id)
                                                    await discordClient.deleteMessage(pm.channel.id, pm.id)
                                                    return om.embeds[0].thumbnail.url
                                                } catch (e) {
                                                    Logger.printLine("Cache", `Failed to get attachment from Discord "${val.src}": ${e.message}`, "err", e);
                                                }
                                            })()
                                            const dataTake2 = await new Promise(ok => {
                                                const url = pm;
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
                                                        Logger.printLine("Cache", `Failed to download attachment (ReQuery) "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                                        ok(false)
                                                    } else {
                                                        ok(body);
                                                    }
                                                })
                                            })
                                            if (dataTake2) {
                                                fsEx.ensureDirSync(path.join(val.dest));
                                                const write = await new Promise(ok => {
                                                    fs.writeFile(path.join(val.dest, destName), dataTake2, async (err) => {
                                                        if (err) {
                                                            Logger.printLine("Cache", `Failed to write download ${message.name} for ${k}`, "err", err)
                                                        }
                                                        ok(!err);
                                                    })
                                                });
                                                res[k] = (write) ? destName : null;
                                                blockOk();
                                            } else {
                                                Logger.printLine("Cache", `Can't download item ${message.id}, No Data Returned`, "error")
                                                res[k] = false;
                                                blockOk();
                                            }
                                        }))
                                    }, Promise.resolve());
                                    requests.then(async () => {
                                        Logger.printLine("Cache", `Download ${message.id}`, "debug")
                                        if (Object.values(res).filter(f => !f).length === 0)
                                            await backupCompleted(hash, res.avatar, res.banner);
                                        cb(true);
                                    });
                                } else {
                                    Logger.printLine("Cache", `Can't download item ${message.id}, No URLs Available`, "error")
                                    cb(false)
                                }
                            })(m, async ok => {
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
                            Logger.printLine("Cache", `Completed Download #${runCount} with ${total} files`, "info");
                        } else {
                            Logger.printLine("Cache", `Nothing to Download #${runCount}`, "info");
                        }
                        completed();
                    })
                } else {
                    Logger.printLine("Cache", `Nothing to Download #${runCount}`, "info");
                    completed();
                }
            });
        }
    }
    async function handleBackupItems(backupItems, allow_master) {
        return new Promise(async completed => {
            runCount++;
            if (backupItems.rows.length > 0) {
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
                        }, false, allow_master)
                    }))
                }, Promise.resolve());
                requests.then(async () => {
                    if (total > 0) {
                        Logger.printLine("Download", `Completed Download #${runCount} with ${total} files`, "info");
                    } else {
                        Logger.printLine("Download", `Nothing to Download #${runCount}`, "info");
                    }
                    completed();
                })
            } else {
                Logger.printLine("Download", `Nothing to Download #${runCount}`, "info");
                completed();
            }
        });
    }
    async function clearDeadFiles() {
        // SELECT path_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE eid NOT IN (SELECT eid FROM kanmi_records);
        const ignore = (() => {
            if (systemglobal.CDN_Ignore_Channels && systemglobal.CDN_Ignore_Channels.length > 0)
                return ' OR eid IN (SELECT eid FROM kanmi_records WHERE (' + systemglobal.CDN_Ignore_Channels.map(e => `channel = '${e}'`).join(' OR ') + '))'
            return '';
        }
        )()
        const q = `SELECT eid, path_hint, mfull_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE (eid NOT IN (SELECT eid FROM kanmi_records)${ignore}) AND host = ?`;
        const removedItems = await db.query(q, [systemglobal.CDN_ID])
        if (removedItems.rows.length > 0) {
            let eids = [];
            let requests = removedItems.rows.reduce((promiseChain, deleteItem, i, a) => {
                return promiseChain.then(() => new Promise((resolve) => {
                    const channel = deleteItem.path_hint.split('/')[1];
                    const shouldTrash = (systemglobal.CDN_Trash_Path && systemglobal.CDN_Trash_Channels && systemglobal.CDN_Trash_Channels.length > 0) ? systemglobal.CDN_Trash_Channels.indexOf(channel) !== -1 : false;
                    if (deleteItem.mfull_hint) {
                        try {
                            if (shouldTrash) {
                                try {
                                    fsEx.ensureDirSync(path.join(systemglobal.CDN_Trash_Path, 'master', channel));
                                    fs.copyFileSync(
                                        path.join(systemglobal.CDN_Base_Path, 'master', deleteItem.path_hint, deleteItem.mfull_hint),
                                        path.join(systemglobal.CDN_Trash_Path, 'master', channel, deleteItem.mfull_hint))
                                } catch (e) {
                                    Logger.printLine("CDN Cleaner", `Failed to Trash master copy: ${deleteItem.eid}: ${e.message}`, "error");
                                }
                            }
                            fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'master', deleteItem.path_hint, deleteItem.mfull_hint));
                            Logger.printLine("CDN Cleaner", `${(shouldTrash)? "Delete" : "Trash"} master copy: ${deleteItem.eid}`, "info");
                        } catch (e) {
                            Logger.printLine("CDN Cleaner", `Failed to delete master copy: ${deleteItem.eid}`, "err", e.message);
                            //console.error(e);
                        }
                    }
                    if (deleteItem.full_hint) {
                        try {
                            if (shouldTrash) {
                                try {
                                    fsEx.ensureDirSync(path.join(systemglobal.CDN_Trash_Path, 'full', channel));
                                    fs.copyFileSync(
                                        path.join(systemglobal.CDN_Base_Path, 'full', deleteItem.path_hint, deleteItem.full_hint),
                                        path.join(systemglobal.CDN_Trash_Path, 'full', channel, deleteItem.full_hint))
                                } catch (e) {
                                    Logger.printLine("CDN Cleaner", `Failed to Trash full copy: ${deleteItem.eid}: ${e.message}`, "error");
                                }
                            }
                            fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'full', deleteItem.path_hint, deleteItem.full_hint));
                            Logger.printLine("CDN Cleaner", `${(shouldTrash)? "Delete" : "Trash"} full copy: ${deleteItem.eid}`, "info");
                        } catch (e) {
                            Logger.printLine("CDN Cleaner", `Failed to delete full copy: ${deleteItem.eid}`, "err", e.message);
                            //console.error(e);
                        }
                    }
                    if (deleteItem.preview_hint) {
                        try {
                            if (shouldTrash) {
                                try {
                                    fsEx.ensureDirSync(path.join(systemglobal.CDN_Trash_Path, 'preview', channel));
                                    fs.copyFileSync(
                                        path.join(systemglobal.CDN_Base_Path, 'preview', deleteItem.path_hint, deleteItem.preview_hint),
                                        path.join(systemglobal.CDN_Trash_Path, 'preview', channel, deleteItem.preview_hint))
                                } catch (e) {
                                    Logger.printLine("CDN Cleaner", `Failed to Trash preview copy: ${deleteItem.eid}: ${e.message}`, "error");
                                }
                            }
                            fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'preview', deleteItem.path_hint, deleteItem.preview_hint));
                            Logger.printLine("CDN Cleaner", `${(shouldTrash)? "Delete" : "Trash"} preview copy: ${deleteItem.eid}`, "info");
                        } catch (e) {
                            Logger.printLine("CDN Cleaner", `Failed to delete preview copy: ${deleteItem.eid}`, "err", e.message);
                            //console.error(e);
                        }
                    }
                    if (deleteItem.ext_0_hint) {
                        try {
                            fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'extended_preview', deleteItem.path_hint, deleteItem.ext_0_hint));
                            Logger.printLine("CDN Cleaner", `Delete extended preview copy: ${deleteItem.eid}`, "info");
                        } catch (e) {
                            Logger.printLine("CDN Cleaner", `Failed to delete extended preview copy: ${deleteItem.eid}`, "err", e.message);
                            //console.error(e);
                        }
                    }
                    eids.push(deleteItem.eid)
                    resolve();
                }))
            }, Promise.resolve());
            requests.then(async () => {
                if (eids.length > 0) {
                    if (eids.length > 500)  {
                        function splitArray(array, chunkSize) {
                            const result = [];
                            for (let i = 0; i < array.length; i += chunkSize) {
                                result.push(array.slice(i, i + chunkSize));
                            }
                            return result;
                        }

                        (splitArray(eids, 300)).map(async batch => {
                            await db.query(`DELETE FROM kanmi_records_cdn WHERE eid IN (${batch.join(', ')}) AND host = ?`, [systemglobal.CDN_ID]);
                            console.log(`'DELETE BATCH [${batch.join(', ')}]'`)
                        })
                    } else {
                        await db.query(`DELETE FROM kanmi_records_cdn WHERE eid IN (${eids.join(', ')}) AND host = ?`, [systemglobal.CDN_ID]);
                        console.log(`'DELETE BATCH [${eids.join(', ')}]'`)
                    }
                }
                console.log('Cleanup Complete')
            })
        }
    }

    discordClient.on("ready", async () => {
        Logger.printLine("Discord", "Connected successfully to Discord!", "debug")
        Logger.printLine("Discord", `Using Account: ${discordClient.user.username} (${discordClient.user.id})`, "debug")
        const gatewayURL = new URL(discordClient.gatewayURL);
        Logger.printLine("Discord", `Gateway: ${gatewayURL.host} using v${gatewayURL.searchParams.getAll('v').pop()}`, "debug")
        if (init === 0) {
            discordClient.editStatus( "dnd", {
                name: 'Initializing System',
                type: 0
            })
            if (systemglobal.CDN_Base_Path) {
                start();
                console.log(await db.query(`UPDATE kanmi_records_cdn c INNER JOIN kanmi_records r ON c.eid = r.eid SET id_hint = r.id WHERE id_hint IS NULL`));
                console.log("Waiting 30sec before normal tasks..")
                setTimeout(async () => {
                    await findUserData();
                    await findShowData();
                    if (systemglobal.CDN_Focus_Channels) {
                        await findBackupItems(systemglobal.CDN_Focus_Channels);
                    }
                    await findBackupItems();
                    if (systemglobal.CDN_Focus_Media_Groups || systemglobal.CDN_PreFetch_Episodes) {
                        await findEpisodeItems();
                    }
                    console.log("First Pass OK");
                    activeParseing = false;
                    setInterval(async () => {
                        if (activeParseing) {
                            console.log('System Busy');
                        } else {
                            await findUserData();
                            await findBackupItems();
                            await findShowData();
                            await findEpisodeItems();
                        }
                        activeParseing = false;
                    }, (systemglobal.CDN_Interval_Min) ? systemglobal.CDN_Interval_Min * 60000 : 3600000);
                    discordClient.editStatus( "online", {
                        name: null,
                        type: 0
                    });
                }, 30000)
            } else {
                Logger.printLine("Init", "Unable to start Download client, no directory setup!", "error")
            }
        }
        init = 1;
    });
    discordClient.on("error", (err) => {
        Logger.printLine("Discord", "Shard Error, Rebooting...", "error", err);
        console.error(err);
        discordClient.connect();
    });

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

    tx2.action('clean', async (reply) => {
        await clearDeadFiles();
        reply({ answer : 'started' });
    });

    discordClient.connect().catch((er) => { Logger.printLine("Discord", "Failed to connect to Discord", "emergency", er) });
})()
