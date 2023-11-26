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

const systemglobal = require("../config.json");
(async () => {
    let systemglobal = require('../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Download-IO';

    const path = require('path');
    const RateLimiter = require('limiter').RateLimiter;
    const limiter1 = new RateLimiter(1, 250);
    const limiter2 = new RateLimiter(1, 250);
    const request = require('request').defaults({ encoding: null });
    const { spawn, exec } = require("child_process");
    const fsEx = require("fs-extra");
    const fs = require("fs");
    const minimist = require("minimist");
    let args = minimist(process.argv.slice(2));

    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    let backupSystemName = `${systemglobal.SystemName}${(systemglobal.CDN_ID) ? '-' + systemglobal.CDN_ID : ''}`

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
    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    try {
        if (!fs.existsSync(systemglobal.TempFolder))
            fs.mkdirSync(systemglobal.TempFolder)
        if (!fs.existsSync(systemglobal.CDN_Base_Path))
            fs.mkdirSync(systemglobal.CDN_Base_Path)
    } catch (e) {
        console.error('Failed to create the temp folder, not a issue if your using docker');
        console.error(e);
    }
    async function backupMessage (message, cb) {
        let destName = `${message.eid}`
        if (message.attachment_name) {
            destName += '.' +  message.attachment_name.replace(message.id, '').split('?')[0].split('.').pop()
        }

        async function backupCompleted() {
            const saveBackupSQL = await db.query(`INSERT INTO kanmi_cdn SET eid = ?, host = ?`, [message.eid, systemglobal.CDN_ID])
            if (saveBackupSQL.error) {
                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as download to CDN`, "err", saveBackupSQL.error)
                cb(false)
            } else {
                Logger.printLine("BackupFile", `Completed Download of ${destName}`, "info")
                cb(true)
            }
        }

        if (message.attachment_extra !== null) {
            cb(false)
        } else if (message.attachment_hash) {
            const destPath = path.join(systemglobal.CDN_Base_Path, message.server, message.channel)

            Logger.printLine("BackupFile", `Downloading ${message.id} ${destName}...`, "debug")
            await request.get({
                url: `https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name.split('?')[0]}`),
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
                    if (res && res.statusCode && res.statusCode === 403) {
                        Logger.printLine("DownloadFile", `Failed to download attachment "${message.attachment_hash}" - Requires revalidation!`, "err", (err) ? err : undefined)
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
                        Logger.printLine("DownloadFile", `Failed to download attachment "${message.attachment_hash}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                    }
                    cb(false)
                } else {
                    fsEx.ensureDirSync(destPath);
                    await fs.writeFile(path.join(destPath, destName), body, async (err) => {
                        body = null;

                        if (err) {
                            Logger.printLine("CopyFile", `Failed to write download ${message.id} in ${message.channel}`, "err", err)
                            cb(false)
                        } else {
                            await backupCompleted(path.join(destPath, destName).toString())
                        }
                    })
                }
            })
        } else {
            Logger.printLine("BackupParts", `Can't download item ${message.id}, No URLs Available`, "error")
            cb(false)
        }
    }

    async function findBackupItems() {
        runCount++
        let ignoreQuery = [];
        if (systemglobal.CDN_Ignore_Channels && systemglobal.CDN_Ignore_Channels.length > 0)
            ignoreQuery.push(...systemglobal.CDN_Ignore_Channels.map(e => `channel != '${e}'`))
        if (systemglobal.CDN_Ignore_Servers && systemglobal.CDN_Ignore_Servers.length > 0)
            ignoreQuery.push(...systemglobal.CDN_Ignore_Servers.map(e => `server != '${e}'`))

        const backupItems = await db.query(`SELECT x.*, y.ecid FROM (SELECT * FROM kanmi_records WHERE source = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL)${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) x LEFT OUTER JOIN (SELECT * FROM kanmi_cdn WHERE host = ?) y ON (x.eid = y.eid) WHERE y.ecid IS NULL ORDER BY RAND() LIMIT ?`, [systemglobal.CDN_ID, (systemglobal.CDN_N_Per_Interval) ? systemglobal.CDN_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to download from discord!`, "crit", backupItems.error)
        } else if (backupItems.rows.length > 0) {
            let total = backupItems.rows.length
            let ticks = 0
            let requests = backupItems.rows.reduce((promiseChain, m, i, a) => {
                return promiseChain.then(() => new Promise(async(resolve) => {
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
                }
                setTimeout(findBackupItems,(systemglobal.CDN_Interval_Min) ? systemglobal.CDN_Interval_Min * 60000 : 3600000);
            })
        } else {
            setTimeout(findBackupItems,(systemglobal.CDN_Interval_Min) ? systemglobal.CDN_Interval_Min * 60000 : 3600000);
        }
    }

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
    if (systemglobal.CDN_Base_Path) {
        await findBackupItems();
    } else {
        Logger.printLine("Init", "Unable to start Download client, no directory setup!", "error")
    }
})()
