(async () => {
    let systemglobal = require('../../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Cache-Correction';

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
            const _seq_config = systemparams_sql.filter(e => e.param_key === 'seq.common');
            if (_seq_config.length > 0 && _seq_config[0].param_data) {
                if (_seq_config[0].param_data.base_url)
                    systemglobal.base_url = _seq_config[0].param_data.base_url;
            }
            // Sequenzia Common Configuration
            // seq.common = { base_url: "https://seq.moe/" }
            const _accepted_img_cache = systemparams_sql.filter(e => e.param_key === 'cache.accepted_formats');
            if (_accepted_img_cache.length > 0 && _accepted_img_cache[0].param_data) {
                if (_accepted_img_cache[0].param_data.images)
                    accepted_cache_types = _accepted_img_cache[0].param_data.images;
                if (_accepted_img_cache[0].param_data.videos)
                    accepted_video_types = _accepted_img_cache[0].param_data.videos;
            }
            // Acceptable Files to Cache - Database Only - Dynamic
            // cache.accepted_formats = { "images" : ['jpeg','jpg','jiff', 'png', 'webp', 'tiff'], "videos" : [ "mov","mp4","avi","ts","mkv" ] }
            const _discord_mgt_enable = systemparams_sql.filter(e => e.param_key === 'discord.mgmt_enabled');
            if (_discord_mgt_enable.length > 0 && _discord_mgt_enable[0].param_value) {
                systemglobal.Discord_FSMgr_Enable = (_discord_mgt_enable[0].param_value.toLowerCase() === 'true');
            }
            // Enable File Management Reaction for Discord - Dynamic
            // Discord_FSMgr_Enable = true
            // discord.mgmt_enabled = 'true'
            const _discord_radio_folder = systemparams_sql.filter(e => e.param_key === 'discord.radio_folder');
            if (_discord_radio_folder.length > 0 && _discord_radio_folder[0].param_value) {
                systemglobal.RadioFolder = _discord_radio_folder[0].param_value
            }
            const _discord_values = systemparams_sql.filter(e => e.param_key === 'discord.info');
            if (_discord_values.length > 0 && _discord_values[0].param_data) {
                if (_discord_values[0].param_data.owner)
                    systemglobal.DiscordOwner = _discord_values[0].param_data.owner;
                if (_discord_values[0].param_data.description)
                    systemglobal.DiscordDescription = _discord_values[0].param_data.description;
                if (_discord_values[0].param_data.prefix)
                    systemglobal.DiscordPrefix = _discord_values[0].param_data.prefix;

            }
            // Discord Bot Info (Shown in Help)
            // DiscordOwner = "Yukimi Kazari"
            // DiscordDescription = "My Discord Bot"
            // DiscordPrefix = "!juzo"
            // discord.info = { "owner" : "Yukimi Kazari", "description" : "Discord Bot", "prefix" : "!juzo" }
            const _limiter1 = systemparams_sql.filter(e => e.param_key === 'discord.limiter.priority');
            if (_limiter1.length > 0 && _limiter1[0].param_data) {
                if (_limiter1[0].param_data.tokens)
                    systemglobal.Limiter_1_Tokens = parseInt(_limiter1[0].param_data.tokens.toString());
                if (_limiter1[0].param_data.interval)
                    systemglobal.Limiter_1_Interval = parseInt(_limiter1[0].param_data.interval.toString());
            }
            const _limiter2 = systemparams_sql.filter(e => e.param_key === 'discord.limiter.standard');
            if (_limiter2.length > 0 && _limiter2[0].param_data) {
                if (_limiter2[0].param_data.tokens)
                    systemglobal.Limiter_2_Tokens = parseInt(_limiter2[0].param_data.tokens.toString());
                if (_limiter2[0].param_data.interval)
                    systemglobal.Limiter_2_Interval = parseInt(_limiter2[0].param_data.interval.toString());
            }
            const _limiter3 = systemparams_sql.filter(e => e.param_key === 'discord.limiter.backlog');
            if (_limiter3.length > 0 && _limiter3[0].param_data) {
                if (_limiter3[0].param_data.tokens)
                    systemglobal.Limiter_3_Tokens = parseInt(_limiter3[0].param_data.tokens.toString());
                if (_limiter3[0].param_data.interval)
                    systemglobal.Limiter_3_Interval = parseInt(_limiter3[0].param_data.interval.toString());
            }
            const _limiter4 = systemparams_sql.filter(e => e.param_key === 'discord.limiter.unpacking');
            if (_limiter4.length > 0 && _limiter4[0].param_data) {
                if (_limiter4[0].param_data.tokens)
                    systemglobal.Limiter_4_Tokens = parseInt(_limiter4[0].param_data.tokens.toString());
                if (_limiter4[0].param_data.interval)
                    systemglobal.Limiter_4_Interval = parseInt(_limiter4[0].param_data.interval.toString());
            }
            // Rate Limiters - Priority Message
            // Limiter_1_Tokens = 15
            // Limiter_1_Interval = 60000
            // discord.limiter.priority = { "tokens" : 5, "interval" : 60000 }

            // Rate Limiters - Standard Message
            // Limiter_2_Tokens = 10
            // Limiter_2_Interval = 60000
            // discord.limiter.standard = { "tokens" : 5, "interval" : 60000 }

            // Rate Limiters - Backlog Message
            // Limiter_3_Tokens = 5
            // Limiter_3_Interval = 60000
            // discord.limiter.backlog = { "tokens" : 5, "interval" : 60000 }

            const _prefetch1 = systemparams_sql.filter(e => e.param_key === 'discord.prefetch.priority');
            if (_prefetch1.length > 0 && _prefetch1[0].param_value)
                systemglobal.Prefetch_1_Count = parseInt(_prefetch1[0].param_value.toString());
            const _prefetch2 = systemparams_sql.filter(e => e.param_key === 'discord.prefetch.standard');
            if (_prefetch2.length > 0 && _prefetch2[0].param_value)
                systemglobal.Prefetch_2_Count = parseInt(_prefetch2[0].param_value.toString());
            const _prefetch3 = systemparams_sql.filter(e => e.param_key === 'discord.prefetch.backlog');
            if (_prefetch3.length > 0 && _prefetch3[0].param_value)
                systemglobal.Prefetch_3_Count = parseInt(_prefetch3[0].param_value.toString());

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
            const _discord_schedules = systemparams_sql.filter(e => e.param_key === 'discord.schedules');
            if (_discord_schedules.length > 0 && _discord_schedules[0].param_data) {

            }
            const _discord_threads = systemparams_sql.filter(e => e.param_key === 'discord.threads');
            if (_discord_threads.length > 0 && _discord_threads[0].param_data) {
                if (_discord_threads[0].param_data.thread_rollover && cron.validate(_discord_threads[0].param_data.thread_rollover))
                    systemglobal.Discord_Cron_Thread_Rollover = _discord_threads[0].param_data.thread_rollover;
                if (_discord_threads[0].param_data.thread_tc_peak && cron.validate(_discord_threads[0].param_data.thread_tc_peak))
                    systemglobal.Discord_Cron_Thread_Peak = _discord_threads[0].param_data.thread_tc_peak;
                if (_discord_threads[0].param_data.thread_tc_offpeak && cron.validate(_discord_threads[0].param_data.thread_tc_offpeak))
                    systemglobal.Discord_Cron_Thread_Offpeak = _discord_threads[0].param_data.thread_tc_offpeak;
                if (_discord_threads[0].param_data.thread_delete_after)
                    systemglobal.Discord_Thread_Delete_After_Days = _discord_threads[0].param_data.thread_delete_after;
                if (_discord_threads[0].param_data.thread_unarchive_channels)
                    systemglobal.Discord_Thread_Unarchive_CMS_Channels = _discord_threads[0].param_data.thread_unarchive_channels;
                if (_discord_threads[0].param_data.thread_unarchive_exclude)
                    systemglobal.Discord_Thread_Unarchive_CMS_Exclude = _discord_threads[0].param_data.thread_unarchive_exclude;
                if (_discord_threads[0].param_data.thread_add_memebers)
                    systemglobal.Discord_Thread_CMS_Add_Memebers = _discord_threads[0].param_data.thread_add_memebers;
            }
            // Discord Thread
            // Discord_Cron_Thread_Rollover = "58 23 * * *"
            // Discord_Cron_Thread_Peak = "0 2 * * *"
            // Discord_Cron_Thread_Offpeak = "0 12 * * *"
            // Discord_Thread_Delete_After_Days = 16
            // Discord_Thread_Unarchive_CMS_Channels = ["829601558680698920"]
            // Discord_Thread_Unarchive_CMS_Exclude = [" RT"]
            // discord.threads = {"thread_delete_after": 16, "thread_unarchive_exclude": [" RT"], "thread_unarchive_channels": ["829601558680698920"], "thread_rollover" : "58 23 * * *", "thread_tc_peak" : "0 2 * * *", "thread_tc_offpeak" : "0 12 * * *" }
            const _overides_bots = systemparams_sql.filter(e => e.param_key === 'discord.overides');
            if (_overides_bots.length > 0 && _overides_bots[0].param_data) {
                if (_overides_bots[0].param_data.users) {
                    systemglobal.Discord_Overided_Bots = _overides_bots[0].param_data.users;
                }
                if (_overides_bots[0].param_data.websocket_is_user !== undefined    ) {
                    systemglobal.Discord_Websockets_As_Users = (_overides_bots[0].param_data.websocket_is_user);
                }
                if (_overides_bots[0].param_data.allow_bot_reactions !== undefined    ) {
                    systemglobal.Discord_Allow_Reactions_From_Bots = _overides_bots[0].param_data.allow_bot_reactions;
                }
            }
            // Discord Overides
            // Discord_Overided_Bots = [] // List of IDs of Bots to consider users
            // Discord_Websockets_As_Users = true  // Consider Websockets Bots to be users and import messages
            // Discord_Allow_Reactions_From_Bots = [] // List of Bots to allow reactions from
            // discord.overides = { "users" : [], "websocket_is_user": true, "allow_bot_reactions" : [] }
            const _cms_options = systemparams_sql.filter(e => e.param_key === 'cms');
            if (_cms_options.length > 0 && _cms_options[0].param_data) {
                if (_cms_options[0].param_data.disable_threads) {
                    systemglobal.CMS_Disable_Threads = _cms_options[0].param_data.disable_threads;
                }
                if (_cms_options[0].param_data.timeline_chid) {
                    systemglobal.CMS_Timeline_Parent = _cms_options[0].param_data.timeline_chid;
                }
                if (_cms_options[0].param_data.new_thread_reactions) {
                    systemglobal.CMS_New_Thread_Reactions = _cms_options[0].param_data.new_thread_reactions;
                }
            }
            // CMS Thread Management
            // CMS_Timeline_Parent = 1234567890 // New Threads are created here
            // CMS_New_Thread_Reactions = ["DownloadToArt", "DownloadToNSFW", "DownloadToFat"] // Automaticly add these reactions
            // cms = { "timeline_chid": "829601558680698920", "new_thread_reactions": ["DownloadToArt", "DownloadToNSFW", "DownloadToFat"] }
            const _discord_insights = systemparams_sql.filter(e => e.param_key === 'discord.insights');
            if (_discord_insights.length > 0) {
                systemglobal.Discord_Insights_Custom_Image_URL = {};
                await Promise.all(_discord_insights.filter(e => e.param_data !== null).map(e => {
                    if (e.param_data.custom_image_url !== undefined) {
                        if (e.serverid) {
                            systemglobal.Discord_Insights_Custom_Image_URL[e.serverid] = e.param_data.custom_image_url
                        } else {
                            systemglobal.Discord_Insights_Custom_Image_URL.default = e.param_data.custom_image_url
                        }
                    }
                }))
            }
            // Discord Insights Panel - Requires Server ID
            // Discord_Insights_Custom_Image_URL = { "default" : "https://...", "1234567890" : "https://..." }
            // discord.insights = {"custom_image_url": "https://media.discordapp.net/attachments/827315100998172693/892564677228363887/suzuya-banner.png?width=1410&height=796"}
        }

        Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug");
    }
    await loadDatabaseCache();

    const mqClient = require('./mqClient')(facilityName, systemglobal);

    const fileworker = 'inbox.fileworker'

    const results = await db.query(`SELECT id, real_filename FROM kanmi_records WHERE (real_filename LIKE '%.mov' OR real_filename LIKE '%.mp4' OR real_filename LIKE '%.avi' OR real_filename LIKE '%.mkv' OR real_filename LIKE '%.ts' ) AND (cache_proxy IS NULL OR cache_proxy NOT LIKE '%.gif') AND filecached = 1 ORDER BY eid DESC LIMIT 10`)
    console.log(`There are ${results.rows.length} thumbnails to be regenerated`)
    results.rows.map(message => {
        mqClient.sendData(systemglobal.FileWorker_In, {
            messageReturn: false,
            messageID: message.id,
            messageAction: 'GenerateVideoPreview',
            forceRefresh: true,
            messageType: 'command'
        }, function (ok) {
            if (ok) {
                console.log(`Sent ${message.real_filename} for generation...`)
            } else {
                console.error(`Failed to send ${message.real_filename} for generation`)
            }
        })
    })
})()
