/*    ___                  __                        _______ __
     /   | _________ _____/ /__  ____ ___  __  __   / ____(_) /___  __
    / /| |/ ___/ __ `/ __  / _ \/ __ `__ \/ / / /  / /   / / __/ / / /
   / ___ / /__/ /_/ / /_/ /  __/ / / / / / /_/ /  / /___/ / /_/ /_/ /
  /_/  |_\___/\__,_/\__,_/\___/_/ /_/ /_/\__, /   \____/_/\__/\__, /
                                        /____/               /____/
Developed at Academy City Research
"Developing a better automated future"
======================================================================================
Kanmi Project - Discord I/O System
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
    const facilityName = 'Backup-IO';

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

    const backupSystemName = `${systemglobal.SystemName}${(systemglobal.BackupID) ? '-' + systemglobal.BackupID : ''}`

    let runCount = 0;
    Logger.printLine("Init", "Backup I/O", "info");

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'backup' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.BackupID])
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
            const _backup_config = systemparams_sql.filter(e => e.param_key === 'backup');
            if (_backup_config.length > 0 && _backup_config[0].param_data) {
                if (_backup_config[0].param_data.backup_parts)
                    systemglobal.Backup_Parts_Disabled = !(_backup_config[0].param_data.backup_parts);
                if (_backup_config[0].param_data.interval_min)
                    systemglobal.Backup_Interval_Min = _backup_config[0].param_data.interval_min;
                if (_backup_config[0].param_data.items_per_backup)
                    systemglobal.Backup_N_Per_Interval = _backup_config[0].param_data.items_per_backup;
                if (_backup_config[0].param_data.cache_base_path)
                    systemglobal.Cache_Base_Path = _backup_config[0].param_data.cache_base_path;
                if (_backup_config[0].param_data.pickup_base_path)
                    systemglobal.Pickup_Base_Path = _backup_config[0].param_data.pickup_base_path;
                if (_backup_config[0].param_data.backup_base_path)
                    systemglobal.Backup_Base_Path = _backup_config[0].param_data.backup_base_path;
            }
            // {"backup_parts": true, "interval_min": 5, "backup_base_path": "/mnt/backup/", "pickup_base_path": "/mnt/data/kanmi-files/", "items_per_backup" : 2500}
            const _backup_ignore = systemparams_sql.filter(e => e.param_key === 'backup.ignore');
            if (_backup_ignore.length > 0 && _backup_ignore[0].param_data) {
                if (_backup_ignore[0].param_data.channels)
                    systemglobal.Backup_Ignore_Channels = _backup_ignore[0].param_data.channels;
                if (_backup_ignore[0].param_data.servers)
                    systemglobal.Backup_Ignore_Servers = _backup_ignore[0].param_data.servers;
            }
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
    const trashBin = path.join(systemglobal.Backup_Base_Path, 'trash')

    try {
        if (!fs.existsSync(systemglobal.TempFolder))
            fs.mkdirSync(systemglobal.TempFolder)
        if (!fs.existsSync(systemglobal.Backup_Base_Path))
            fs.mkdirSync(systemglobal.Backup_Base_Path)
        if (!fs.existsSync(path.join(systemglobal.Backup_Base_Path, 'trash')))
            fs.mkdirSync(path.join(systemglobal.Backup_Base_Path, 'trash'));
    } catch (e) {
        console.error('Failed to create the temp folder, not a issue if your using docker');
        console.error(e);
    }
    async function backupMessage (message, cb) {
        let destName = `${message.eid}`
        if (message.real_filename) {
            destName += '-' + message.real_filename.replace(message.id, '')
        } else if (message.attachment_name) {
            destName += '-' + message.attachment_name.replace(message.id, '')
        } else if (message.attachment_hash) {
            destName += '-' + message.attachment_hash.split('/').pop()
        }
        
        async function backupCompleted() {
            const saveBackupSQL = await db.query(`REPLACE INTO kanmi_backups SET system_name = ?, bid = ?, eid = ?`, [backupSystemName, `${backupSystemName}-${message.eid}`, message.eid])
            if (saveBackupSQL.error) {
                Logger.printLine("SQL", `${backupSystemName}: Failed to mark ${message.id} as backup complete`, "err", saveBackupSQL.error)
                cb(false)
            } else {
                Logger.printLine("BackupFile", `Completed Backup of ${destName}`, "info")
                cb(true)
            }
        }

        if (message.fileid && !systemglobal.Backup_Parts_Disabled) {
            await backupParts(message, destName, ok => { cb(ok) })
        }
        if (message.attachment_extra !== null) {
            cb(false)
        } else if (message.filecached === 1 && systemglobal.Pickup_Base_Path && fs.existsSync(path.join(systemglobal.Pickup_Base_Path, `.${message.fileid}`))) {
            const destPath = path.join(systemglobal.Backup_Base_Path, message.server, message.channel, 'files');
            const filePath = path.join(systemglobal.Pickup_Base_Path, `.${message.fileid}`);

            fsEx.ensureDirSync(destPath);
            Logger.printLine("BackupFile", `Copy Local File for Backup of ${message.id} ${destName}`, "debug")
            try {
                await fs.copyFileSync(filePath, path.join(destPath, destName));
                await backupCompleted(path.join(destPath, destName).toString());
            } catch (err) {
                Logger.printLine("CopyFile", `Failed to copy backup ${message.id} in ${message.channel}`, "err", err)
                if (err.code === "ENOENT") {
                    try {
                        await db.query(`UPDATE kanmi_records SET filecached = 0 WHERE eid = ?`, [message.eid]);
                    } catch (err) {
                        Logger.printLine("BackupFile", `Failed to clear cache url for ${destName}`, "error");
                    }
                }
                cb(false)
            }
        } else if (message.attachment_hash) {
            const destPath = path.join(systemglobal.Backup_Base_Path, message.server, message.channel, 'files')

            Logger.printLine("BackupFile", `Downloading ${message.id} ${destName}...`, "debug")
            await request.get({
                url: `https://cdn.discordapp.com/attachments/` + ((message.attachment_hash.includes('/')) ? message.attachment_hash : `${message.channel}/${message.attachment_hash}/${message.attachment_name}`),
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
                        Logger.printLine("DownloadFile", `Failed to backup attachment "${message.attachment_hash}" - Requires revalidation!`, "err", (err) ? err : undefined)
                        mqClient.sendData(systemglobal.Discord_Out, {
                            fromClient: `return.Backup.${systemglobal.SystemName}`,
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
                        Logger.printLine("DownloadFile", `Failed to backup attachment "${message.attachment_hash}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                    }
                    cb(false)
                } else {
                    fsEx.ensureDirSync(destPath);
                    await fs.writeFile(path.join(destPath, destName), body, async (err) => {
                        body = null;

                        if (err) {
                            Logger.printLine("CopyFile", `Failed to write backup ${message.id} in ${message.channel}`, "err", err)
                            cb(false)
                        } else {
                            await backupCompleted(path.join(destPath, destName).toString())
                        }
                    })
                }
            })
        } else {
            Logger.printLine("BackupParts", `Can't backup item ${message.id}, No URLs Available`, "error")
            if (message.filecached === 1 && systemglobal.Pickup_Base_Path)
                await db.query(`UPDATE kanmi_records SET filecached = 0 WHERE eid = ?`, [message.eid])
            cb(false)
        }
    }
    async function backupParts (message, destName, cb) {
        const backupPartsNeeded = await db.query(`SELECT x.* FROM (SELECT * FROM discord_multipart_files WHERE fileid = ? AND valid = 1) x LEFT OUTER JOIN (SELECT * FROM discord_multipart_backups WHERE system_name = ?) y ON (x.messageid = y.messageid) WHERE y.bid IS NULL`, [message.fileid, backupSystemName])
        if (backupPartsNeeded.error) {
            Logger.printLine("SQL", `Error getting items to backup from discord!`, "crit", backupPartsNeeded.error)
            cb(false)
        } else if (backupPartsNeeded.rows.length > 0) {
            const pTotal = backupPartsNeeded.rows.length
            let pCount = 0;
            Logger.printLine("BackupParts", `Backing up ${message.fileid}, ${pTotal} parts...`, "debug")
            let requests = backupPartsNeeded.rows.reduce((promiseChain, part, i, a) => {
                return promiseChain.then(() => new Promise(async(resolve) => {
                    Logger.printLine("BackupParts", `Downloading ${part.messageid}...`, "debug")
                    await limiter2.removeTokens(1, async () => {
                        await request.get({
                            url: part.url,
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
                                Logger.printLine("DownloadFile", `Failed to backup message part "${part.url}" - Status: ${(res && res.statusCode) ? res.statusCode : 'Unknown'}`, "err", (err) ? err : undefined)
                                if (res && res.statusCode && res.statusCode === 403) {
                                    await db.query(`UPDATE discord_multipart_files SET valid = 0 WHERE messageid = ?`, [part.messageid])
                                }
                                resolve()
                            } else {
                                const partName = part.url.split('/').pop();
                                const destPath = path.join(systemglobal.Backup_Base_Path, message.server, message.channel, 'parts', message.fileid)

                                try {
                                    await fsEx.ensureDirSync(destPath);
                                    await fs.writeFileSync(path.join(destPath, partName), body)
                                    const saveBackupPartSQL = await db.query(`INSERT INTO discord_multipart_backups SET system_name = ?, bid = ?, messageid = ? ON DUPLICATE KEY UPDATE messageid = ?`, [backupSystemName, `${backupSystemName}-${part.messageid}`, part.messageid, part.messageid])
                                    if (saveBackupPartSQL.error) {
                                        Logger.printLine("SQL", `Failed to mark ${message.id} as backup complete`, "err", saveBackupPartSQL.error)
                                        resolve()
                                        part = null;
                                    } else {
                                        pCount++
                                        Logger.printLine("BackupParts", `Completed Backup of part ${partName} (${i + 1}/${a.length})`, "info")
                                        resolve()
                                        part = null
                                    }
                                } catch (err) {
                                    Logger.printLine("CopyFile", `Failed to backup ${message.fileid} file part in ${message.channel}`, "err",  err)
                                    resolve()
                                    part = null
                                }
                            }
                        })
                    })
                }))
            }, Promise.resolve());
            requests.then(() => {
                cb(true)
            })
        } else {
            cb(true)
        }
    }

    async function findBackupItems() {
        runCount++
        let ignoreQuery = [];
        if (systemglobal.Backup_Ignore_Channels && systemglobal.Backup_Ignore_Channels.length > 0)
            ignoreQuery.push(...systemglobal.Backup_Ignore_Channels.map(e => `channel != '${e}'`))
        if (systemglobal.Backup_Ignore_Servers && systemglobal.Backup_Ignore_Servers.length > 0)
            ignoreQuery.push(...systemglobal.Backup_Ignore_Servers.map(e => `server != '${e}'`))

        const backupItems = await db.query(`SELECT x.*, y.bid FROM (SELECT * FROM kanmi_records WHERE source = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL)${(systemglobal.Pickup_Base_Path || systemglobal.Cache_Base_Path) ? ' OR (filecached IS NOT NULL AND filecached != 0 AND attachment_extra IS NULL)' : ''})${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) x LEFT OUTER JOIN (SELECT * FROM kanmi_backups WHERE system_name = ?) y ON (x.eid = y.eid) WHERE y.bid IS NULL ORDER BY RAND() LIMIT ?`, [backupSystemName, (systemglobal.Backup_N_Per_Interval) ? systemglobal.Backup_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to backup from discord!`, "crit", backupItems.error)
        } else if (backupItems.rows.length > 0) {
            let total = backupItems.rows.length
            let ticks = 0
            mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
                messageReturn: false,
                messageChannelID: '0',
                messageChannelName: `syncstat_${backupSystemName}`,
                messageType: 'status',
                messageData: {
                    hostname: backupSystemName,
                    systemname: systemglobal.SystemName,
                    total: total,
                    left: 0,
                    percent: 0,
                    runCount,
                    statusText: `💾🔄 0%`,
                    active: true,
                    proccess: 'files',
                    timestamp: Date.now().valueOf()
                },
                updateIndicators: true
            }, (ok) => {
                if (!ok) { console.error('Failed to send update to MQ') }
            })
            let requests = backupItems.rows.reduce((promiseChain, m, i, a) => {
                return promiseChain.then(() => new Promise(async(resolve) => {
                    await backupMessage(m, async ok => {
                        ticks++
                        if (ticks >= 100 || a.length <= 100) {
                            ticks = 0
                            mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                                fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
                                messageReturn: false,
                                messageChannelID: '0',
                                messageChannelName: `syncstat_${backupSystemName}`,
                                messageType: 'status',
                                messageData: {
                                    hostname: backupSystemName,
                                    systemname: systemglobal.SystemName,
                                    total: total,
                                    left: (total - (i + 1)),
                                    percent: (((i + 1) / a.length) * 100).toFixed(0),
                                    runCount,
                                    statusText: `💾🔄 ${(((i + 1) / a.length) * 100).toFixed(0)}%`,
                                    active: true,
                                    proccess: 'files',
                                    timestamp: Date.now().valueOf()
                                },
                                updateIndicators: true
                            }, (ok) => {
                                if (!ok) { console.error('Failed to send update to MQ') }
                            })
                        }
                        resolve(ok)
                        m = null
                    })
                }))
            }, Promise.resolve());
            requests.then(async () => {
                if (!systemglobal.Backup_Parts_Disabled) {
                    await findBackupParts()
                }
                mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                    fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                    messageReturn: false,
                    messageChannelID: '0',
                    messageChannelName: `syncstat_${backupSystemName}`,
                    messageType: 'status',
                    messageData: {
                        hostname: backupSystemName,
                        systemname: systemglobal.SystemName,
                        total: total,
                        runCount,
                        statusText: `✅ Complete`,
                        active: false,
                        timestamp: Date.now().valueOf()
                    },
                    updateIndicators: true
                }, (ok) => {
                    if (!ok) {
                        console.error('Failed to send update to MQ')
                    }
                })
                if (total > 0) {
                    Logger.printLine("Backup", `Completed Backup #${runCount} with ${total} files`, "info");
                }
                setTimeout(findBackupItems,(systemglobal.Backup_Interval_Min) ? systemglobal.Backup_Interval_Min * 60000 : 3600000);
            })
        } else {
            if (!systemglobal.Backup_Parts_Disabled) {
                await findBackupParts()
            } else {
                mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                    fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                    messageReturn: false,
                    messageChannelID: '0',
                    messageChannelName: `syncstat_${backupSystemName}`,
                    messageType: 'status',
                    messageData: {
                        hostname: backupSystemName,
                        systemname: systemglobal.SystemName,
                        runCount,
                        statusText: `✅ Complete`,
                        active: false,
                        timestamp: Date.now().valueOf()
                    },
                    updateIndicators: true
                }, (ok) => {
                    if (!ok) {
                        console.error('Failed to send update to MQ')
                    }
                })
            }
            setTimeout(findBackupItems,(systemglobal.Backup_Interval_Min) ? systemglobal.Backup_Interval_Min * 60000 : 3600000);
        }
    }
    async function findNonExistentBackupItems() {
        const backupItems = await db.query(`SELECT x.eid, x.server, x.channel, x.id, x.real_filename, x.attachment_hash, x.fileid, x.attachment_name,y.bid FROM (SELECT * FROM kanmi_records WHERE source = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL))) x LEFT JOIN (SELECT * FROM kanmi_backups WHERE system_name = ?) y ON (x.eid = y.eid) WHERE y.bid IS NOT NULL ORDER BY x.eid DESC`, [backupSystemName])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to backup from discord!`, "crit", backupItems.error)
        } else if (backupItems.rows.length > 0) {
            mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                messageReturn: false,
                messageChannelID: '0',
                messageChannelName: `syncstat_${backupSystemName}`,
                messageType: 'status',
                messageData: {
                    hostname: backupSystemName,
                    systemname: systemglobal.SystemName,
                    runCount,
                    statusText: `⏳ Recycling Inprogress`,
                    active: false,
                    cleanup: true,
                    timestamp: Date.now().valueOf()
                },
                updateIndicators: true
            }, (ok) => {
                if (!ok) {
                    console.error('Failed to send update to MQ')
                }
            })
            const fileNames = backupItems.rows.map(e => {
                let destName = `${e.eid}`
                if (e.real_filename) {
                    destName += '-' + e.real_filename.replace(e.id, '')
                } else if (e.attachment_name) {
                    destName += '-' + e.attachment_name.replace(e.id, '')
                } else if (e.attachment_hash) {
                    destName += '-' + e.attachment_hash.split('/').pop()
                }

                return {
                    server: e.server,
                    channel: e.channel,
                    name: destName,
                    eid: e.eid,
                    fileid: e.fileid
                }
            })
            const servers = [...new Set(fileNames.map(e => e.server))]
            const serversFs = fs.readdirSync(systemglobal.Backup_Base_Path).filter(e => !isNaN(parseInt(e)))

            for (let delServer of serversFs.filter(e => servers.indexOf(e.toString()) === -1)) {
                Logger.printLine("Cleanup", `Server ${delServer} was not found to be in use, Moved to Recycling Bin`, "warn")
                fsEx.ensureDirSync(path.join(trashBin));
                fsEx.moveSync(path.join(systemglobal.Backup_Base_Path, delServer), path.join(trashBin, delServer), { overwrite: true })
            }
            Logger.printLine("Cleanup", `Server cleanup completed`, "info")

            for (let server of fs.readdirSync(systemglobal.Backup_Base_Path).filter(e => !isNaN(parseInt(e)))) {
                const channels = [...new Set(fileNames.filter(e => e.server === server).map(e => e.channel))]
                const channelsFs = fs.readdirSync(path.join(systemglobal.Backup_Base_Path, server)).filter(e => !isNaN(parseInt(e)))

                for (let delChannel of channelsFs.filter(e => channels.indexOf(e.toString()) === -1)) {
                    Logger.printLine("Cleanup", `Channel ${server}/${delChannel} was not found to be in use, Moved to Recycling Bin`, "warn")
                    fsEx.ensureDirSync(path.join(trashBin, server));
                    fsEx.moveSync(path.join(systemglobal.Backup_Base_Path, server, delChannel), path.join(trashBin, server, delChannel), { overwrite: true })
                }
                Logger.printLine("Cleanup", `Channels for ${server} cleanup completed`, "info")
                for (let channel of fs.readdirSync(path.join(systemglobal.Backup_Base_Path, server)).filter(e => !isNaN(parseInt(e)))) {
                    const files = [...new Set(fileNames.filter(e => e.server === server && e.channel === channel).map(e => e.eid.toString()))]
                    const parts = [...new Set(fileNames.filter(e => e.server === server && e.channel === channel && e.fileid !== null).map(e => e.fileid))]
                    const messagesFs = (fs.existsSync(path.join(systemglobal.Backup_Base_Path, server, channel, 'files'))) ? fs.readdirSync(path.join(systemglobal.Backup_Base_Path, server, channel, 'files')) : []
                    const partsFs = (fs.existsSync(path.join(systemglobal.Backup_Base_Path, server, channel, 'parts'))) ? fs.readdirSync(path.join(systemglobal.Backup_Base_Path, server, channel, 'parts')) : []

                    //console.log(files)
                    //console.log(messagesFs.filter(e => files.indexOf(e.toString().split('-')[0]) === -1))

                    for (let delMessage of messagesFs.filter(e => files.indexOf(e.toString().split('-')[0]) === -1)) {
                        Logger.printLine("Cleanup", `File ${server}/${channel}/${delMessage} was not found to be in use, Moved to Recycling Bin`, "warn")
                        fsEx.ensureDirSync(path.join(trashBin, server, channel, 'files'));
                        const eid = delMessage.split('-')[0]
                        fsEx.moveSync(path.join(systemglobal.Backup_Base_Path, server, channel, 'files', delMessage), path.join(trashBin, server, channel, 'files', delMessage), { overwrite: true })
                        await db.query(`DELETE FROM kanmi_backups WHERE system_name = ? AND eid = ?`, [backupSystemName, eid])
                    }
                    for (let delParts of partsFs.filter(e => parts.indexOf(e.toString()) === -1)) {
                        Logger.printLine("Cleanup", `File Parts ${server}/${channel}/${delParts} was not found to be in use, Moved to Recycling Bin`, "warn")
                        fsEx.ensureDirSync(path.join(trashBin, server, channel, 'parts'));
                        fsEx.moveSync(path.join(systemglobal.Backup_Base_Path, server, channel, 'parts', delParts).toString(), path.join(trashBin, server, channel, 'parts', delParts), { overwrite: true })
                    }
                }
                Logger.printLine("Cleanup", `Files for ${server} cleanup completed`, "info")
            }
            Logger.printLine("Cleanup", `Filesystem cleanup completed`, "info")
        }
        setTimeout(findNonExistentBackupItems,(systemglobal.Cleanup_Interval_Min) ? systemglobal.Cleanup_Interval_Min * 60000 : 86400000);
    }
    async function findBackupParts() {
        let ignoreQuery = [];
        if (systemglobal.Backup_Ignore_Channels && systemglobal.Backup_Ignore_Channels.length > 0)
            ignoreQuery.push(...systemglobal.Backup_Ignore_Channels.map(e => `channel != '${e}'`))
        if (systemglobal.Backup_Ignore_Servers && systemglobal.Backup_Ignore_Servers.length > 0)
            ignoreQuery.push(...systemglobal.Backup_Ignore_Servers.map(e => `server != '${e}'`))

        const backupItems = await db.query(`SELECT x.*, y.bid FROM (SELECT kanmi_records.*, discord_multipart_files.messageid AS partmessageid FROM discord_multipart_files, kanmi_records WHERE discord_multipart_files.fileid = kanmi_records.fileid AND kanmi_records.source = 0${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) x LEFT OUTER JOIN (SELECT * FROM discord_multipart_backups WHERE system_name = ?) y ON (x.partmessageid = y.messageid) WHERE y.bid IS NULL ORDER BY RAND() LIMIT ?`, [backupSystemName, (systemglobal.Backup_N_Per_Interval) ? systemglobal.Backup_N_Per_Interval : 2500])
        if (backupItems.error) {
            Logger.printLine("SQL", `Error getting items to backup from discord!`, "crit", backupItems.error)
        } else if (backupItems.rows.length > 0) {
            let total = backupItems.rows.length
            let ticks = 0
            mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
                messageReturn: false,
                messageChannelID: '0',
                messageChannelName: `syncstat_${backupSystemName}`,
                messageType: 'status',
                messageData: {
                    hostname: backupSystemName,
                    systemname: systemglobal.SystemName,
                    total: total,
                    left: 0,
                    percent: 0,
                    runCount,
                    statusText: `🧩🔄 0%`,
                    active: true,
                    proccess: 'parts',
                    timestamp: Date.now().valueOf()
                },
                updateIndicators: true
            }, (ok) => {
                if (!ok) { console.error('Failed to send update to MQ') }
            })
            let requests = backupItems.rows.reduce((promiseChain, m, i, a) => {
                return promiseChain.then(() => new Promise(async(resolve) => {
                    const destPath = path.join(systemglobal.Backup_Base_Path, m.server, m.channel, 'files')
                    await backupParts(m, destPath, async ok => {
                        ticks++
                        if (ticks >= 100 || a.length <= 100) {
                            ticks = 0
                            mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                                fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
                                messageReturn: false,
                                messageChannelID: '0',
                                messageChannelName: `syncstat_${backupSystemName}`,
                                messageType: 'status',
                                messageData: {
                                    hostname: backupSystemName,
                                    systemname: systemglobal.SystemName,
                                    total: total,
                                    left: (total - (i + 1)),
                                    percent: (((i + 1) / a.length) * 100).toFixed(0),
                                    runCount,
                                    statusText: `🧩🔄 ${(((i + 1) / a.length) * 100).toFixed(0)}%`,
                                    active: true,
                                    proccess: 'parts',
                                    timestamp: Date.now().valueOf()

                                },
                                updateIndicators: true
                            }, (ok) => {
                                if (!ok) { console.error('Failed to send update to MQ') }
                            })
                        }
                        resolve(ok)
                        m = null
                    })
                }))
            }, Promise.resolve());
            requests.then(() => {
                if (total > 0)
                    Logger.printLine("Backup", `Completed Backup #${runCount} with ${total} parts`, "info");
                mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                    fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                    messageReturn: false,
                    messageChannelID: '0',
                    messageChannelName: `syncstat_${backupSystemName}`,
                    messageType: 'status',
                    messageData: {
                        hostname: backupSystemName,
                        systemname: systemglobal.SystemName,
                        total: total,
                        runCount,
                        statusText: `✅ Complete`,
                        active: false,
                        timestamp: Date.now().valueOf()
                    },
                    updateIndicators: true
                }, (ok) => {
                    if (!ok) {
                        console.error('Failed to send update to MQ')
                    }
                })
            })
        } else {
            mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
                fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                messageReturn: false,
                messageChannelID: '0',
                messageChannelName: `syncstat_${backupSystemName}`,
                messageType: 'status',
                messageData: {
                    hostname: backupSystemName,
                    systemname: systemglobal.SystemName,
                    runCount,
                    statusText: `✅ Complete`,
                    active: false,
                    timestamp: Date.now().valueOf()
                },
                updateIndicators: true
            }, (ok) => {
                if (!ok) {
                    console.error('Failed to send update to MQ')
                }
            })
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
    if (systemglobal.Backup_Base_Path) {
        await findNonExistentBackupItems();
        await findBackupItems();
    } else {
        Logger.printLine("Init", "Unable to start backup client, no directory setup!", "error")
    }
})()
