// Database update for up to version 17.1
const fs = require('fs');
const path = require('path');
const mysqldump = require('mysqldump')
const eris = require('eris');

let systemglobal = require('./../config.json');
if (fs.existsSync('./../update.config.json'))
    systemglobal = require('./../update.config.json');

let _systemparams = { error: { sqlMessage: 'Did not Initalize' }, rows: [] }

const stage1DatabaseUpdate = [
    {
        table: 'kanmi_records',
        add: [
            'paritycount int null after real_filename',
            'filecached tinyint default 0 not null after attachment_extra'
        ],
        drop: [],
        modify: []
    },
    {
        table: 'kanmi_backups',
        add: [],
        drop: [
            'path',
        ],
        modify: [],
        skip_backup: true
    },
    {
        table: 'discord_multipart_backups',
        add: [],
        drop: [
            'path',
        ],
        modify: [],
        skip_backup: true
    },
    {
        table: 'kanmi_channels',
        add: [],
        drop: [],
        modify: [
            'autofetch set default 0'
        ],
        skip_backup: true
    },
]
const stage2DatabaseUpdate = [
    {
        table: 'kanmi_records',
        add: [],
        drop: [
            'cache_url',
            'cache_extra'
        ],
        modify: []
    }
]

module.exports = function (Logger, db) {
    async function loaddtabase () {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'discord' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.DiscordUser])
    }
    loaddtabase().then(r => {
        if (_systemparams.error) { Logger.printLine("SQL", "Error getting system parameter records!", "emergency", _systemparams.error); return false }
        const systemparams_sql = _systemparams.rows.reverse();
        if (systemparams_sql.length > 0) {
            const _discord_account = systemparams_sql.filter(e => e.param_key === 'discord.login');
            if (_discord_account.length > 0 && _discord_account[0].param_value) {
                systemglobal.Discord_Key = _discord_account[0].param_value
            }
            // Discord Login Key - Required
            // Discord_Key
            // discord.login
            const _mq_account = systemparams_sql.filter(e => e.param_key === 'mq.login');
            if (_mq_account.length > 0 && _mq_account[0].param_data) {
                if (_mq_account[0].param_data.host)
                    systemglobal.MQServer = _mq_account[0].param_data.host;
                if (_mq_account[0].param_data.username)
                    systemglobal.MQUsername = _mq_account[0].param_data.username;
                if (_mq_account[0].param_data.password)
                    systemglobal.MQPassword = _mq_account[0].param_data.password;
            }
            // MQ Login - Required
            // MQServer = "192.168.250.X"
            // MQUsername = "eiga"
            // MQPassword = ""
            // mq.login = { "host" : "192.168.250.X", "username" : "eiga", "password" : "" }
            const _watchdog_host = systemparams_sql.filter(e => e.param_key === 'watchdog.host');
            if (_watchdog_host.length > 0 && _watchdog_host[0].param_value) {
                systemglobal.Watchdog_Host = _watchdog_host[0].param_value;
            }
            // Watchdog Check-in Hostname:Port or IP:Port
            // Watchdog_Host = "192.168.100.X"
            // watchdog.host = "192.168.100.X"
            const _watchdog_id = systemparams_sql.filter(e => e.param_key === 'watchdog.id');
            if (_watchdog_id.length > 0 && _watchdog_id[0].param_value) {
                systemglobal.Watchdog_ID = _watchdog_id[0].param_value;
            }
            // Watchdog Check-in Group ID
            // Watchdog_ID = "main"
            // watchdog.id = "main"
            const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
            if (_home_guild.length > 0 && _home_guild[0].param_value) {
                systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
            }
            // Home Discord Server - Required - Dynamic
            // DiscordHomeGuild = 1234567890
            // discord.home_guild = 1234567890
            const _mq_discord_out = systemparams_sql.filter(e => e.param_key === 'mq.discord.out');
            if (_mq_discord_out.length > 0 && _mq_discord_out[0].param_value) {
                systemglobal.Discord_Out = _mq_discord_out[0].param_value;
            }
            // Discord Outbox MQ - Required - Dynamic
            // Discord_Out = "outbox.discord"
            // mq.discord.out = "outbox.discord"
            const _mq_seq_in = systemparams_sql.filter(e => e.param_key === 'mq.sequenzia.in');
            if (_mq_seq_in.length > 0 && _mq_seq_in[0].param_value) {
                systemglobal.Sequenzia_In = _mq_seq_in[0].param_value;
            }
            // Sequenzia Inbox MQ - Required - Dynamic
            // Sequenzia_In = "inbox.sequenzia"
            // mq.sequenzia.in = "inbox.sequenzia"
            const _mq_fw_in = systemparams_sql.filter(e => e.param_key === 'mq.fileworker.in');
            if (_mq_fw_in.length > 0 && _mq_fw_in[0].param_value) {
                systemglobal.FileWorker_In = _mq_fw_in[0].param_value;
            }
            // FileWorker Remote Request Inbox MQ - Required - Dynamic
            // Sequenzia_In = "inbox.fileworker"
            // mq.fileworker.in = "inbox.fileworker"
            const _mq_twit_in = systemparams_sql.filter(e => e.param_key === 'mq.twitter.in');
            if (_mq_twit_in.length > 0 && _mq_twit_in[0].param_value) {
                systemglobal.Twitter_In = _mq_twit_in[0].param_value;
            }
            // Twitter Inbox MQ - Required - Dynamic
            // Twitter_In = "inbox.twitter"
            // mq.twitter.in = "inbox.twitter"
            const _mq_pixiv_in = systemparams_sql.filter(e => e.param_key === 'mq.pixiv.in');
            if (_mq_pixiv_in.length > 0 && _mq_pixiv_in[0].param_value) {
                systemglobal.Pixiv_In = _mq_pixiv_in[0].param_value;
            }
            // Pixiv Inbox MQ - Required - Dynamic
            // Pixiv_In = "inbox.pixiv"
            // mq.pixiv.in = "inbox.pixiv"
            const _fileworker_config = systemparams_sql.filter(e => e.param_key === 'fileworker');
            if (_fileworker_config.length > 0 && _fileworker_config[0].param_data) {
                if (_fileworker_config[0].param_data.watch_dir)
                    systemglobal.WatchFolder_1 = _fileworker_config[0].param_data.watch_dir;
                if (_fileworker_config[0].param_data.pickup_dir)
                    systemglobal.PickupFolder = _fileworker_config[0].param_data.pickup_dir;
            }
        }
    })
    let module = {};

    module.backupDatabase = async function backupDatabase() {
        try {
            const backupTables = stage1DatabaseUpdate.filter(e => !e.skip_backup).map(e => e.table)
            if (backupTables.length > 0) {
                Logger.printLine("SQL", `Backing up database tables [${backupTables.join(',')}]...`, "info")
                if (!fs.existsSync('../backups/'))
                    fs.mkdirSync('../backups/')
                try {
                    await mysqldump({
                        connection: {
                            host: systemglobal.SQLServer,
                            user: systemglobal.SQLUsername,
                            password: systemglobal.SQLPassword,
                            database: systemglobal.SQLDatabase,
                        },
                        dumpToFile: `../backups/kanmi-backup-${new Date().valueOf()}.sql`,
                        dump: {
                            tables: backupTables,
                            schema: {
                                table: {
                                    dropIfExist: true
                                }
                            },
                            data: {
                                includeViewData: false,
                                maxRowsPerInsertStatement: 100
                            }
                        }
                    });
                } catch (err) {
                    Logger.printLine("SQL", "Failed to backup database, will not proceed", "error")
                    return false
                }
            }
            return true
        } catch (e) {
            Logger.printLine("backupDatabase", `Failed to backup database, Uncaught error: ${e.message}`, "error", e)
            return false
        }
    }
    module.prePatchDatabase = async function prePatchDatabase() {
        try {
            const updates = stage1DatabaseUpdate.filter(e => !e.backup_only)
            for (const i in updates) {
                Logger.printLine("SQL", `Update Table ${updates[i].table}`, "info")
                const sqlStructure = await db.query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`, [systemglobal.SQLDatabase, updates[i].table])
                if (sqlStructure.error) {
                    Logger.printLine("SQL", "Failed to check database", "error")
                    console.log(sqlStructure.error)
                    return false
                } else {
                    const columns = sqlStructure.rows.map(row => row['COLUMN_NAME'].toLowerCase())

                    for (const f of updates[i].add.filter(f => columns.indexOf(f.split(' ')[0].toLowerCase()) === -1)) {
                        Logger.printLine("SQL", `Add Column ${f}`, "info")
                        const update = await db.query(`ALTER TABLE ${updates[i].table} ADD ${f}`)
                        if (update.error) {
                            Logger.printLine("SQL", "Failed to update database", "error")
                            console.log(update.error)
                            return false
                        }
                    }
                    for (const f of updates[i].drop.filter(f => columns.indexOf(f.toLowerCase()) !== -1)) {
                        Logger.printLine("SQL", `Drop Column ${f}`, "info")
                        const update = await db.query(`ALTER TABLE ${updates[i].table} DROP COLUMN ${f}`)
                        if (update.error) {
                            Logger.printLine("SQL", "Failed to update database", "error")
                            console.log(update.error)
                            return false
                        }
                    }
                    for (const f of updates[i].modify.filter(f => columns.indexOf(f.split(' ')[0].toLowerCase()) !== -1)) {
                        Logger.printLine("SQL", `Modify Column ${f}`, "info")
                        const update = await db.query(`ALTER TABLE ${updates[i].table} ALTER COLUMN ${f}`)
                        if (update.error) {
                            Logger.printLine("SQL", "Failed to update database", "error")
                            console.log(update.error)
                            return false
                        }
                    }
                }
            }
            return true
        } catch (e) {
            Logger.printLine("prePatchDatabase", `Failed to patch database, Uncaught error: ${e.message}`, "error", e)
            return false
        }
    }
    module.postPatchDatabase = async function postPatchDatabase() {
        try {
            const updates = stage2DatabaseUpdate.filter(e => !e.backup_only)
            for (const i in updates) {
                Logger.printLine("SQL", `Update Table ${updates[i].table}`, "info")
                const sqlStructure = await db.query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`, [systemglobal.SQLDatabase, updates[i].table])
                if (sqlStructure.error) {
                    Logger.printLine("SQL", "Failed to check database", "error")
                    console.log(sqlStructure.error)
                    return false
                } else {
                    const columns = sqlStructure.rows.map(row => row['COLUMN_NAME'].toLowerCase())

                    for (const f of updates[i].add.filter(f => columns.indexOf(f.split(' ')[0].toLowerCase()) === -1)) {
                        Logger.printLine("SQL", `Add Column ${f}`, "info")
                        const update = await db.query(`ALTER TABLE ${updates[i].table} ADD ${f}`)
                        if (update.error) {
                            Logger.printLine("SQL", "Failed to update database", "error")
                            console.log(update.error)
                            return false
                        }
                    }
                    for (const f of updates[i].drop.filter(f => columns.indexOf(f.toLowerCase()) !== -1)) {
                        Logger.printLine("SQL", `Drop Column ${f}`, "info")
                        const update = await db.query(`ALTER TABLE ${updates[i].table} DROP COLUMN ${f}`)
                        if (update.error) {
                            Logger.printLine("SQL", "Failed to update database", "error")
                            console.log(update.error)
                            return false
                        }
                    }
                    for (const f of updates[i].modify.filter(f => columns.indexOf(f.split(' ')[0].toLowerCase()) !== -1)) {
                        Logger.printLine("SQL", `Modify Column ${f}`, "info")
                        const update = await db.query(`ALTER TABLE ${updates[i].table} ALTER COLUMN ${f}`)
                        if (update.error) {
                            Logger.printLine("SQL", "Failed to update database", "error")
                            console.log(update.error)
                            return false
                        }
                    }
                }
            }
            return true
        } catch (e) {
            Logger.printLine("postPatchDatabase", `Failed to patch database, Uncaught error: ${e.message}`, "error", e)
            return false
        }
    }
    module.patchDatabase = async function patchDatabase() {
        try {
            const sqlStructure = await db.query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`, [systemglobal.SQLDatabase, 'kanmi_records'])
            if (sqlStructure.error) {
                Logger.printLine("SQL", "Failed to check database", "error")
                console.log(sqlStructure.error)
                return false
            }
            const columns = sqlStructure.rows.map(row => row['COLUMN_NAME'].toLowerCase())

            if (columns.indexOf('cache_url') === -1) {
                Logger.printLine("Update", "Skipping updating cache_url", "info");
            } else {
                Logger.printLine("SQL", "Getting Cached Files to convert to boolean ...", "debug")
                const cachedFiles = (await db.query(`SELECT * FROM kanmi_records WHERE fileid IS NOT NULL AND cache_url IS NOT NULL AND cache_url LIKE '%/cds/%'`)).rows
                if (cachedFiles.length > 0) {
                    Logger.printLine("Update", `Updating ${cachedFiles.length} files to boolean...`, "debug")
                    for (const i in cachedFiles) {
                        try {
                            if (systemglobal.PickupFolder) {
                                const filename = cachedFiles[i].cache_url.split('/').pop();
                                fs.renameSync(path.join(systemglobal.PickupFolder, filename), path.join(systemglobal.PickupFolder, `.${cachedFiles[i].fileid}`))
                            }
                            await db.query(`UPDATE kanmi_records SET filecached = 1, cache_url = null WHERE eid = ?`, [cachedFiles[i].eid])
                            Logger.printLine("Update", "Completed successfully", "info");
                        } catch (e) {
                            Logger.printLine("Update", `Failed : ${e.message}`, "error");
                            process.exit(1);
                        }
                    }
                } else {
                    Logger.printLine("Update", "Nothing to do!", "info");
                }
            }

            Logger.printLine("SQL", "Erasing Unneeded Proxy Files...", "debug")
            await db.query(`UPDATE kanmi_records SET cache_proxy = NULL WHERE cache_proxy IS NOT NULL AND cache_proxy NOT LIKE '%-t9-preview-video%'`)

            Logger.printLine("SQL", "Getting Proxy Files...", "debug")
            const proxyFiles = (await db.query(`SELECT * FROM kanmi_records WHERE cache_proxy IS NOT NULL AND cache_proxy LIKE '%/attachments/%'`)).rows
            if (proxyFiles.length > 0) {
                Logger.printLine("Update", `Updating ${proxyFiles.length} files to partial urls...`, "debug")
                for (const i in proxyFiles) {
                    try {
                        await db.query(`UPDATE kanmi_records SET cache_proxy = ? WHERE eid = ?`, [proxyFiles[i].cache_proxy.split('/attachments').pop(), proxyFiles[i].eid])
                    } catch (e) {
                        Logger.printLine("Update", `Failed : ${e.message}`, "error");
                        process.exit(1);
                    }
                }
            } else {
                Logger.printLine("Update", "Nothing to do!", "info");
            }


            Logger.printLine("SQL", "Getting Files with multi attachments that are not supposed to be that way...", "debug")
            const badMultis = (await db.query(`SELECT * FROM kanmi_records WHERE attachment_extra IS NOT NULL`)).rows
            if (badMultis.length > 0) {
                Logger.printLine("Update", `Updating ${badMultis.length} files to partial urls...`, "debug")
                for (const i in badMultis) {
                    try {
                        const messageAttachments = JSON.parse(badMultis[i].attachment_extra.toString())
                        if (messageAttachments.length === 1 || (messageAttachments.length > 1 && messageAttachments.filter(e => e[0].includes('t9')).length !== 0)) {
                            const urlParts = messageAttachments[0][1].split(`https://cdn.discordapp.com/attachments/`)
                            if (urlParts.length === 2) {
                                let hashValue = urlParts[1]
                                let filename = urlParts.pop()
                                if (hashValue.startsWith(`${badMultis[i].channel}/`)) {
                                    hashValue = hashValue.split('/')[1]
                                } else {
                                    console.warn(`Hash is not a member of channel ${hashValue} - Will Store larger hash value :(`)
                                }

                                console.warn(`Updating incorrect multi-attachment file to "${hashValue}" AND "${filename}"`)
                                const updated = await db.query(`UPDATE kanmi_records SET attachment_hash = ?, attachment_name = ?, attachment_extra = NULL, cache_proxy = NULL WHERE eid = ?`, [hashValue, filename, badMultis[i].eid])
                                if (updated.error) {
                                    console.error("Database error: " + updated.error.sqlMessage)
                                    process.exit(1)
                                }
                            }
                        }
                    } catch (e) {
                        Logger.printLine("Update", `Failed : ${e.message}`, "error");
                        console.error(e)
                        process.exit(1);
                    }
                }
            } else {
                Logger.printLine("Update", "Nothing to do!", "info");
            }

            Logger.printLine("SQL", "Getting Files to cache parity count...", "debug")
            const files = (await db.query(`SELECT DISTINCT fileid FROM kanmi_records WHERE fileid IS NOT NULL AND paritycount IS NULL`)).rows
            Logger.printLine("SQL", "Getting Spanned Files...", "debug")
            const messageparts = (await db.query(`SELECT * FROM discord_multipart_files`)).rows

            if (files.length > 0 && messageparts.length > 0) {
                const messagesToGet = files.map(e => {
                    const _mes = messageparts.filter(f => f.fileid === e.fileid)
                    if (_mes.length > 0) {
                        return {
                            fileid: e.fileid,
                            id: _mes[0].messageid,
                            ch: _mes[0].channelid
                        }
                    } else {
                        Logger.printLine("RecacheValues", `Failed to match fileID : ${e.fileid}`, "error")
                        return false
                    }
                }).filter(e => !(!e))
                if (messagesToGet.length > 0) {
                    Logger.printLine("Discord", "Settings up Discord Client...", "debug")
                    const discordClient = new eris.Client(systemglobal.Discord_Key, {
                        compress: true,
                        restMode: true,
                        intents: [
                            'guilds'
                        ],
                    });
                    await discordClient.connect().catch((er) => {
                        Logger.printLine("Discord", "Failed to connect to Discord", "emergency", er)
                        process.exit(2);
                    });
                    discordClient.on("ready", async () => {
                        Logger.printLine("Discord", `Caching total parts for ${messagesToGet.length}...`, "debug")
                        for (const i in messagesToGet) {
                            try {
                                const msg = await discordClient.getMessage(messagesToGet[i].ch, messagesToGet[i].id);
                                if (msg.content.includes('📦 Part: ')) {
                                    const totalParts = msg.content.split('📦 Part: ').pop().split('/').pop();
                                    const savePartData = await db.query(`UPDATE kanmi_records SET paritycount = ? WHERE fileid = ?`, [totalParts, messagesToGet[i].fileid])
                                    if (savePartData.error) {
                                        Logger.printLine("SQL", `Failed to set total parts for fileID : ${messagesToGet[i].fileid} - ${savePartData.error}`, "error")
                                    } else {
                                        Logger.printLine("RecacheValues", `(${i}/${messagesToGet.length}) ${messagesToGet[i].fileid} = ${totalParts}`, "info")
                                    }
                                } else {
                                    Logger.printLine("RecacheValues", `Failed to get total parts for fileID : ${messagesToGet[i].fileid}, Missing expected value!`, "error")
                                }
                            } catch (e) {
                                Logger.printLine("Discord", `Failed to read value : ${e.message}`, "error");
                                process.exit(1);
                            }
                        }
                        Logger.printLine("Update", "Completed successfully", "info");
                        discordClient.disconnect(false);
                        process.exit(0);
                    });
                } else {
                    Logger.printLine("Update", "Nothing to do!", "info");
                    process.exit(0);
                }
            } else {
                Logger.printLine("Update", "Nothing to do!", "info");
            }
            return true
        } catch (e) {
            Logger.printLine("patchDatabase", `Failed to patch database, Uncaught error: ${e.message}`, "error", e)
            return false
        }
    }

    return module;
}
