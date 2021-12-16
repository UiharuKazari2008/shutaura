// Database update for up to version 17.1
const fs = require('fs');
const path = require('path');
const mysqldump = require('mysqldump')
const eris = require('eris');

let systemglobal = require('./../config.json');
if (fs.existsSync('./../update.config.json'))
    systemglobal = require('./../update.config.json');

let _systemparams = { error: { sqlMessage: 'Did not Initalize' }, rows: [] }

// Always add APPLYPATCH to git log
const stage1DatabaseUpdate = [
    {
        table: 'kanmi_channels',
        add: [
            'nice_title MEDIUMINT not null after nice_name'
        ],
        drop: [],
        modify: [],
        skip_backup: true
    }
]
const stage2DatabaseUpdate = []

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
        return true
    }

    return module;
}
