(async () => {
    let systemglobal = require('../../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Cache-Correction';

    const Logger = require('./logSystem')(facilityName);
    const db = require('./shutauraSQL')(facilityName);

    // Shutaura SQL Cache
    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'discord' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.DiscordUser])
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
            const _ffmpeg_config = systemparams_sql.filter(e => e.param_key === 'ffmpeg.preview');
            if (_ffmpeg_config.length > 0 && _ffmpeg_config[0].param_data) {
                EncoderConf = {
                    Exec: `${_ffmpeg_config[0].param_data.exec}`,
                    VScale: `${_ffmpeg_config[0].param_data.scale}`,
                    VCodec: `${_ffmpeg_config[0].param_data.vcodec}`,
                    VBitrate: `${_ffmpeg_config[0].param_data.vbitrate}`,
                    VCRF: `${_ffmpeg_config[0].param_data.vcrf}`,
                    ACodec: `${_ffmpeg_config[0].param_data.acodec}`,
                    ABitrate: `${_ffmpeg_config[0].param_data.abitrate}`
                };
            }
            // FFMPEG Encoder Configuration - Database Only
            // ffmpeg.preview = {"exec": "ffmpeg", "vcrf": "30", "scale": "640:-1", "acodec": "aac", "vcodec": "h264", "abitrate": "128K", "vbitrate": "500K"}
            const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
            if (_home_guild.length > 0 && _home_guild[0].param_value) {
                systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
            }
            // Home Discord Server - Required - Dynamic
            // DiscordHomeGuild = 1234567890
            // discord.home_guild = 1234567890
            const _undelivered_bin = systemparams_sql.filter(e => e.param_key === 'discord.undelivered');
            if (_undelivered_bin.length > 0 && _undelivered_bin[0].param_value) {
                systemglobal.Discord_Recycling_Bin = _undelivered_bin[0].param_value;
            }
            // Discord Undelivered Messages Channel - Dynamic
            // Discord_Recycling_Bin = 1234567890
            // discord.undelivered = 1234567890
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
        }

        Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug");
    }
    await loadDatabaseCache();

    const mqClient = require('./mqClient')(facilityName, systemglobal);


    setTimeout(async () => {
        const results = await db.query(`SELECT id, real_filename FROM kanmi_records WHERE (real_filename LIKE '%.mov' OR real_filename LIKE '%.mp4' OR real_filename LIKE '%.avi' OR real_filename LIKE '%.mkv' OR real_filename LIKE '%.ts' ) AND (cache_proxy IS NULL OR cache_proxy NOT LIKE '%.gif') AND filecached = 1 ORDER BY eid DESC`)
        console.log(`There are ${results.rows.length} thumbnails to be regenerated`)
        results.rows.map(message => {
            mqClient.sendData(systemglobal.FileWorker_In, {
                messageReturn: false,
                messageID: message.id,
                messageAction: 'GenerateVideoPreview',
                forceRefresh: 'preview',
                messageType: 'command'
            }, function (ok) {
                if (ok) {
                    console.log(`Sent ${message.real_filename} for generation...`)
                } else {
                    console.error(`Failed to send ${message.real_filename} for generation`)
                }
            })
        })
    }, 5000)
})()
