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
    const { createCanvas, loadImage } = require('canvas');
    const md5 = require("md5");
    const tx2 = require('tx2');
    const express = require('express');
    let args = minimist(process.argv.slice(2));
    const sizeOf = require('image-size');
    const remoteSize = require('remote-file-size');
    const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
    const Discord_CDN_Accepted_Files = ['jpg','jpeg','jfif','png','gif', 'webp'];

    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);
    const app = express();

    if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
        systemglobal.MQServer = process.env.MQ_HOST.trim()
    if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
        systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
    if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
        systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

    let runCount = 0;
    let init = 0;
    let pause = false;
    Logger.printLine("Init", "CDN", "info");
    let skipped = {};
    let pastFiles = {};

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'cdn' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.HostID])
        if (_systemparams.error) { Logger.printLine("SQL", "Error getting system parameter records!", "emergency", _systemparams.error); return false }
        const systemparams_sql = _systemparams.rows.reverse();

        if (systemparams_sql.length > 0) {
            const _discord_user_account = systemparams_sql.filter(e => e.param_key === 'user.login');
            if (_discord_user_account.length > 0 && _discord_user_account[0].param_value) {
                systemglobal.User_Discord_Key = _discord_user_account[0].param_value
            }
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
                if (_backup_config[0].param_data.match_latest)
                    systemglobal.CDN_Match_Latest = _backup_config[0].param_data.match_latest;
                if (_backup_config[0].param_data.delay_download)
                    systemglobal.CDN_Delay_Pull = _backup_config[0].param_data.delay_download;
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

    if (systemglobal.User_Discord_Key)
        Logger.printLine("Init", `You have configured a user level discord token that will be used to lower level functions, this may violate Discord TOS. With great power comes great responsiblity yada yada who cares...`, "warning");

    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    // Kanmi MQ Backend
    function startWorker() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 1 Error", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 1 Closed", (pause) ? "warning" : "critical")
                if (!pause)
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
            if (err && !pause) {
                Logger.printLine("KanmiMQ", "Initialization Error", "critical", err)
                return setTimeout(start, 1000);
            }
            conn.on("error", function(err) {
                if (err.message !== "Connection closing") {
                    Logger.printLine("KanmiMQ", "Initialization Connection Error", "emergency", err)
                }
            });
            conn.on("close", function() {
                if (!pause) {
                    Logger.printLine("KanmiMQ", "Attempting to Reconnect...", "debug")
                    return setTimeout(start, 1000);
                }
            });
            Logger.printLine("KanmiMQ", `Connected to Kanmi Exchange as ${systemglobal.SystemName}!`, "info")
            amqpConn = conn;
            whenConnected();
        });
    }
    function closeOnErr(err) {
        if (!err) return false;
        if (!pause) {
            Logger.printLine("KanmiMQ", "Connection Closed due to error", "error", err)
            amqpConn.close();
        }
        return true;
    }
    async function whenConnected() {
        startWorker();
        if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID && init === 0) {
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
            }
        }
        if (deleteItem.ext_0_hint) {
            try {
                fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'extended_preview', deleteItem.path_hint, deleteItem.ext_0_hint));
                Logger.printLine("CDN Manager", `Delete extended preview copy: ${deleteItem.eid}`, "info");
                deletedAction = true;
            } catch (e) {
                Logger.printLine("CDN Manager", `Failed to delete extended preview copy: ${deleteItem.eid}`, "err", e.message);
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
            }
            if (deleteItem.full_hint || deleteItem.preview_hint || deleteItem.ext_0_hint) {
                db.query(`UPDATE kanmi_records_cdn SET mfull = 0, mfull_hint = null WHERE eid = ? AND host = ?`, [deleteItem.eid, systemglobal.CDN_ID]);
            } else {
                db.query(`DELETE FROM kanmi_records_cdn WHERE eid = ? AND host = ?`, [deleteItem.eid, systemglobal.CDN_ID]);
            }
        }
    }

    async function getDiscordURL(url, eid) {
        if (!systemglobal.User_Discord_Key)
            return url;
        return new Promise(async ok => {
            const params = new URLSearchParams('?' + url.split('?')[1]);
            if (params.get('ex') && params.get('is') && params.get('hm')) {
                const expires = new Date(parseInt(params.get('ex') || '', 16) * 1000);
                if (expires.getTime() > Date.now()) {
                    ok(ok);
                    return false;
                }
            }
            const payload = {
                method: 'POST',
                headers: {
                    'Authorization': `${systemglobal.User_Discord_Key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ attachment_urls: [url] })
            };

            const response = await fetch('https://discord.com/api/v9/attachments/refresh-urls', payload);

            if (response.status !== 200) {
                ok(false);
                return false;
            }

            const json = await response.json();

            if (Array.isArray(json.refreshed_urls) && json.refreshed_urls[0].refreshed) {
                const refreshed_url = new URL(json.refreshed_urls[0].refreshed);
                ok(refreshed_url.href);

                const ah = refreshed_url.href.split('?');
                let exSearch = new URLSearchParams(ah[1]);
                const date = new Date(parseInt(exSearch.get('ex') || '', 16) * 1000);
                const ex = moment(date).local().format('YYYY-MM-DD HH:mm:ss');
                if (eid) {
                    await db.query(`UPDATE kanmi_records SET attachment_auth = ?, attachment_auth_ex = ? WHERE eid = ?`, [ah[1], ex, eid])
                } else {
                    const el = ah[0].split('attachments/').pop().split('/');
                    await db.query(`UPDATE kanmi_records SET attachment_auth = ?, attachment_auth_ex = ? WHERE channel = ? AND attachment_hash = ?`, [ah[1], ex, el[0], el[1]])
                }
            } else {
                ok(false);
            }
            return false;
        });
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
                } else {
                    //Logger.printLine("BackupFile", `Download ${message.id} Complete`, "debug")
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
                        const date = new Date(parseInt(exSearch.get('ex') || '', 16) * 1000);
                        ex = moment(date).local().format('YYYY-MM-DD HH:mm:ss');
                    } catch (err) {
                        Logger.printLine("Discord", `Failed to get auth expire time value for database row!`, "error", err);
                    }
                    auth = `?${a}`;
                    await db.query(`UPDATE kanmi_records
                                    SET attachment_auth    = ?,
                                        attachment_auth_ex = ?
                                    WHERE eid = ?`, [a, ex, message.eid])
                } catch (e) {
                    Logger.printLine("DiscordAuth", `Failed to save new authentication hash: ${e.message}`, "error");
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
                                const date = new Date(parseInt(exSearch.get('ex') || '', 16) * 1000);
                                ex = moment(date).local().format('YYYY-MM-DD HH:mm:ss');
                            } catch (err) {
                                Logger.printLine("Discord", `Failed to get auth expire time value for database row!`, "error", err);
                            }
                            auth2 = `?${as[1]}`;
                            await db.query(`UPDATE kanmi_records
                                            SET cache_auth    = ?,
                                                cache_auth_ex = ?
                                            WHERE eid = ?`, [as[1], ex, message.eid])
                        }
                    }
                } catch (e) {
                    Logger.printLine("DiscordAuth", `Failed to save new cache authentication hash: ${e.message}`, "error");
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
        } else if (message.attachment_hash && message.attachment_name && Discord_CDN_Accepted_Files.indexOf(message.attachment_name.split('.').pop().split('?')[0].toLowerCase()) !== -1) {
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
            const master_urls = await db.query(`SELECT
                                                    MAX(channelid) AS channelid,
                                                    MAX(messageid) AS messageid,
                                                    MAX(url) AS url,
                                                    MAX(valid) AS valid,
                                                    MAX(auth) AS auth,
                                                    MAX(IF(auth_expire > NOW() + INTERVAL 8 HOUR, 1, 0)) AS auth_valid,
                                                    MAX(hash) AS hash,
                                                    SUBSTRING_INDEX(MAX(url), '/', -1) AS filename
                                                FROM discord_multipart_files
                                                WHERE fileid = ?
                                                  AND valid = 1
                                                  AND messageid NOT IN (SELECT id FROM kanmi_cdn_skipped)
                                                GROUP BY SUBSTRING_INDEX(url, '/', -1)  -- Using the full expression instead of the alias
                                                ORDER BY filename;
            `, [message.fileid]);
            attachements['mfull'] = {
                id: message.fileid,
                filename: message.real_filename,
                src: (master_urls.rows.length > 0) ? master_urls.rows : [],
                dest: path.join(systemglobal.CDN_Base_Path, 'master', message.server, message.channel),
                ext: message.real_filename.split('?')[0].split('.').pop()
            }
        }

        if (!pastFiles[message.id])
            pastFiles[message.id] = -1;
        pastFiles[message.id] = pastFiles[message.id] + 1;
        if (Object.keys(attachements).length > 0) {
            let resData = {};
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
                        if (val.src.length > 0) {
                            let part_urls = [];
                            let unknownMessage = false;
                            let part_download = val.src.reduce((promiseChainParts, u, i) => {
                                return promiseChainParts.then(() => new Promise(async (partOk) => {
                                    if (!unknownMessage) {
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
                                                        await (async () => {
                                                            try {
                                                                const a = pm.attachments[0].url.split('?')[1];
                                                                let ex = null;
                                                                try {
                                                                    let exSearch = new URLSearchParams(a);
                                                                    const date = new Date(parseInt(exSearch.get('ex') || '', 16) * 1000);
                                                                    ex = moment(date).local().format('YYYY-MM-DD HH:mm:ss');
                                                                } catch (err) {
                                                                    Logger.printLine("Discord", `Failed to get auth expire time value for parity database row!`, "error", err);
                                                                }
                                                                auth = `?${a}`;
                                                                await db.query(`UPDATE discord_multipart_files
                                                                                SET url         = ?,
                                                                                    auth        = ?,
                                                                                    auth_expire = ?
                                                                                WHERE channelid = ?
                                                                                  AND messageid = ?`, [pm.attachments[0].url.split('/attachments').pop().split('?')[0], a, ex, u.channelid, u.messageid])
                                                            } catch (e) {
                                                                Logger.printLine("DiscordAuth", `Failed to save new authentication hash for multifile part: ${e.message}`, "error");
                                                            }
                                                        })()
                                                        url = pm.attachments[0].url;
                                                    }
                                                } catch (e) {
                                                    Logger.printLine("Discord", `Failed to get parity attachemnt from discord: ${e.message}`, "error");
                                                    if (e.message && e.message.includes("Unknown Message")) {
                                                        unknownMessage = true;
                                                    }
                                                    url = null
                                                }
                                            }
                                            if (url) {
                                                Logger.printLine("BackupFile", `Downloading Parity Part (${i}/${val.src.length}) ${url.split('/').pop().split('?')[0]} for ${k} ${destName}...`, "debug");
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
                                            if (unknownMessage) {
                                                skipped[message.id] = 999;
                                                Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}/${i}: Can't download item ${u.url.split('?')[0].split('/').pop()} for ${message.eid}, No Data Returned & Corrupt Files!`, "error")
                                            } else {
                                                Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}/${i}: Can't download item ${u.url.split('?')[0].split('/').pop()} for ${message.eid}, No Data Returned`, "error")
                                            }
                                            part_urls[i] = false;
                                            partOk();
                                        }
                                    } else {
                                        skipped[message.id] = 999;
                                        Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}/${i}: EARLY ABORT: Can't download item ${u.url.split('?')[0].split('/').pop()} for ${message.eid}, No Data Returned & Corrupt Files!`, "error")
                                        part_urls[i] = false;
                                        partOk();
                                    }
                                }))
                            }, Promise.resolve());
                            part_download.then(async () => {
                                if (Object.values(part_urls).filter(f => !f).length === 0 && ((message.paritycount === null && part_urls.length > 1) || (message.paritycount && message.paritycount === part_urls.length))) {
                                    const files = part_urls.sort((x, y) => (x.split('.').pop() < y.split('.').pop()) ? -1 : (y.split('.').pop() > x.split('.').pop()) ? 1 : 0);
                                    fsEx.ensureDirSync(path.join(val.dest));
                                    fsEx.removeSync(path.join(val.dest, destName));
                                    await splitFile.mergeFiles(files, path.join(val.dest, destName));
                                    fsEx.removeSync(path.join(systemglobal.CDN_TempDownload_Path, message.eid.toString()));
                                    try {
                                        resData[k] = (fs.existsSync(path.join(val.dest, destName))) ? destName : null;
                                        Logger.printLine("BackupFile", `${message.eid || message.id}/${k}: Download Master File ${message.real_filename}`, "info");
                                    } catch (e) {
                                        resData[k] = false;
                                    }
                                    if (resData[k] && message.paritycount === null) {
                                        await db.query(`UPDATE kanmi_records
                                                        SET paritycount = ?
                                                        WHERE id = ?`, [Object.values(part_urls).filter(f => !!f).length, message.id])
                                    }
                                } else {
                                    Logger.printLine("BackupFile", `${message.eid || message.id}/${k}: Did not save ${message.real_filename}, Files OK: ${Object.values(part_urls).filter(f => !f).length === 0} Parity OK: ${(message.paritycount === part_urls.length) ? true : (message.paritycount < part_urls.length) ? "overflow" : "missing"} (${part_urls.length}/${message.paritycount})`, "error")
                                    resData[k] = false;
                                }
                                blockOk();
                            });
                        } else {
                            Logger.printLine("BackupFile", `${message.eid || message.id}/${k}: Did not save ${message.real_filename}, Files OK: false Parity OK: No Parity Data! (0/${message.paritycount})`, "error")
                            resData[k] = false;
                            blockOk();
                        }
                    } else {
                        const data = await new Promise(ok => {
                            if (val.src && val.src.includes("ex=")) {
                                const url = val.src;
                                Logger.printLine("BackupFile", `${message.eid || message.id}/${k}: Downloading Attachment ${url.split('/').pop().split('?')[0]} => ${destName}...`, "debug");
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
                                    Logger.printLine("ImageCheck", `Image failed to pass image validation: ${e.message}`, "error");
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
                                        Logger.printLine("CopyFile", `${message.eid || message.id}/${k}: Failed to write download ${destName} to disk!`, "err", err)
                                    }
                                    ok(!err);
                                })
                            });
                            resData[k] = (write) ? destName : null;
                            blockOk();
                        } else if (systemglobal.CDN_TempChannel && systemglobal.User_Discord_Key && !systemglobal.CDN_No_Research) {
                            const url = await getDiscordURL(val.src, message.eid);
                            const dataTake2 = await new Promise(ok => {
                                Logger.printLine("BackupFile", `${message.eid || message.id}/${k}: Downloading Attachment (Research) ${url.split('/').pop().split('?')[0]} => ${destName}...`, "debug");
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
                                            Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}: Failed to download attachment (ReQuery) "${url}" - Requires revalidation!`, "err", (err) ? err : undefined)
                                            mqClient.sendData(systemglobal.Discord_Out, {
                                                fromClient: `return.CDN.${systemglobal.SystemName}`,
                                                messageReturn: false,
                                                messageID: message.id,
                                                messageChannelID: message.channel,
                                                messageServerID: message.server,
                                                messageType: 'command',
                                                messageAction: 'ValidateMessage'
                                            }, function (callback) {
                                                if (!callback) {
                                                    Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out}`, "error")
                                                }
                                            });
                                        } else {
                                            Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}: Failed to download attachment (ReQuery) "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
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
                                        Logger.printLine("ImageCheck", `Image failed to pass image validation: ${e.message}`, "error");
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
                                            Logger.printLine("CopyFile", `${message.eid || message.id}/${k}: Failed to write download ${destName} to disk!`, "err", err)
                                        }
                                        ok(!err);
                                    })
                                });
                                resData[k] = (write) ? destName : null;
                                blockOk();
                            } else {
                                Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}: Can't download, No Data Returned`, "error")
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
                                        if (!callback) {
                                            Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out}`, "error")
                                        }
                                    });
                                    resData[k] = false;
                                    blockOk();
                                } else if ((k === 'preview' || k === 'extended_preview') && attachements.full.src) {
                                    const full_data = await new Promise(ok => {
                                        const url = attachements.full.src;
                                        Logger.printLine("BackupFile", `${message.eid || message.id}/${k}: Downloading Attachment (Sharp Convert) ${url.split('/').pop().split('?')[0]} => ${destName}...`, "debug")
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
                                                Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}: Failed to download attachment "${url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
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
                                                Logger.printLine("ImageCheck", `Image failed to pass image validation: ${e.message}`, "error");
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
                                        resData[k] = (await new Promise(image_saved => {
                                            sharp(full_data)
                                                .resize(resizeParam)
                                                .toFormat(destName.split('.').pop().toLowerCase())
                                                .withMetadata()
                                                .toFile(path.join(val.dest, destName), function (err) {
                                                    if (err) {
                                                        Logger.printLine("CopyFile", `${message.eid || message.id}/${k}: Failed to write preview file to disk!: ${err.message}`, "err", err);
                                                        if ((attachements['full'].ext || message.attachment_name.replace(message.id, '').split('?')[0].split('.').pop()).toLowerCase() === destName.split('.').pop().toLowerCase()) {
                                                            fs.writeFile(path.join(val.dest, destName), full_data, async (err) => {
                                                                if (err) {
                                                                    Logger.printLine("CopyFile", `${message.eid || message.id}/${k}: Failed to write full/preview to disk!`, "err", err)
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
                                        Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}: Can't download item for conversion, No Data Returned`, "error")
                                        resData[k] = false;
                                        blockOk();
                                    }
                                } else {
                                    resData[k] = false;
                                    blockOk();
                                }
                            }
                        } else {
                            Logger.printLine("DownloadFile", `${message.eid || message.id}/${k}: Can't download item, No Data Returned`, "error");
                            resData[k] = false;
                            blockOk();
                        }
                    }
                }))
            }, Promise.resolve());
            requests.then(async () => {
                if (Object.values(resData).filter(f => !f).length === 0) {
                    Logger.printLine("BackupFile", `${message.eid || message.id}: Download OK [P:${!!resData.preview} F:${!!resData.full} M:${!!resData.mfull} EP:${!!resData.extended_preview}]`, "info")
                    await backupCompleted(`${message.server}/${message.channel}`, resData.preview, resData.full, resData.extended_preview, resData.mfull);
                    if (message && message.id)
                        await db.query(`DELETE FROM kanmi_cdn_skipped WHERE id = ? LIMIT 1000`, message.id);
                } else {
                    if (message && message.id) {
                        if (!skipped[message.id])
                            skipped[message.id] = 0;
                        skipped[message.id] = skipped[message.id] + 1;
                        if (systemglobal.CDN_Fast_Skip) {
                            Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed (Skipped) [P:${!!resData.preview} F:${!!resData.full} M:${!!resData.mfull} EP:${!!resData.extended_preview}]`, "error")
                            await db.query(`UPDATE kanmi_records SET flagged = 1, tags = CONCAT(tags, '3/1/dead_file;')${(systemglobal.CDN_Hide_On_Skip) ? ", hidden = 1" : ""}  WHERE id = ?`, message.id);
                            await db.query(`INSERT INTO kanmi_cdn_skipped SET id = ?`, message.id);
                        } else if (skipped[message.id] > 4) {
                            Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed (Skipped) [P:${!!resData.preview} F:${!!resData.full} M:${!!resData.mfull} EP:${!!resData.extended_preview}]`, "error")
                            await db.query(`UPDATE kanmi_records SET flagged = 1, tags = CONCAT(tags, '3/1/dead_file;')${(systemglobal.CDN_Hide_On_Skip) ? ", hidden = 1" : ""} WHERE id = ?`, message.id);
                            await db.query(`INSERT INTO kanmi_cdn_skipped SET id = ?`, message.id);
                        } else {
                            Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed (${(skipped[message.id] || 0) + 1} Times) [P:${!!resData.preview} F:${!!resData.full} M:${!!resData.mfull} EP:${!!resData.extended_preview}]`, "warning")
                        }
                    } else {
                        await db.query(`DELETE FROM kanmi_cdn_skipped WHERE id = ? LIMIT 1000`, message.id);
                        Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed [P:${!!resData.preview} F:${!!resData.full} M:${!!resData.mfull} EP:${!!resData.extended_preview}]`, "error")
                    }
                }
                cb(true);
            });
        } else {
            Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed, No URLs Available`, "error");
            if (message && message.id) {
                if (!skipped[message.id])
                    skipped[message.id] = 0;
                skipped[message.id] = skipped[message.id] + 1;
                if (systemglobal.CDN_Fast_Skip) {
                    await db.query(`INSERT INTO kanmi_cdn_skipped
                                    SET id = ?`, message.id);
                    await db.query(`UPDATE kanmi_records SET flagged = 1, tags = CONCAT(tags, '3/1/dead_file;')${(systemglobal.CDN_Hide_On_Skip) ? ", hidden = 1" : ""} WHERE id = ?`, message.id);
                    Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed (Skipped) [NO URLS]`, "error");
                } else if (skipped[message.id] > 4) {
                    await db.query(`UPDATE kanmi_records SET flagged = 1, tags = CONCAT(tags, '3/1/dead_file;')${(systemglobal.CDN_Hide_On_Skip) ? ", hidden = 1" : ""} WHERE id = ?`, message.id);
                    await db.query(`INSERT INTO kanmi_cdn_skipped
                                        SET id = ?`, message.id);
                    Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed (Skipped) [NO URLS]`, "error");
                } else {
                    Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed (${(skipped[message.id] || 0) + 1} Times) [NO URLS]`, "warning")
                }
            } else {
                Logger.printLine("BackupFile", `${message.eid || message.id}: Download Failed [NO ID // NO URLS]`, "error")
            }
            cb(true)
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
                    fs.copyFile(val.src, val.dest, err => {
                        if (err) {
                            Logger.printLine("MoveFile", `Failed to move ${k} file for ${message.id} in ${message.channel}: ${err.message}`, "err", err);
                            db.query(`DELETE FROM kanmi_records_cdn WHERE eid      = ? AND  host    = ?`, [ message.eid, systemglobal.CDN_ID ])
                        } else {
                            fs.unlinkSync(val.src);
                        }
                        res[k] = (!err)
                        blockOk();
                    })
                }))
            }, Promise.resolve());
            requests.then(async () => {
                if (Object.values(res).filter(f => !f).length === 0) {
                    await backupCompleted(`${message.server}/${message.channel}`);
                    Logger.printLine("MoveFile", `Moved ${message.id}`, "info")
                    cb(requested_remotely || (Object.values(res).filter(f => !f).length === 0));
                } else {
                    Logger.printLine("MoveFile", `Failed to moved ${message.id}`, "error");
                    cb(true);
                }
            });
        } else {
            Logger.printLine("MoveFile", `Nothing to do for item ${message.id}, No Data Available`, "error")
            cb(requested_remotely || false)
        }
    }

    let activeParseing = false;
    async function findItemsToMigrate() {
        activeParseing = true;
        let ignoreQuery = [];
        if (systemglobal.CDN_Ignore_Channels && systemglobal.CDN_Ignore_Channels.length > 0)
            ignoreQuery.push(...systemglobal.CDN_Ignore_Channels.map(e => `channel != '${e}'`))
        if (systemglobal.CDN_Ignore_Servers && systemglobal.CDN_Ignore_Servers.length > 0)
            ignoreQuery.push(...systemglobal.CDN_Ignore_Servers.map(e => `server != '${e}'`))

        const q = `SELECT y.eid, y.path_hint, y.mfull_hint, y.full_hint, y.preview_hint, y.ext_0_hint, x.channel, x.server, x.id
                       FROM (SELECT rec.*, ext.data
                             FROM (SELECT * FROM kanmi_records WHERE source = 0 AND flagged = 0 AND hidden = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL) OR fileid IS NOT NULL) ${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) rec
                                      LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) ext ON (rec.eid = ext.eid)) x
                                JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)
                       WHERE y.path_hint != CONCAT(x.server, '/', x.channel) AND x.n_channel IS NULL
                         AND x.id NOT IN (SELECT id FROM kanmi_cdn_skipped)
                       ORDER BY RAND() LIMIT ?`;
        Logger.printLine("Search", `Search for data to migrate....`, "info");
        const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to migrate!`, "crit", backupItems.error)
        } else {
            await handleMigratableItems(backupItems);
        }
    }
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
        const q = `SELECT x.*, y.heid, y.full, y.mfull, y.preview, y.ext_0, y.ext_1, y.ext_2, y.ext_3, IF(x.attachment_auth_ex > NOW() + INTERVAL 8 HOUR, 1, 0) AS attachment_auth_valid, IF(x.cache_auth_ex > NOW() + INTERVAL 8 HOUR, 1, 0) AS cache_auth_valid
                       FROM (SELECT rec.*, ext.data
                             FROM (SELECT * FROM kanmi_records WHERE source = 0 AND flagged = 0 AND hidden = 0 ${included_focus} ${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) rec
                                      LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) ext ON (rec.eid = ext.eid)) x
                                LEFT OUTER JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)
                       WHERE (y.heid IS NULL OR (data IS NOT NULL AND y.ext_0 = 0) OR 
                              (x.fileid IS NOT NULL AND y.mfull = 0 ${(systemglobal.CDN_Ignore_Master_Channels) ? 'AND x.channel NOT IN (' + systemglobal.CDN_Ignore_Master_Channels.join(', ') + ')' : ''}))
                         AND x.id NOT IN (SELECT id FROM kanmi_cdn_skipped) ${(systemglobal.CDN_Delay_Pull) ? 'AND (((fileid IS NULL AND attachment_name NOT LIKE \'%.mp%_\' AND attachment_name NOT LIKE \'%.jp%_\' AND attachment_name NOT LIKE \'%.jfif\' AND attachment_name NOT LIKE \'%.png\' AND attachment_name NOT LIKE \'%.gif\' AND attachment_name NOT LIKE \'%.web%_\') AND x.attachment_auth_ex > NOW() + INTERVAL 12 HOUR) OR (x.attachment_auth_ex < NOW() + INTERVAL 12 HOUR))' : ''}
                       ORDER BY ${(systemglobal.CDN_Match_Latest) ? "eid DESC" : "RAND()"}
                       LIMIT ?`;
        console.log(q);
        Logger.printLine("Search", `Preparing Search (Uncached Files)....`, "info");
        const backupItems = await db.query(q, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
        } else {
            await handleBackupItems(backupItems);
            if (!focus_list) {
                await findItemsToMigrate();
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
                                        Logger.printLine("Metadata", `Download ${message.name}`, "info")
                                        if (Object.values(res).filter(f => !f).length === 0)
                                            await backupCompleted(hash, res.kongou_poster, res.kongou_bg);
                                        cb(true);
                                    });
                                } else {
                                    Logger.printLine("Metadata", `Can't download item ${message.show_id}, No URLs Available`, "error")
                                    if (message && message.id) {
                                        if (!skipped[message.id])
                                            skipped[message.id] = 0;
                                        skipped[message.id] = skipped[message.id] + 1;
                                        if (systemglobal.CDN_Fast_Skip) {
                                            await db.query(`INSERT INTO kanmi_cdn_skipped SET id = ?`, message.id);
                                            await db.query(`UPDATE kanmi_records SET flagged = 1, tags = CONCAT(tags, '3/1/dead_file;')${(systemglobal.CDN_Hide_On_Skip) ? ", hidden = 1" : ""} WHERE id = ?`, message.id);
                                        } else if (skipped[message.id] > 4) {
                                            await db.query(`UPDATE kanmi_records SET flagged = 1, tags = CONCAT(tags, '3/1/dead_file;')${(systemglobal.CDN_Hide_On_Skip) ? ", hidden = 1" : ""} WHERE id = ?`, message.id);
                                            await db.query(`INSERT INTO kanmi_cdn_skipped SET id = ?`, message.id);
                                        }
                                    }
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
                                        Logger.printLine("Cache", `Download ${message.id}`, "info")
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
                let total = backupItems.rows.length;
                let ticks = 0;
                let batchSize = 25; // Number of items to process in each batch

                // Function to process a batch of items
                async function processBatch(batch) {
                    return Promise.all(
                        batch.map(m => {
                            return new Promise(async (resolve) => {
                                await backupMessage(m, (ok) => {
                                    ticks++;
                                    if (ticks >= 100 || backupItems.rows.length <= 100) {
                                        ticks = 0;
                                    }
                                    resolve(ok);
                                }, false, allow_master);
                            });
                        })
                    );
                }

                // Divide the items into batches and process them sequentially
                for (let i = 0; i < backupItems.rows.length; i += batchSize) {
                    let batch = backupItems.rows.slice(i, i + batchSize);
                    await processBatch(batch);
                }

                // After processing all batches
                if (total > 0) {
                    Logger.printLine("Download", `Completed Download #${runCount} with ${total} files`, "info");
                } else {
                    Logger.printLine("Download", `Nothing to Download #${runCount}`, "info");
                }
                completed();
            } else {
                Logger.printLine("Download", `Nothing to Download #${runCount}`, "info");
                completed();
            }
        });
    }
    async function handleMigratableItems(backupItems) {
        return new Promise(async completed => {
            runCount++;
            if (backupItems.rows.length > 0) {
                let total = backupItems.rows.length;
                let ticks = 0;
                let batchSize = 3; // Number of items to process in each batch

                // Function to process a batch of items
                async function processBatch(batch) {
                    return Promise.all(
                        batch.map(m => {
                            return new Promise(async (resolve) => {
                                await moveMessage(m, {
                                    eid: m.eid,
                                    id: m.id,
                                    channel: m.channel,
                                    server: m.server
                                },(ok) => {
                                    ticks++;
                                    if (ticks >= 100 || backupItems.rows.length <= 100) {
                                        ticks = 0;
                                    }
                                    resolve(ok);
                                }, false);
                            });
                        })
                    );
                }

                // Divide the items into batches and process them sequentially
                for (let i = 0; i < backupItems.rows.length; i += batchSize) {
                    let batch = backupItems.rows.slice(i, i + batchSize);
                    await processBatch(batch);
                }

                // After processing all batches
                if (total > 0) {
                    Logger.printLine("Migrate", `Completed Migration #${runCount} with ${total} files`, "info");
                } else {
                    Logger.printLine("Migrate", `Nothing to migrate #${runCount}`, "info");
                }
                completed();
            } else {
                Logger.printLine("Migrate", `Nothing to migrate #${runCount}`, "info");
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
        Logger.printLine("Clean", `Starting cleaning of deleted messages....`, "info");
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
                        }
                    }
                    if (deleteItem.ext_0_hint) {
                        try {
                            fs.unlinkSync(path.join(systemglobal.CDN_Base_Path, 'extended_preview', deleteItem.path_hint, deleteItem.ext_0_hint));
                            Logger.printLine("CDN Cleaner", `Delete extended preview copy: ${deleteItem.eid}`, "info");
                        } catch (e) {
                            Logger.printLine("CDN Cleaner", `Failed to delete extended preview copy: ${deleteItem.eid}`, "err", e.message);
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

                        let deleteReq = splitArray(eids, 300).reduce((promiseChain, batch, i, a) => {
                            return promiseChain.then(() => new Promise(async (resolve) => {
                                await db.query(`DELETE FROM kanmi_records_cdn WHERE eid IN (${batch.join(', ')}) AND host = ?`, [systemglobal.CDN_ID]);
                                Logger.printLine("Clean", `Deleted [${batch.join(', ')}]`, "info");
                                resolve();
                            }))
                        }, Promise.resolve());
                        deleteReq.then(async () => {
                            Logger.printLine("Clean", `Cleanup Complete`, "info");
                        });
                    } else {
                        await db.query(`DELETE FROM kanmi_records_cdn WHERE eid IN (${eids.join(', ')}) AND host = ?`, [systemglobal.CDN_ID]);
                        Logger.printLine("Clean", `Cleanup Complete, Deleted [${eids.join(', ')}]`, "info");
                    }
                } else {
                    Logger.printLine("Clean", `Cleanup Complete, Nothing to do`, "info");
                }
            })
        }
    }
    async function repairMissingFiles() {
        pause = true;
        amqpConn.close();
        await sleep(2000);
        Logger.printLine("CDN Verification", `Starting Deep Filesystem Verification... [ !!!! CDN DOWNLOADS PAUSED !!!! ]`, "warning");

        const validFile = (filePath) => {
            try {
                if (!fs.existsSync(filePath))
                    return false;
                return (fs.statSync(filePath)).size > 128;
            } catch (e) {
                Logger.printLine("CDN Verification", `${filePath}: Failed to read file data!`, "err", e.message);
                return false;
            }
        };
        const q = `SELECT eid, path_hint, mfull_hint, full_hint, preview_hint, ext_0_hint FROM kanmi_records_cdn WHERE host = ? ORDER BY eid DESC`;
        const removedItems = await db.query(q, [systemglobal.CDN_ID])
        if (removedItems.rows.length > 0) {
            let eids = [];
            let requests = removedItems.rows.reduce((promiseChain, r, i, a) => {
                return promiseChain.then(() => new Promise(async (resolve) => {
                    const mfull = (!r.mfull_hint || (r.mfull_hint && validFile(path.join(systemglobal.CDN_Base_Path, 'master', r.path_hint, r.mfull_hint))));
                    const full = (!r.full_hint || (r.full_hint && validFile(path.join(systemglobal.CDN_Base_Path, 'full', r.path_hint, r.full_hint))));
                    const preview = (!r.preview_hint || (r.preview_hint && validFile(path.join(systemglobal.CDN_Base_Path, 'preview', r.path_hint, r.preview_hint))));
                    const extended_preview = (!r.ext_0_hint || (r.ext_0_hint && validFile(path.join(systemglobal.CDN_Base_Path, 'extended_preview', r.path_hint, r.ext_0_hint))));

                    if (!mfull || !full || !preview || !extended_preview) {
                        Logger.printLine("CDN Verification", `${r.path_hint}/${r.eid}: (${i + 1}/${a.length}) Missing filesystem data, Removing record! [M:${mfull} F:${full} P:${preview} EP:${extended_preview}]`, "err");
                        eids.push(r.eid)
                    }
                    if (i % 1000 === 0 && i !== 0) {
                        Logger.printLine("CDN Verification", `Validating Filesystem ${(((i + 1) / a.length) * 100).toFixed(4)}% .... ${eids.length} Invalid Files (${i + 1}/${a.length})`, "info");
                    }
                    if (i % 300 === 0 && i !== 0) {
                        if (eids.length >= 300) {
                            await db.query(`DELETE
                                            FROM kanmi_records_cdn
                                            WHERE eid IN (${eids.join(', ')})
                                              AND host = ?`, [systemglobal.CDN_ID]);
                            Logger.printLine("Clean", `Deleted [${eids.join(', ')}]`, "info");
                            eids = [];
                        }
                    }
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

                        let deleteReq = splitArray(eids, 300).reduce((promiseChain, batch, i, a) => {
                            return promiseChain.then(() => new Promise(async (resolve) => {
                                await db.query(`DELETE FROM kanmi_records_cdn WHERE eid IN (${batch.join(', ')}) AND host = ?`, [systemglobal.CDN_ID]);
                                Logger.printLine("Clean", `Deleted [${batch.join(', ')}]`, "info");
                                resolve();
                            }))
                        }, Promise.resolve());
                        deleteReq.then(async () => {
                            Logger.printLine("Clean", `Cleanup Complete`, "info");
                            pause = false;
                            start();
                        });
                    } else {
                        await db.query(`DELETE FROM kanmi_records_cdn WHERE eid IN (${eids.join(', ')}) AND host = ?`, [systemglobal.CDN_ID]);
                        Logger.printLine("Clean", `Cleanup Complete, Delete [${eids.join(', ')}]`, "info");
                        pause = false;
                        start();
                    }
                } else {
                    Logger.printLine("Clean", `Cleanup Complete, Nothing to do`, "info");
                    pause = false;
                    start();
                }
            })
        } else {
            pause = false;
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
                await db.query(`UPDATE kanmi_records_cdn c INNER JOIN kanmi_records r ON c.eid = r.eid SET id_hint = r.id WHERE id_hint IS NULL`);
                Logger.printLine("Init", "Waiting 30sec before normal tasks..", "warn");
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
                    Logger.printLine("Init", "First run completed", "info");
                    activeParseing = false;
                    setInterval(async () => {
                        if (activeParseing || pause) {
                            Logger.printLine("TaskManager", "System Busy, Ignored Request", "warn");
                        } else {
                            await findUserData();
                            await findBackupItems();
                            await findShowData();
                            await findEpisodeItems();
                        }
                        activeParseing = false;
                    }, (systemglobal.CDN_Interval_Min) ? systemglobal.CDN_Interval_Min * 60000 : 3600000);
                    discordClient.editStatus( "online", null);
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

    async function downloadImage(inputUrl) {
        return new Promise(async cb => {
            const url = await getDiscordURL(inputUrl);
            request.get({
                url,
                headers: {
                    'accept': 'image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
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
                    Logger.printLine("ReqGenerator", `Error During Download`, "error", err || res.body.toString());
                    cb(false)
                } else {
                    cb(body);
                }
            })
        })
    }
    async function generateADSImage(imageBuffer, width, height, opts) {
        // Create a canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Fill the background with gray color
        ctx.fillStyle = '#808080'; // Gray color
        ctx.fillRect(0, 0, width, height);

        const image = await loadImage(imageBuffer);
        const imgRatio = image.width / image.height;
        const canvasRatio = width / height;

        let targetWidth, targetHeight, backgroundWidth, backgroundHeight;

        if (imgRatio >= canvasRatio) {
            // Image is wider than canvas
            targetWidth = width;
            targetHeight = width / imgRatio;

            backgroundHeight = height;
            backgroundWidth = (image.width * (height / image.height)).toFixed(0);
        } else {
            // Image is taller than canvas
            targetHeight = height;
            targetWidth = height * imgRatio;

            backgroundHeight = (image.height * (width / image.width)).toFixed(0);
            backgroundWidth = width;
        }

        // Center the image on the canvas
        const offsetX = (width - targetWidth) / 2;
        const offsetY = (height - targetHeight) / 2;
        const offsetBgX = (width - backgroundWidth) / 2;
        const offsetBgY = (height - backgroundHeight) / 2;

        // Blur the image using sharp
        const blurredBackgroundBuffer = await sharp(imageBuffer)
            .resize({ backgroundWidth, backgroundHeight }) // Resize to cover the canvas dimensions
            .blur(25)
            .modulate({
                brightness: (opts.dark) ? 0.8 : 1.2,
                saturate: 2
            })
            .normalise((opts.dark) ? { lower: 30, upper: 100 } : 0.6)
            .toBuffer();

        // Load the blurred image into the canvas
        const blurredImage = await loadImage(blurredBackgroundBuffer);

        ctx.drawImage(blurredImage, offsetBgX, offsetBgY, backgroundWidth, backgroundHeight);

        // Apply shadow to the image
        ctx.shadowColor = '#00000050';
        ctx.shadowBlur = 25;
        ctx.drawImage(image, offsetX, offsetY, targetWidth, targetHeight);

        // Return the canvas as a PNG buffer
        return canvas.toBuffer('image/png');
    }
    async function calculateImage(imageBuffer, width, height, opts) {
        const image = await loadImage(imageBuffer);
        const imgRatio = image.width / image.height;
        const canvasRatio = width / height;

        Logger.printLine("ImageGenerator", `Canvas@${canvasRatio.toFixed(2)} Image@${imgRatio.toFixed(2)} with result of ${(canvasRatio - imgRatio).toFixed(4)}: ${((canvasRatio - imgRatio) > 0.5 || (canvasRatio - imgRatio) < -0.5) ? "Generate" : "Direct"} Results`, "info");

        if ((canvasRatio - imgRatio) > 0.5 || (canvasRatio - imgRatio) < -0.5) {
            return generateADSImage(imageBuffer, width, height, opts);
        } else {
            return await sharp(imageBuffer)
                .png()
                .toBuffer();
        }
    }

    app.get('/ads-gen/local/:server/:channel/:file', async (req, res) => {
        const { width, height } = req.query;
        try {
            Logger.printLine("ReqGenerator", `${path.join(systemglobal.CDN_Base_Path, req.params.server,req.params.channel,req.params.file)} : ${width}x${height} ${(req.query && req.query.dark === 'true') ? "(Dark)" : ""}`, "info");
            if (!width || !height)
                return res.status(400).send("Missing height or width parameter");
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].indexOf(req.params.file.split('.').pop().toLowerCase()) === -1)
                return res.status(400).send("Unsupported File Format");
            let buffer;
            if (fs.existsSync(path.join(systemglobal.CDN_Base_Path, 'master', req.params.server,req.params.channel,req.params.file))) {
                buffer = fs.readFileSync(path.join(systemglobal.CDN_Base_Path, 'master', req.params.server,req.params.channel,req.params.file));
            } else if (fs.existsSync(path.join(systemglobal.CDN_Base_Path, 'full', req.params.server,req.params.channel,req.params.file))) {
                buffer = fs.readFileSync(path.join(systemglobal.CDN_Base_Path, 'full', req.params.server,req.params.channel,req.params.file));
            } else {
                return res.status(404).end();
            }
            const imageBuffer = await calculateImage(buffer, parseInt(width), parseInt(height), {
                dark: (req.query && req.query.dark && (req.query.dark.toLowerCase() === 'true' || req.query.dark.toLowerCase() === 'yes'))
            });
            res.setHeader('Content-Type', 'image/png');
            res.send(imageBuffer);
        } catch (error) {
            Logger.printLine("ReqGenerator", `Error During Generation: ${error.message}`, "error");
            res.status(500).send('Error generating image');
        }
    });
    app.get('/ads-gen/discord/:channel/:hash/:file', async (req, res) => {
        const { width, height } = req.query;
        try {
            Logger.printLine("ReqGenerator", `https://media.discordapp.net/attachments/${req.params.channel}/${req.params.hash}/${req.params.file} : ${width}x${height} ${(req.query && req.query.dark === 'true') ? "(Dark)" : ""}`, "info");
            if (!width || !height)
                return res.status(400).send("Missing height or width parameter");
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].indexOf(req.params.file.split('.').pop().toLowerCase()) === -1)
                return res.status(400).send("Unsupported File Format");
            const discordAuth = Object.entries(req.query).filter(e => e[0] !== 'width' && e[0] !== 'height').map(e => e[0] + '=' + e[1]).join('&');
            let downloadURL = `https://cdn.discordapp.com/attachments/${req.params.channel}/${req.params.hash}/${req.params.file}?${discordAuth}`
            let buffer = await downloadImage(downloadURL);
            if (!buffer)
                return res.status(501).end();
            const imageBuffer = await calculateImage(buffer, parseInt(width), parseInt(height), {
                dark: (req.query && req.query.dark && (req.query.dark.toLowerCase() === 'true' || req.query.dark.toLowerCase() === 'yes'))
            });
            res.setHeader('Content-Type', 'image/png');
            res.send(imageBuffer);
        } catch (error) {
            Logger.printLine("ReqGenerator", `Error During Generation: ${error.message}`, "error");
            res.status(500).send('Error generating image');
        }
    });

    app.listen(9933, () => {
        Logger.printLine("ImageGenerator", `ADS Image Generator Running on 9933`, "info");
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
        await findItemsToMigrate();
        await clearDeadFiles();
        reply({ answer : 'started' });
    });
    tx2.action('scan', async (reply) => {
        if (activeParseing || pause) {
            reply({ answer : 'System Busy' });
        } else {
            reply({ answer : 'Task Started' });
            await findBackupItems();
        }
        activeParseing = false;
    });
    tx2.action('dupfiles', async (reply) => {
        const files = Object.keys(pastFiles).filter(e => pastFiles[e] > 1);
        if (files.length > 0) {
            reply({ answer : files });
        } else {
            reply({ answer : 'No Files' });
            await findBackupItems();
        }
    });
    tx2.action('verify', async (reply) => {
        reply({ answer : 'Started' });
        pause = true;
        amqpConn.close();
        await sleep(5000);
        Logger.printLine("Clean", `Starting Verification by request [ !!!! CDN DOWNLOADS PAUSED !!!! ]`, "warning");
        await findItemsToMigrate();
        await clearDeadFiles();
        repairMissingFiles();
    });

    discordClient.connect().catch((er) => { Logger.printLine("Discord", "Failed to connect to Discord", "emergency", er) });
})()
