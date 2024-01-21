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
    const facilityName = 'Cache-Cleaer';

    const path = require('path');
    const fs = require("fs");
    const minimist = require("minimist");
    let args = minimist(process.argv.slice(2));

    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
        systemglobal.MQServer = process.env.MQ_HOST.trim()
    if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
        systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
    if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
        systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

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
                if (_backup_focus[0].param_data.master_channels)
                    systemglobal.CDN_Focus_Master_Channels = _backup_focus[0].param_data.master_channels;
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

    async function validateStorage() {
        return new Promise(async (completed) => {
            const channels = await db.query(`SELECT channelid, serverid FROM kanmi_channels WHERE source = 0`)
            let requests = channels.rows.reduce((promiseChain, c, i, a) => {
                return promiseChain.then(() => new Promise(async (resolveChannel) => {
                    const dir_previews = path.join(systemglobal.CDN_Base_Path, 'preview', c.serverid, c.channelid);
                    const dir_ext_previews = path.join(systemglobal.CDN_Base_Path, 'extended_preview', c.serverid, c.channelid);
                    const dir_full = path.join(systemglobal.CDN_Base_Path, 'full', c.serverid, c.channelid);
                    const dir_master = path.join(systemglobal.CDN_Base_Path, 'master', c.serverid, c.channelid);
                    let previews = (fs.existsSync(dir_previews)) ? fs.readdirSync(dir_previews) : [];
                    let ext_previews = (fs.existsSync(dir_ext_previews)) ? fs.readdirSync(dir_ext_previews) : [];
                    let full = (fs.existsSync(dir_full)) ? fs.readdirSync(dir_full) : [];
                    let master = (fs.existsSync(dir_master)) ? fs.readdirSync(dir_master) : [];

                    console.log(`${c.channelid} : Preview = ${previews.length} | Full = ${full.length} | Master = ${master.length}`)

                    if (full.length > 0 || master.length > 0 || previews.length > 0) {
                        let deleteID = new Map();
                        const messages = await db.query(`SELECT x.eid, y.*
                                                 FROM (SELECT eid, source, server, channel, attachment_name, fileid, attachment_hash, attachment_extra FROM kanmi_records WHERE source = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL)) AND channel = ?) x
                                                          LEFT JOIN (SELECT * FROM kanmi_records_cdn WHERE host = ?) y ON (x.eid = y.eid)`, [c.channelid, systemglobal.CDN_ID]);
                        if (messages.rows.length > 0) {
                            const preview_files = messages.rows.filter(e => !!e.preview_hint).map(e => e.preview_hint);
                            const master_files = messages.rows.filter(e => !!e.mfull_hint).map(e => e.mfull_hint);
                            const full_files = messages.rows.filter(e => !!e.full_hint).map(e => e.full_hint);
                            const ext_preview_files = messages.rows.filter(e => !!e.ext_0_hint).map(e => e.ext_0_hint);

                            if (messages.rows.length > 100000)
                                console.log(`Processing Orphaned Files - Preview`)
                            await new Promise(orphok => {
                                let removed = 0;
                                for (let i = 0; i < previews.length; i++) {
                                    if (preview_files.indexOf(previews[i]) === -1) {
                                        try {
                                            fs.unlinkSync(path.join(dir_previews, previews[i]))
                                            removed++;
                                        } catch (e) {

                                        }
                                    }
                                }
                                if (removed > 0) {
                                    Logger.printLine("Sweeper", `Removed ${removed} previews deleted items storage`, "info");
                                    previews = (fs.existsSync(dir_previews)) ? fs.readdirSync(dir_previews) : [];
                                }
                                orphok();
                            })
                            if (messages.rows.length > 100000)
                                console.log(`Processing Orphaned Files - Full`)
                            await new Promise(orphok => {
                                let removed = 0;
                                for (let i = 0; i < full.length; i++) {
                                    if (full_files.indexOf(full[i]) === -1) {
                                        try {
                                            fs.unlinkSync(path.join(dir_full, full[i]))
                                            removed++;
                                        } catch (e) {

                                        }
                                    }
                                }
                                if (removed > 0) {
                                    Logger.printLine("Sweeper", `Removed ${removed} full deleted items storage`, "info");
                                    full = (fs.existsSync(dir_full)) ? fs.readdirSync(dir_full) : [];
                                }
                                orphok();
                            })
                                console.log(`Processing Orphaned Files - Master`)
                            await new Promise(orphok => {
                                let removed = 0;
                                for (let i = 0; i < master.length; i++) {
                                    if (master_files.indexOf(master[i]) === -1) {
                                        try {
                                            fs.unlinkSync(path.join(dir_master, master[i]))
                                            removed++;
                                        } catch (e) {

                                        }
                                    }
                                }
                                if (removed > 0) {
                                    Logger.printLine("Sweeper", `Removed ${removed} master deleted items storage`, "info");
                                    master = (fs.existsSync(dir_master)) ? fs.readdirSync(dir_master) : [];
                                }
                                orphok();
                            })
                            if (messages.rows.length > 100000)
                                console.log(`Processing Orphaned Files - Ext Previews`)
                            await new Promise(orphok => {
                                let removed = 0;
                                for (let i = 0; i < ext_previews.length; i++) {
                                    if (ext_preview_files.indexOf(ext_previews[i]) === -1) {
                                        try {
                                            fs.unlinkSync(path.join(dir_ext_previews, ext_previews[i]))
                                            removed++;
                                        } catch (e) {

                                        }
                                    }
                                }
                                if (removed > 0) {
                                    Logger.printLine("Sweeper", `Removed ${removed} ext_previews deleted items storage`, "info");
                                    ext_previews = (fs.existsSync(dir_ext_previews)) ? fs.readdirSync(dir_ext_previews) : [];
                                }
                                orphok();
                            })

                            if (messages.rows.length > 100000)
                                console.log(`Processing Stored Files - Master`)
                            for (let i = 0; i < master_files.length; i++) {
                                if (master.indexOf(master_files[i]) === -1) {
                                    deleteID.set(master_files[i].eid, false)
                                }
                            }
                            if (messages.rows.length > 100000)
                                console.log(`Processing Stored Files - Full`)
                            for (let i = 0; i < full_files.length; i++) {
                                if (full.indexOf(full_files[i]) === -1) {
                                    deleteID.set(full_files[i].eid, false)
                                }
                            }
                            if (messages.rows.length > 100000)
                                console.log(`Processing Stored Files - Preview`)
                            for (let i = 0; i < preview_files.length; i++) {
                                if (previews.indexOf(preview_files[i]) === -1) {
                                    deleteID.set(preview_files[i].eid, false)
                                }
                            }
                            if (messages.rows.length > 100000)
                                console.log(`Processing Stored Files - Ext Previews`)
                            for (let i = 0; i < ext_preview_files.length; i++) {
                                if (ext_previews.indexOf(ext_preview_files[i]) === -1) {
                                    deleteID.set(ext_preview_files[i].eid, false)
                                }
                            }

                            if (deleteID.size > 0) {
                                const values = Array.from(deleteID.keys()).filter(e => !!e)
                                if (values.length > 100) {
                                    function splitArray(array, chunkSize) {
                                        const result = [];

                                        for (let i = 0; i < array.length; i += chunkSize) {
                                            result.push(array.slice(i, i + chunkSize));
                                        }

                                        return result;
                                    }

                                    (splitArray(values, 50)).map(async h => {
                                        await db.query(`DELETE
                                                        FROM kanmi_records_cdn
                                                        WHERE (${h.map(e => 'heid = ' + (parseInt(e.toString()) * parseInt(systemglobal.CDN_ID.toString()))).join(' OR ')})
                                                          AND host = ?
                                                        LIMIT 100`, [systemglobal.CDN_ID]);
                                        console.log('DELETE BATCH')
                                    })

                                } else if (values.length > 0) {
                                    await db.query(`DELETE
                                                    FROM kanmi_records_cdn
                                                    WHERE (${values.map(e => 'heid = ' + (parseInt(e.toString()) * parseInt(systemglobal.CDN_ID.toString()))).join(' OR ')})
                                                      AND host = ?
                                                    LIMIT 100`, [systemglobal.CDN_ID]);
                                    Logger.printLine("SQL", `Removed ${deleteID.size} Invalid items from cache`, "info");
                                }
                            }
                            resolveChannel();
                        } else {
                            resolveChannel();
                        }
                    } else {
                        resolveChannel();
                    }
                }))
            }, Promise.resolve());
            requests.then(() => {
                console.log('Storage has been verified!')
                //setTimeout(findBackupItems, (systemglobal.CDN_Verify_Interval_Min) ? systemglobal.CDN_Verify_Interval_Min * 60000 : 3610000);
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

    if (systemglobal.CDN_Base_Path) {
        await validateStorage();
    } else {
        Logger.printLine("Init", "Unable to start Download client, no directory setup!", "error")
    }
})()
