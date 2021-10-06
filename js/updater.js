(async () => {
    const facilityName = 'Updater';
    const fs = require("fs");
    const path = require('path');
    const amqp = require('amqplib/callback_api');
    const crypto = require("crypto");
    const colors = require('colors');
    const cron = require('node-cron');
    let systemglobal = require('./../config.json');
    const minimist = require("minimist");
    const request = require('request').defaults({ encoding: null });
    let args = minimist(process.argv.slice(2));

    const db = require('utils/shutauraSQL')("Toolbox");
    const Logger = require('./utils/logSystem')(facilityName);

    Logger.printLine("Init", "Updater", "info");

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (application = 'updater' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName])
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
            const _discord_refresh_cache = systemparams_sql.filter(e => e.param_key === 'discord.timers');
            if (_discord_refresh_cache.length > 0 && _discord_refresh_cache[0].param_data) {
                if (_discord_refresh_cache[0].param_data.refresh_discord_cache) {
                    const _rtimer = parseInt(_discord_refresh_cache[0].param_data.refresh_discord_cache.toString());
                    if (!isNaN(_rtimer) && _rtimer >= 5) {
                        systemglobal.Discord_Timer_Refresh = _rtimer * 60000;
                    }
                }
                if (_discord_refresh_cache[0].param_data.refresh_counts) {
                    const _rtimer = parseInt(__discord_refresh_cache[0].param_data.refresh_counts.toString());
                    if (!isNaN(_rtimer) && _rtimer >= 1) {
                        systemglobal.Discord_Timer_Counts = _rtimer * 60000;
                    }
                }
                if (_discord_refresh_cache[0].param_data.refresh_sql_cache) {
                    const _rtimer = parseInt(__discord_refresh_cache[0].param_data.refresh_sql_cache.toString());
                    if (!isNaN(_rtimer) && _rtimer >= 5) {
                        systemglobal.Discord_Timer_SQLCache = _rtimer * 60000;
                    }
                }
            }
            // Discord Interal Timers
            // Discord_Timer_Refresh = 300000
            // Discord_Timer_Counts = 900000
            // Discord_Timer_SQLCache = 1200000
            // discord.timers = { "refresh_discord_cache" : 15, "refresh_counts" : 60, "refresh_sql_cache" : 10 }
        }

        Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug");
        setTimeout(loadDatabaseCache, (systemglobal.Discord_Timer_SQLCache) ? systemglobal.Discord_Timer_SQLCache : 1200000)
    }
    if (args.whost) {
        systemglobal.Watchdog_Host = args.whost
    }
    if (args.wid) {
        systemglobal.Watchdog_ID = args.wid
    }
    await loadDatabaseCache();

    const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`;




    if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
        setTimeout(() => {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
        }, 5000)
        setInterval(() => {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/ping?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
        }, 60000)
    }
    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err)
        process.exit(1)
    });
})()