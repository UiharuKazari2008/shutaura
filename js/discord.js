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
This code is publicly released and is restricted by its project license
====================================================================================== */

(async () => {
    let systemglobal = require('../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Discord-IO';

    const eris = require('eris');
    const fs = require('fs');
    const tx2 = require('tx2')
    const path = require('path');
    const amqp = require('amqplib/callback_api');
    const crypto = require("crypto");
    const colors = require('colors');
    const cron = require('node-cron');
    const remoteSize = require('remote-file-size');
    let amqpConn = null;
    let selfstatic = {};
    const RateLimiter = require('limiter').RateLimiter;
    const storageHandler = require('node-persist');
    const getUrls = require('get-urls');
    const request = require('request').defaults({ encoding: null });
    const moment = require('moment');
    const { getAverageColor } = require('fast-average-color-node');
    const md5 = require('md5');
    const sharp = require("sharp");
    const sizeOf = require('image-size');
    const minimist = require("minimist");
    let args = minimist(process.argv.slice(2));

    const { clone, fileSize, shuffle, filterItems, getIDfromText, convertIDtoUnix, msConversion } = require('./utils/tools');
    const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
    const {spawn} = require("child_process");
    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    let init = 0;
    let gracefulShutdown = false;
    let forceShutdown = false;
    let playingFolder = "";
    let toPlayFolder = "";
    let EncoderConf = {
        Exec: "ffmpeg",
        VScale: "640:-1",
        VCodec: "h264",
        VBitrate: "500K",
        VCRF: "30",
        ACodec: "aac",
        ABitrate: "128K"
    }
    let twitterlist = [];
    let twitteraccount = [];
    let pixivaccount = [];
    let pixivreactionsaccount = [];
    let ignoredchannels = [];
    let discordservers = [];
    let discordperms = [];
    let discordreact = [];
    let discordautoreact = [];
    let musicFolders = [];
    let addClearButton = [];
    let staticChID = {};
    let discordServers = new Map();
    let discordChannels = new Map();
    let activeProccess = true;
    let playingStatus = new Map();
    let collectorEnable = new Map();
    let authorizedUsers = new Map();
    let sudoUsers = new Map();
    let botUsers = new Map();
    let clearTimers = new Map();
    let previousStatusObjects = new Map();
    let cacheData = new Map();
    let TwitterActivityChannels = new Map();
    let TwitterLists = new Map();
    let TwitterListsEncoded = new Map();
    let TwitterListAccounts = new Map();
    let TwitterRedirects = new Map();
    let TwitterCDSBypass = new Map();
    let TwitterAutoLike = new Map();
    let TwitterLikeList = new Map();
    let TwitterPixivLike = new Map();
    let PixivChannels = new Map();
    let PixivSaveChannel = new Map();
    let Timers = new Map();
    let activeTasks = new Map();
    let activeAlerts = new Map();
    let statusValues = new Map();
    let tempThread = new Map();

    let accepted_cache_types = ['jpeg','jpg','jiff', 'png', 'webp', 'tiff'];
    let accepted_video_types = [ "mov","mp4","avi","ts","mkv" ];

    const localParameters = storageHandler.create({
        dir: 'data/state',
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        logging: false,
        ttl: false,
        expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache
        forgiveParseErrors: false
    });
    localParameters.init((err) => {
        if (err) {
            Logger.printLine("LocalParameters", "Failed to initialize the Local parameters storage", "error", err)
        } else {
            Logger.printLine("LocalParameters", "Initialized successfully the Local parameters storage", "debug", err)
        }
    });

    const messsageCollector = storageHandler.create({
        dir: 'data/collector',
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        logging: false,
        ttl: false,
        expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache
        forgiveParseErrors: false
    });
    messsageCollector.init((err) => {
        if (err) {
            Logger.printLine("messsageCollector", "Failed to initialize the Message Collector storage", "error", err)
        } else {
            Logger.printLine("messsageCollector", "Initialized successfully the Message Collector storage", "debug", err)
        }
    });

    const nowPlaying = storageHandler.create({
        dir: 'data/player',
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        logging: false,
        ttl: true,
        expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache
        forgiveParseErrors: false
    });
    nowPlaying.init((err) => {
        if (err) {
            Logger.printLine("nowPlaying", "Failed to initialize the music storage", "error", err)
        } else {
            Logger.printLine("nowPlaying", "Initialized successfully the music storage", "debug", err)
        }
    });

    Logger.printLine("Init", "Discord I/O", "info");



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

        Logger.printLine("SQL", "Getting Twitter Lists", "debug")
        const _twitterlist = await db.query(`SELECT x.*, y.download_listid, y.download_channelid FROM twitter_list x LEFT OUTER JOIN discord_reactions y ON (y.download_channelid IS NOT NULL AND y.download_listid = x.listid)`)
        if (_twitterlist.error) { Logger.printLine("SQL", "Error getting twitter list records!", "emergency", _twitterlist.error); return false }
        twitterlist = _twitterlist.rows;

        Logger.printLine("SQL", "Getting Twitter Accounts (Selective Fields)", "debug")
        const _twitteraccount = await db.query(`SELECT taccount, activitychannelid FROM twitter_accounts`)
        if (_twitteraccount.error) { Logger.printLine("SQL", "Error getting twitter accounts records!", "emergency", _twitteraccount.error); return false }
        twitteraccount = _twitteraccount.rows;

        Logger.printLine("SQL", "Getting Pixiv Accounts (Selective Fields)", "debug")
        const _pixivaccount = await db.query(`SELECT feed_channelid, feed_channelid_nsfw, recom_channelid, recom_channelid_nsfw, save_channelid, save_channelid_nsfw, like_taccount, like_taccount_nsfw FROM pixiv_accounts x`)
        if (_pixivaccount.error) { Logger.printLine("SQL", "Error getting pixiv accounts records!", "emergency", _pixivaccount.error); return false }
        pixivaccount = _pixivaccount.rows;

        Logger.printLine("SQL", "Getting Reaction Pixiv -> Twitter Accounts (Selective Fields)", "debug")
        const _pixivreactionsaccount = await db.query(`SELECT download_channelid, download_taccount FROM discord_reactions`)
        if (_pixivreactionsaccount.error) { Logger.printLine("SQL", "Error getting pixiv reactions records!", "emergency", _pixivreactionsaccount.error); return false }
        pixivreactionsaccount = _pixivreactionsaccount.rows;

        Logger.printLine("SQL", "Getting Discord Servers", "debug")
        const _discordservers = await db.query(`SELECT * FROM discord_servers`)
        if (_discordservers.error) { Logger.printLine("SQL", "Error getting discord servers records!", "emergency", _discordservers.error); return false }
        discordservers = _discordservers.rows;

        Logger.printLine("SQL", "Getting Discord Channels", "debug")
        const _discordchannels = await db.query(`SELECT * FROM kanmi_channels WHERE classification IS NOT NULL AND (classification NOT LIKE '%system%' AND classification NOT LIKE '%timeline%') AND source = 0`)
        if (_discordchannels.error) { Logger.printLine("SQL", "Error getting discord channels records!", "emergency", _discordchannels.error); return false }
        await Promise.all(_discordchannels.rows.map(e => {
            discordChannels.set(e.channelid, e)
        }))

        Logger.printLine("SQL", "Getting Discord Permissions", "debug")
        const _discordperms = await db.query(`SELECT * FROM discord_permissons WHERE name = 'sysbot' OR name = 'system_admin' OR name = 'system_interact'`)
        if (_discordperms.error) { Logger.printLine("SQL", "Error getting discord permissons records!", "emergency", _discordperms.error); return false }
        discordperms = _discordperms.rows;

        Logger.printLine("SQL", "Getting Discord Reactions", "debug")
        const _discordreactions = await db.query(`SELECT * FROM discord_reactions ORDER BY position`)
        if (_discordreactions.error) { Logger.printLine("SQL", "Error getting discord reactions records!", "emergency", _discordreactions.error); return false }
        discordreact = _discordreactions.rows;

        Logger.printLine("SQL", "Getting Discord Auto Reactions", "debug")
        const _discordautoreactions = await db.query(`SELECT * FROM discord_reactions_autoadd`)
        if (_discordautoreactions.error) { Logger.printLine("SQL", "Error getting discord reactions records!", "emergency", _discordautoreactions.error); return false }
        discordautoreact = _discordautoreactions.rows;

        Logger.printLine("SQL", "Getting Clear Button Reactions", "debug")
        const _add_clear_btn = await db.query(`SELECT DISTINCT channelid FROM discord_autoclean WHERE clearbtn = 1 UNION SELECT DISTINCT lastthread AS channelid FROM discord_autothread WHERE pinbutton = 1`)
        if (_add_clear_btn.error) { Logger.printLine("SQL", "Error getting discord clear reactions records!", "emergency", _add_clear_btn.error); return false }
        addClearButton = _add_clear_btn.rows.map(e => e.channelid);

        Logger.printLine("SQL", "Getting Discord Alarm Clocks", "debug")
        const _alarmclock = await db.query(`SELECT * FROM discord_alarms`)
        if (_alarmclock.error) { Logger.printLine("SQL", "Error getting master discord static channels records!", "emergency", _alarmclock.error); return false }

        await Promise.all(_alarmclock.rows.map(alm => {
            if (!cron.validate(alm.schedule)) {
                Logger.printLine("AlarmClock", `Alarm Clock #${alm.id} Schedule value is invalid: "${alm.schedule}"`, 'error');
            } else {
                const _curAlm = (Timers.has(`alarmClock-${alm.id}`)) ? Timers.get(`alarmClock-${alm.id}`) : false;
                const _snoozedAlm = (Timers.has(`alarmSnoozed-${alm.id}`)) ? Timers.get(`alarmSnoozed-${alm.id}`) : false;
                if (!_curAlm || (_curAlm && (
                    _curAlm.schedule !== alm.schedule ||
                    _curAlm.channel !== alm.channel ||
                    _curAlm.text !== alm.text ||
                    _curAlm.mention !== alm.mention ||
                    _curAlm.snooze !== alm.snooze ||
                    _curAlm.expires !== alm.expires))) {
                    Logger.printLine("AlarmClock", `${(_curAlm) ? 'Updated' : 'Created'} Alarm Clock #${alm.id} for "${alm.schedule}"`, 'info');
                    if (_curAlm) {
                        _curAlm.cronjob.stop();
                        Timers.delete(`alarmClock-${alm.id}`);
                    }
                    if (_snoozedAlm) {
                        clearTimeout(_snoozedAlm.snoozeTimer);
                        Timers.delete(`alarmSnoozed-${alm.id}`);
                    }
                    Timers.set(`alarmClock-${alm.id}`, {
                        ...alm,
                        cronjob: cron.schedule(alm.schedule, () => {
                            triggerAlarm(alm.id)
                        })
                    })
                }
            }
        }))
        await Promise.all(Array.from(Timers.keys()).filter(e => e.startsWith('alarmClock-') && _alarmclock.rows.filter(f => f.id.toString() === e.split('-').pop()).length === 0).map(alm => {
            const _curAlm = (Timers.has(`alarmClock-${alm}`)) ? Timers.get(`alarmClock-${alm}`) : false;
            if (_curAlm) {
                _curAlm.cronjob.stop();
                Timers.delete(`alarmClock-${alm}`);
                Logger.printLine("AlarmClock", `Removed Alarm Clock #${_curAlm.id} for "${_curAlm.schedule}"`, 'info');
            }
        }))

        await Promise.all(twitterlist.map(item =>{
            TwitterLists.set(item.channelid, item.listid);
            TwitterListsEncoded.set(4886750 + item.id, item.listid);
            TwitterListsEncoded.set(11140940 + item.id, item.listid);
            TwitterListAccounts.set(item.listid, item.taccount)
            if (item.download_listid !== null) {
                TwitterLikeList.set(item.download_channelid, item.listid);
            }
            if (item.channelid_rt !== null) {
                TwitterLists.set(item.channelid_rt, item.listid);
                TwitterListsEncoded.set(11140940 + item.id, item.listid);
            }
            if (item.redirect_taccount !== null) {
                TwitterRedirects.set(item.listid, item.redirect_taccount);
            }
            if (item.bypasscds === 1) {
                TwitterCDSBypass.set(item.listid, item.saveid);
            }
            if (item.autolike !== null && item.autolike !== 0) {
                TwitterAutoLike.set(item.listid, (item.redirect_taccount !== null) ? item.redirect_taccount : item.taccount);
            }
        }))
        await Promise.all(twitteraccount.map(item => {
            TwitterActivityChannels.set(item.activitychannelid, item.taccount);
        }))
        await Promise.all(pixivaccount.map(item => {
            PixivChannels.set(item.save_channelid, 1);
            if (item.save_channelid_nsfw)
                PixivChannels.set(item.save_channelid_nsfw, 2);
            if (item.like_taccount) {
                TwitterPixivLike.set(6010879, item.like_taccount);
                TwitterPixivLike.set(7264269, item.like_taccount);
                TwitterPixivLike.set(14156031, item.like_taccount);
                TwitterPixivLike.set(item.save_channelid, item.like_taccount);
            }
            if (item.like_taccount_nsfw) {
                TwitterPixivLike.set(16711724, item.like_taccount_nsfw);
                TwitterPixivLike.set(16711787, item.like_taccount_nsfw);
                if (item.save_channelid_nsfw)
                    TwitterPixivLike.set(item.save_channelid_nsfw, item.like_taccount_nsfw);
            }
            pixivreactionsaccount.forEach(acc => {
                if (item.like_taccount === acc.download_taccount) {
                    TwitterPixivLike.set(acc.download_channelid, item.like_taccount);
                } else if (item.like_taccount_nsfw === acc.download_taccount) {
                    TwitterPixivLike.set(acc.download_channelid, item.like_taccount_nsfw);
                }
            })
            PixivSaveChannel.set(6010879, item.save_channelid);
            PixivSaveChannel.set(7264269, item.save_channelid);
            PixivSaveChannel.set(14156031, item.save_channelid);

            PixivSaveChannel.set(16711724, item.save_channelid_nsfw);
            PixivSaveChannel.set(16711787, item.save_channelid_nsfw);
        }))
        await Promise.all(discordservers.map(server => {
            const ch = {
                System         : `${server.chid_system}`,
                AlrmInfo       : `${server.chid_msg_info}`,
                AlrmWarn       : `${server.chid_msg_warn}`,
                AlrmErr        : `${server.chid_msg_err}`,
                AlrmCrit       : `${server.chid_msg_crit}`,
                AlrmNotif      : `${server.chid_msg_notif}`,
            }
            staticChID[server.serverid] = ch
            discordServers.set(server.serverid, server);
            if (server.serverid === systemglobal.DiscordHomeGuild) {
                staticChID['homeGuild'] = ch
                discordServers.set('homeGuild', server);

            }
        }))

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
    const MQWorker1 = systemglobal.Discord_Out + '.priority';
    const MQWorker2 = systemglobal.Discord_Out;
    const MQWorker3 = systemglobal.Discord_Out + '.backlog';

    const limiter1 = new RateLimiter((systemglobal.Limiter_1_Tokens) ? systemglobal.Limiter_1_Tokens : 15, (systemglobal.Limiter_1_Interval) ? systemglobal.Limiter_1_Interval : 60000);
    const limiter2 = new RateLimiter((systemglobal.Limiter_2_Tokens) ? systemglobal.Limiter_2_Tokens : 10, (systemglobal.Limiter_2_Interval) ? systemglobal.Limiter_2_Interval : 60000);
    const limiter3 = new RateLimiter((systemglobal.Limiter_3_Tokens) ? systemglobal.Limiter_3_Tokens : 5, (systemglobal.Limiter_3_Interval) ? systemglobal.Limiter_3_Interval : 60000);
    const limiter4 = new RateLimiter((systemglobal.Limiter_4_Tokens) ? systemglobal.Limiter_4_Tokens : 10, (systemglobal.Limiter_4_Interval) ? systemglobal.Limiter_4_Interval : 60000);

    const MQWorker10 = 'failed.' + systemglobal.Discord_Out;

    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    try {
        if (!fs.existsSync(systemglobal.TempFolder)) {
            fs.mkdirSync(systemglobal.TempFolder);
        }
    } catch (e) {
        console.error('Failed to create the temp folder, not a issue if your using docker');
        console.error(e);
    }

    console.log(`System Configuration:`)
    console.log(systemglobal)

    // Command Queue
    // Priority Queue
    function startEmergencyWorker() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Undelivered Channel Error", "error", err)
            });
            ch.assertQueue(MQWorker10, { durable: true }, function(err, _ok) {
                if (closeOnErr(err)) return;
                Logger.printLine("KanmiMQ", "Undelivered Channel Ready", "debug")
                ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
                    if (closeOnErr(err)) return;
                    ch.bindQueue(MQWorker10, "kanmi.exchange", MQWorker10, [], function(err, _ok) {
                        if (closeOnErr(err)) return;
                        ch.close();
                    })
                });
            });
        });
    }
    function startWorker() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 1 Error (Priority)", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 1 Closed (Priority)", "critical" )
                if (!gracefulShutdown)
                    startWorker();
            });
            ch.prefetch((systemglobal.Prefetch_1_Count) ? parseInt(systemglobal.Prefetch_1_Count.toString()) : 10);
            ch.assertQueue(MQWorker1, { durable: true }, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.consume(MQWorker1, processMsg, { noAck: false });
                Logger.printLine("KanmiMQ", "Channel 1 Worker Ready (Priority)", "debug")
            });
            ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.bindQueue(MQWorker1, "kanmi.exchange", MQWorker1, [], function(err, _ok) {
                    if (closeOnErr(err)) return;
                    Logger.printLine("KanmiMQ", "Channel 1 Worker Bound to Exchange (Priority)", "debug")
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
    async function work(msg, cb) {
        if (gracefulShutdown) {
            Logger.printLine("KanmiMQ", "Channel 1 Worker, Graceful Shutdown was activated, not accepting new messages")
            await sleep(90000000)
        }
        let MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
        if (parseInt(MessageContents.messageChannelID).toString() !== 'NaN') {
            limiter1.removeTokens(1, function() {
                parseRemoteAction(MessageContents, "Priority", cb)
            });
        } else {
            Logger.printLine("KanmiMQ",`Client ${MessageContents.fromClient} has sent a bad Channel ID of "${MessageContents.messageChannelID}"`, 'critical', MessageContents)
            cb(true)
        }
    }
    // Standard Queue
    function startWorker2() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 2 Error (Standard)", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 2 Closed (Standard)", "critical" )
                if (!gracefulShutdown)
                    startWorker2();
            });
            ch.prefetch((systemglobal.Prefetch_2_Count) ? parseInt(systemglobal.Prefetch_2_Count.toString()) : 5);
            ch.assertQueue(MQWorker2, { durable: true, queueMode: 'lazy' }, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.consume(MQWorker2, processMsg, { noAck: false });
                Logger.printLine("KanmiMQ", "Channel 2 Worker Ready (Standard)", "debug")
            });
            ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.bindQueue(MQWorker2, "kanmi.exchange", MQWorker2, [], function(err, _ok) {
                    if (closeOnErr(err)) return;
                    Logger.printLine("KanmiMQ", "Channel 2 Worker Bound to Exchange (Standard)", "debug")
                })
            });
            function processMsg(msg) {
                work2(msg, function(ok) {
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
    async function work2(msg, cb) {
        if (gracefulShutdown) {
            Logger.printLine("KanmiMQ", "Channel 2 Worker, Graceful Shutdown was activated, not accepting new messages")
            await sleep(90000000)
        }
        let MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
        if (parseInt(MessageContents.messageChannelID).toString() !== 'NaN') {
            limiter2.removeTokens(1, function() {
                parseRemoteAction(MessageContents, "Standard", cb)
            });
        } else {
            Logger.printLine("KanmiMQ",`Client ${MessageContents.fromClient} has sent a bad Channel ID of "${MessageContents.messageChannelID}"`, 'critical', MessageContents)
            cb(true)
        }
    }
    // Backlog Queue
    function startWorker3() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 3 Error (Backlog)", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 3 Closed (Backlog)", "critical" )
                if (!gracefulShutdown)
                    startWorker3();
            });
            ch.prefetch((systemglobal.Prefetch_3_Count) ? parseInt(systemglobal.Prefetch_3_Count.toString()) : 5);
            ch.assertQueue(MQWorker3, { durable: true, queueMode: 'lazy' }, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.consume(MQWorker3, processMsg, { noAck: false });
                Logger.printLine("KanmiMQ", "Channel 3 Worker Ready (Backlog)", "debug")
            });
            ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.bindQueue(MQWorker3, "kanmi.exchange", MQWorker3, [], function(err, _ok) {
                    if (closeOnErr(err)) return;
                    Logger.printLine("KanmiMQ", "Channel 3 Worker Bound to Exchange (Backlog)", "debug")
                })
            });
            function processMsg(msg) {
                work3(msg, function(ok) {
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
    async function work3(msg, cb) {
        if (gracefulShutdown) {
            Logger.printLine("KanmiMQ", "Channel 3 Worker, Graceful Shutdown was activated, not accepting new messages")
            await sleep(90000000)
        }
        let MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
        if (parseInt(MessageContents.messageChannelID).toString() !== 'NaN') {
            if (MessageContents && MessageContents.fromClient.includes('return.Sequenzia.Polyfills.') && MessageContents.messageOriginalID) {
                limiter3.removeTokens(1, function() {
                    parseRemoteAction(MessageContents, "Backlog", cb);
                });
            } else {
                limiter3.removeTokens(1, function() {
                    parseRemoteAction(MessageContents, "Backlog", cb);
                });
            }
        } else {
            Logger.printLine("KanmiMQ",`Client ${MessageContents.fromClient} has sent a bad Channel ID of "${MessageContents.messageChannelID}"`, 'critical', MessageContents)
            cb(true)
        }
    }
    // Kanmi MQ Backend
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
                if (!gracefulShutdown)
                    setTimeout(start, 5000);
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
    function whenConnected() {
        startEmergencyWorker();
        startWorker();
        startWorker2();
        startWorker3();
        cleanOldMessages();
        setInterval(cleanOldMessages, 3600000);
        if (process.send && typeof process.send === 'function') {
            process.send('ready');
        }
    }
    function sendWatchdogPing() {
        request.get(`http://${systemglobal.Watchdog_Host}/watchdog/ping?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
            if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
            }
        })
        setTimeout(() => {sendWatchdogPing()}, 60000)
    }
    function shutdownSystem(cb) {
        gracefulShutdown = true;
        syncStatusValues();
        function checkForShutdownCleance() {
            const activeJobs = Object.entries(discordClient.requestHandler.ratelimits).filter(e => e[1].remaining === 0 && e[1].processing !== false && e[0] !== '/users/@me/guilds').length
            const activeSysJobs = activeTasks.size
            if (forceShutdown) {
                amqpConn.close();
                console.log(`Shutdown Clearance Overided`)
                cb(true)
            } else if (activeSysJobs > 0 || activeJobs > 0) {
                console.log(`Waiting for shutdown clearance... (Requests: ${activeJobs} & Jobs: ${activeSysJobs})`)
                setTimeout(checkForShutdownCleance, 15000)
            } else {
                amqpConn.close();
                console.log(`Shutdown Clearance Granted`)
                cb(true)
            }
        }
        setTimeout(checkForShutdownCleance, 15000)
    }

    // Discord Framework - Core
    async function parseRemoteAction(MessageContents, level, cb) {
        if (MessageContents.messageType && MessageContents.messageType === 'status') {
            let ChannelID = "" + MessageContents.messageChannelID.trim().split("\n").join('')
            const channelName = MessageContents.messageChannelName + ''
            if (MessageContents.messageChannelID !== '0') {
                const channelTitle = MessageContents.messageText + ''
                cb(true);
                if (channelTitle !== '' && channelTitle !== 'undefined') {
                    const channel = discordClient.getChannel(MessageContents.messageChannelID);
                    if (channel && channel.name !== channelTitle) {
                        discordClient.editChannel(MessageContents.messageChannelID, {name: channelTitle}, "Status Update")
                            .catch((err) => {
                                console.error(err.message)
                                Logger.printLine("Discord", `Can't update channel "${channelName}" to "${channelTitle}"`, "error", err)
                            })
                    }
                }
            } else if (MessageContents.messageChannelID === '0' && channelName !== '' && channelName !== 'undefined') {
                const channels = await db.query(`SELECT channel FROM discord_status WHERE name = ?`, [channelName]);
                if (channels.error) {
                    SendMessage("SQL Error occurred when retrieving the status channels", "err", 'main', "SQL", channels.error)
                }
                const channelTitle = `${(MessageContents.messageData && MessageContents.messageData.statusText) ? MessageContents.messageData.statusText : (MessageContents.messageText) ? MessageContents.messageText : 'undefined'}`
                if (MessageContents.messageData) {
                    await statusValues.set(channelName, MessageContents.messageData);
                }
                if (channelTitle !== '' && channelTitle !== 'undefined' && !channels.error && channels.rows.length > 0 && (!MessageContents.messageData || (MessageContents.messageData && MessageContents.updateIndicators && MessageContents.updateIndicators === true))) {
                    channels.rows.forEach((ch) => {
                        const channel = discordClient.getChannel(ch.channel);
                        if (channel && channel.name !== channelTitle) {
                            discordClient.editChannel(ch.channel, { name: channelTitle}, "Status Update")
                                .catch((err) => {
                                    console.error(err.message)
                                    Logger.printLine("Discord", `Can't update channel "${channelName}" to "${channelTitle}"`, "error", err)
                                })
                        }
                    })
                } else if (!MessageContents.messageData) {
                    SendMessage("Failed to set status update, Channel was not registered or no message text was sent!", "warn", 'main', "Discord")
                }
                cb(true);
            } else {
                SendMessage("Failed to retrieve a proper channel name or text for status update", "err", 'main', "Discord", JSON.stringify(MessageContents))
                cb(true);
            }
        } else if (MessageContents.messageType === 'command') {
            let ChannelID = "" + MessageContents.messageChannelID.trim().split("\n").join('')
            const ChannelData = discordClient.getChannel(ChannelID)
            if ((typeof ChannelData).toString() === 'undefined') {
                SendMessage(`Failed to send message, Invalid Channel ID : ${ChannelID.toString().substring(0,128)} from ${MessageContents.fromClient}`, "err", 'main', "SendData")
                cb(true);
            } else {
                switch (MessageContents.messageAction) {
                    case 'RequestDownload':
                        console.log(MessageContents)
                        cb(true);
                        db.safe(`SELECT * FROM kanmi_records WHERE fileid = ? AND source = 0 LIMIT 1`, [MessageContents.itemFileUUID], function (err, filestatus) {
                            if (err) {
                                SendMessage("SQL Error occurred when retrieving the file status", "err", 'main', "SQL", err)
                            } else {
                                if (filestatus !== undefined && filestatus.length > 0 && filestatus[0].filecached !== 1) {
                                    jfsGetSF(MessageContents.itemFileUUID, {
                                        userID: 'none'
                                    })
                                } else {
                                    SendMessage(`Failed to get data required to request download : ${MessageContents.itemFileUUID}`, "err", 'main', "RequestDownload-Remote")
                                }
                            }
                        });
                        break;
                    case 'PinMessage':
                        cb(true);
                        addFavorite(ChannelID, MessageContents.messageID, ChannelData.guild.id)
                        break;
                    case 'UnPinMessage':
                        cb(true);
                        removeFavorite(ChannelID, MessageContents.messageID, ChannelData.guild.id)
                        break;
                    case 'MovePost':
                        if (MessageContents.messageData !== undefined && !isNaN(parseInt(MessageContents.messageData))) {
                            discordClient.getMessage(ChannelID, MessageContents.messageID)
                                .then(function(fullmsg) {
                                    (async () => {
                                        if ((PixivChannels.has(fullmsg.channel.id) || discordServers.get(fullmsg.guildID).chid_download === fullmsg.channel.id) && fullmsg.content.includes("**🎆 ") && fullmsg.content.includes("** : ***") && fullmsg.attachments.length > 0) {
                                            if (TwitterPixivLike.has(fullmsg.channel.id) || TwitterPixivLike.has(MessageContents.messageData)) {
                                                // **🎆 ${messageObject.author.name}** : ***${messageObject.title.replace('🎆 ', '')}${(messageObject.description) ? '\n' + messageObject.description : ''}***
                                                const foundMessage = await db.query(`SELECT * FROM pixiv_tweets WHERE id = ?`, [fullmsg.id])
                                                const artistName = fullmsg.content.split('** : ***')[0].split('**🎆').pop().trim();
                                                const sourceID = fullmsg.content.split('** : ***')[1].split('[').pop().split(']')[0].trim();
                                                if (foundMessage.error) {
                                                    SendMessage("SQL Error occurred when retrieving the previouly sent tweets for pixiv", "err", 'main', "SQL", foundMessage.error)
                                                } else if (foundMessage.rows.length === 0 && ((pixivaccount[0].like_taccount_nsfw !== null && fullmsg.channel.nsfw) || pixivaccount[0].like_taccount !== null)) {
                                                    await db.query(`INSERT INTO pixiv_tweets SET id = ?`, [fullmsg.id])
                                                    sendTwitterAction(`Artist: ${artistName}${(sourceID.length > 2) ? '\nSource: https://pixiv.net/en/artworks/' + sourceID : 'Source: Pixiv'}`, 'SendTweet', "send", [fullmsg.attachments[0]], MessageContents.messageData, fullmsg.guildID, []);
                                                }
                                                if (sourceID)
                                                    sendPixivAction(sourceID, 'Like', "add");
                                            }
                                        } else {
                                            const tweetMeta = await db.query(`SELECT listid, tweetid, userid FROM twitter_tweets WHERE channelid = ? AND messageid = ?`, [fullmsg.channel.id, fullmsg.id])
                                            if (tweetMeta.rows.length > 0 && TwitterCDSBypass.has(tweetMeta.rows[0].listid)) {
                                                sendTwitterAction(`https://twitter.com/${tweetMeta.rows[0].userid}/status/${tweetMeta.rows[0].tweetid}`, 'LikeRT', "add", undefined, MessageContents.messageData, fullmsg.guildID, [], tweetMeta.rows[0].listid);
                                            }
                                        }
                                    })().then(r => {})
                                    jfsMove(fullmsg, MessageContents.messageData, results => cb(results))
                                })
                                .catch((er) => {
                                    Logger.printLine("Discord", "Message was dropped, unable to get Message from Discord", "warn", er)
                                    cb(true);
                                })
                        } else {
                            cb(true);
                        }
                        break;
                    case 'RotatePost':
                        if (MessageContents.messageData !== undefined && !isNaN(parseInt(MessageContents.messageData))) {
                            discordClient.getMessage(ChannelID, MessageContents.messageID)
                                .then(function(fullmsg) {
                                    jfsRotate(fullmsg, MessageContents.messageData, function (results) {
                                        cb(true);
                                    })
                                })
                                .catch((er) => {
                                    Logger.printLine("Discord", "Message was dropped, unable to get Message from Discord", "warn", er)
                                    console.error(er)
                                    cb(true);
                                })
                        } else {
                            cb(true);
                        }
                        break;
                    case 'RenamePost':
                        if (MessageContents.messageData !== undefined) {
                            jfsRename(ChannelID, MessageContents.messageID, MessageContents.messageData, function (cb) {
                            })
                            cb(true);
                        } else {
                            cb(true);
                        }
                        break;
                    case 'ArchivePost':
                        discordClient.getMessage(ChannelID, MessageContents.messageID)
                            .then(function(fullmsg) {
                                db.safe(`SELECT * FROM discord_servers WHERE serverid = ?`, [ChannelData.guild.id], function (err, serverdata) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when retrieving the guild data", "err", 'main', "SQL", err)
                                        cb(true);
                                    } else {
                                        jfsArchive(fullmsg, serverdata[0])
                                        cb(true);
                                    }
                                })
                            })
                            .catch((er) => {
                                Logger.printLine("Discord", "Message was dropped, unable to get Message from Discord", "warn", er)
                                cb(true);
                            })
                        break;
                    case 'ActionPost':
                        if (MessageContents.messageIntent) {
                            switch (MessageContents.messageIntent) {
                                case "DefaultDownload":
                                    discordClient.getMessage(MessageContents.messageChannelID, MessageContents.messageID)
                                        .then(function(fullmsg) {
                                            downloadMessageFile(fullmsg, undefined, true)
                                            cb(true);
                                        })
                                        .catch(async (er) => {
                                            Logger.printLine("Discord", "Command was dropped, unable to get Message from Discord", "warn", er)
                                            console.error(er)
                                            if (er && er.message && er.message.includes('Unknown Message')) {
                                                await db.query(`DELETE FROM twitter_tweets WHERE messageid = ?`, [MessageContents.messageID])
                                            }
                                            cb(true);
                                        })
                                    break;
                                default:
                                    Logger.printLine("Discord", "Command was dropped, unable to take action on post because invalid intent was signaled", "warn", er)
                                    cb(true);
                                    break;
                            }
                        } else {
                            Logger.printLine("Discord", "Command was dropped, unable to take action on post because no intent was signaled", "warn", er)
                            cb(true);
                        }
                        break;
                    case 'RemovePost':
                        discordClient.getMessage(ChannelID, MessageContents.messageID)
                            .then(function(fullmsg) {
                                jfsRemove(fullmsg)
                                cb(true);
                            })
                            .catch((er) => {
                                Logger.printLine("Discord", "Message was dropped, unable to get Message from Discord", "warn", er)
                                db.safe(`DELETE FROM kanmi_records WHERE id = ? AND source = 0`, [MessageContents.messageID], function (err) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when saving to the message cache", "err", 'main', "SQL", err)
                                    }
                                })
                                cb(true);
                            })
                        break;
                    case 'CacheColor':
                        const messageData = await db.query(`SELECT id, channel, attachment_name, attachment_hash, cache_proxy FROM kanmi_records WHERE id = ? AND channel = ?`, [MessageContents.messageID, MessageContents.messageChannelID])
                        if (messageData.error) {
                            printLine('SQL', `Failed to get message from database for ${MessageContents.messageID}`, 'error');
                            cb(false);
                        } else if (messageData.rows.length > 0 && messageData.rows[0].cache_proxy) {
                            await cacheColor(MessageContents.messageID, `${(!messageData.rows[0].cache_proxy.startsWith('http') ? 'https://cdn.discordapp.com/attachments/' : '')}${messageData.rows[0].cache_proxy}`)
                            cb(true);
                        } else if (messageData.rows.length > 0 && messageData.rows[0].attachment_hash) {
                            await cacheColor(MessageContents.messageID, `https://cdn.discordapp.com/attachments/` + ((messageData.rows[0].attachment_hash.includes('/')) ? messageData.rows[0].attachment_hash : `${messageData.rows[0].channel}/${messageData.rows[0].attachment_hash}/${messageData.rows[0].attachment_name}`))
                            cb(true);
                        } else {
                            Logger.printLine("Discord", `Unable to cache item ${MessageContents.messageID}!`, "warn")
                            cb(true);
                        }
                        break;
                    case 'CacheImage':
                    case 'CacheVideo':
                        discordClient.getMessage(ChannelID, MessageContents.messageID)
                            .then(async function(message) {
                                if (message.attachments.length > 0 && message.attachments[0].filename.split('.').length > 1 && accepted_cache_types.indexOf(message.attachments[0].filename.split('.').pop().toLowerCase()) !== -1) {
                                    Logger.printLine("Polyfill", `Need to download ${message.attachments[0].url}`, "debug", message.attachments[0])
                                    request.get({
                                        url: message.attachments[0].url,
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
                                    }, function (err, res, body) {
                                        if (err) {
                                            SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Polyfill", err)
                                            cb(true);
                                        } else if (!body || (body && body.length < 100) ) {
                                            SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Polyfill")
                                            cb(true);
                                        } else {
                                            try {
                                                const image = Buffer.from(body);
                                                const dimensions = sizeOf(image);
                                                const scaleSize = 512;
                                                let resizeParam = {
                                                    fit: sharp.fit.inside,
                                                    withoutEnlargement: true
                                                }
                                                if (dimensions.width > dimensions.height) { // Landscape Resize
                                                    resizeParam.width = scaleSize
                                                } else { // Portrait or Square Image
                                                    resizeParam.height = scaleSize
                                                }
                                                sharp(image)
                                                    .resize(resizeParam)
                                                    .toFormat('jpeg', {
                                                        quality: 50
                                                    })
                                                    .withMetadata()
                                                    .toBuffer((err, previewBuffer) => {
                                                        if (err || !previewBuffer) {
                                                            SendMessage(`Failed to render cache image for ${message.id}`, "err", message.guildID, "Polyfill", err)
                                                            cb(true);
                                                        } else {
                                                            db.safe(`SELECT discord_servers.chid_filecache FROM kanmi_channels, discord_servers WHERE kanmi_channels.channelid = ? AND discord_servers.serverid = kanmi_channels.serverid AND kanmi_channels.source = 0`, [ChannelID], function (err, serverdata) {
                                                                if (err || serverdata.length === 0) {
                                                                    SendMessage("SQL Error occurred when retrieving the guild data", "err", 'main', "SQL", err)
                                                                    cb(true);
                                                                } else {
                                                                    discordClient.createMessage(serverdata[0].chid_filecache.toString(), '', {
                                                                        file: previewBuffer,
                                                                        name: `${message.attachments[0].filename.trim().replace(/[/\\?%*:|"<> ]/g, '_').split('.')[0]}-t9-preview.jpg`
                                                                    })
                                                                        .then((data) => {
                                                                            cacheColor(message.id, data.attachments[0].proxy_url)
                                                                            db.safe(`UPDATE kanmi_records SET cache_proxy = ? WHERE id = ? AND source = 0`, [data.attachments[0].url.split('/attachments').pop(), message.id], (err, result) => {
                                                                                if (err) {
                                                                                    SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                                } else {
                                                                                    db.safe(`INSERT INTO discord_cache VALUES (?,?) ON DUPLICATE KEY UPDATE cache = ?`, [message.id, data.id, data.id], (err, cacheResults) => {
                                                                                        if (err) {
                                                                                            SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                                        } else {
                                                                                            Logger.printLine("Discord", `Cached Image for ${message.id} to ${data.id}`, "info")
                                                                                        }
                                                                                    })
                                                                                }
                                                                            })
                                                                            cb(true);
                                                                        })
                                                                        .catch((er) => {
                                                                            Logger.printLine("Discord", "Unable to send cache item!", "warn", er)
                                                                            cb(true);
                                                                        })
                                                                }
                                                            });
                                                        }
                                                    })
                                            } catch (err) {
                                                Logger.printLine("Discord", "Unable to send cache item!", "warn", err)
                                                cb(true);
                                            }
                                        }
                                    })
                                } else if (MessageContents.messageAction === 'CacheVideo') {
                                    let url
                                    function generatePreview() {
                                        console.log(url)
                                        request.get({
                                            url: url,
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
                                        }, function (err, res, body) {
                                            if (err) {
                                                SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Polyfill", err)
                                                cb(true);
                                            } else if (!body || (body && body.length < 100) ) {
                                                SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Polyfill")
                                                cb(true);
                                            } else {
                                                try {
                                                    function deleteFile(file, ready){
                                                        fs.open(file, 'r+', function (err, fd) {
                                                            if (err && (err.code === 'EBUSY' || err.code === 'ENOENT')){
                                                                ready(false)
                                                            } else {
                                                                fs.close(fd, function() {
                                                                    fs.unlink(file, function (err) {})
                                                                    ready(true)
                                                                })
                                                            }
                                                        })
                                                    }
                                                    function previewVideo(fulfill) {
                                                        return new Promise(function (fulfill) {
                                                            const outputfile = path.join(systemglobal.TempFolder, 'TEMPPREVIEW-' +  + MessageContents.messageID + '.jpg');
                                                            const inputfile = path.join(systemglobal.TempFolder, 'TEMPVIDEO-' + MessageContents.messageID)
                                                            fs.writeFile(inputfile, Buffer.from(body), "base64", err => {
                                                                if (err) {
                                                                    fulfill(null)
                                                                    console.error(err)
                                                                } else {
                                                                    const spawn = require('child_process').spawn;
                                                                    let ffmpegParam = ['-hide_banner', '-y', '-ss', '0.25', '-i', path.resolve(inputfile).toString(), '-f', 'image2', '-vframes', '1', path.resolve(outputfile).toString()]
                                                                    console.log("[FFMPEG] Getting Preview Image...")
                                                                    const child = spawn(EncoderConf.Exec, ffmpegParam);
                                                                    child.stdout.setEncoding('utf8');
                                                                    child.stdout.on('data', function (data) {
                                                                        console.log(data);
                                                                    });
                                                                    child.stderr.setEncoding('utf8');
                                                                    child.stderr.on('data', function (data) {
                                                                        console.log(data);
                                                                    });
                                                                    child.on('close', function (code) {
                                                                        if (code === 0 && fileSize(outputfile) > 0.00001) {
                                                                            try {
                                                                                const output = fs.readFileSync(outputfile, {encoding: 'base64'})
                                                                                deleteFile(outputfile, function (ready) {
                                                                                    // Do Nothing
                                                                                })
                                                                                deleteFile(inputfile, function (ready) {
                                                                                    // Do Nothing
                                                                                })
                                                                                fulfill(output);
                                                                            } catch (err) {
                                                                                mqClient.sendMessage("Failed to generate preview image due to FFMPEG error!", "info")
                                                                                fulfill(null);
                                                                            }
                                                                        } else {
                                                                            mqClient.sendMessage("Failed to generate preview image due to FFMPEG error!", "info")
                                                                            deleteFile(outputfile, function (ready) {
                                                                                // Do Nothing
                                                                            })
                                                                            deleteFile(inputfile, function (ready) {
                                                                                // Do Nothing
                                                                            })
                                                                            fulfill(null)
                                                                        }
                                                                    });
                                                                }
                                                            })
                                                        })
                                                    }
                                                    previewVideo()
                                                        .then((imageFulfill) => {
                                                            if (imageFulfill !== null) {
                                                                db.safe(`SELECT discord_servers.chid_filecache
                                                                     FROM kanmi_channels,
                                                                          discord_servers
                                                                     WHERE kanmi_channels.channelid = ?
                                                                       AND discord_servers.serverid = kanmi_channels.serverid
                                                                       AND kanmi_channels.source = 0`, [ChannelID], function (err, serverdata) {
                                                                    if (err || serverdata.length === 0) {
                                                                        SendMessage("SQL Error occurred when retrieving the guild data", "err", 'main', "SQL", err)
                                                                        cb(true);
                                                                    } else {
                                                                        discordClient.createMessage(serverdata[0].chid_filecache.toString(), '', {
                                                                            file: Buffer.from(imageFulfill, 'base64'),
                                                                            name: `${message.id}-t9-preview-video.jpg`
                                                                        })
                                                                            .then((data) => {
                                                                                cacheColor(message.id, data.attachments[0].proxy_url)
                                                                                db.safe(`UPDATE kanmi_records
                                                                                     SET cache_proxy = ?
                                                                                     WHERE id = ?
                                                                                       AND source = 0`, [data.attachments[0].proxy_url.split('/attachments').pop(), message.id], (err, result) => {
                                                                                    if (err) {
                                                                                        SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                                    } else {
                                                                                        db.safe(`INSERT INTO discord_cache
                                                                                             VALUES (?, ?) ON DUPLICATE KEY
                                                                                             UPDATE cache = ?`, [message.id, data.id, data.id], (err, cacheResults) => {
                                                                                            if (err) {
                                                                                                SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                                            } else {
                                                                                                Logger.printLine("Discord", `Cached Image for ${message.id} to ${data.id}`, "info")
                                                                                            }
                                                                                        })
                                                                                    }
                                                                                })
                                                                                cb(true);
                                                                            })
                                                                            .catch((er) => {
                                                                                mqClient.sendData(systemglobal.FileWorker_In, {
                                                                                    messageReturn: false,
                                                                                    messageID: message.id,
                                                                                    messageAction: 'GenerateVideoPreview',
                                                                                    messageType: 'command'
                                                                                }, function (ok) {
                                                                                    if (ok) {
                                                                                        Logger.printLine("Discord", "Unable to send cache item! Passing job to FileWorker...", "warn", er)
                                                                                        cb(true);
                                                                                    } else {
                                                                                        Logger.printLine("Discord", "Unable to send cache item!", "warn", er)
                                                                                        cb(true);
                                                                                    }
                                                                                })

                                                                                console.log(er);
                                                                                cb(true);
                                                                            })
                                                                    }
                                                                });
                                                            } else {
                                                                mqClient.sendData(systemglobal.FileWorker_In, {
                                                                    messageReturn: false,
                                                                    messageID: message.id,
                                                                    messageAction: 'GenerateVideoPreview',
                                                                    messageType: 'command'
                                                                }, function (ok) {
                                                                    if (ok) {
                                                                        Logger.printLine("Polyfill", "No preview was generated to send for this video! Passing job to FileWorker...", "warn")
                                                                        cb(true);
                                                                    } else {
                                                                        Logger.printLine("Polyfill", "No preview was generated to send for this video!", "warn")
                                                                        cb(true);
                                                                    }
                                                                })
                                                            }
                                                        })
                                                        .catch((err) => {
                                                            mqClient.sendData(systemglobal.FileWorker_In, {
                                                                messageReturn: false,
                                                                messageID: message.id,
                                                                messageAction: 'GenerateVideoPreview',
                                                                messageType: 'command'
                                                            }, function (ok) {
                                                                if (ok) {
                                                                    Logger.printLine("Polyfill", "Failed to generate a valid thumbnail for video! Passing job to FileWorker...", "warn", err)
                                                                    cb(true);
                                                                } else {
                                                                    Logger.printLine("Polyfill", "Failed to generate a valid thumbnail for video!", "warn", err)
                                                                    cb(true);
                                                                }
                                                            })
                                                            console.log(err);
                                                        })
                                                } catch (err) {
                                                    Logger.printLine("Discord", "Unable to send cache item!", "warn", err)
                                                    cb(true);
                                                }
                                            }
                                        })
                                    }
                                    if (message.attachments.length > 0 && message.attachments[0].filename.split('.').length > 1 && accepted_video_types.indexOf(message.attachments[0].filename.split('.').pop().toLowerCase()) !== -1) {
                                        url = message.attachments[0].url;
                                        Logger.printLine("Polyfill", `File preview available, Need to download ${url}...`, "debug")
                                        generatePreview();
                                    } else {
                                        const filedata = await db.query(`SELECT fileid, filecached FROM kanmi_records WHERE kanmi_records.id = ?`, [message.id])
                                        if (filedata.error) {
                                            SendMessage("SQL Error occurred when retrieving the message for message data", "err", 'main', "SQL", filedata.error)
                                            cb(true)
                                        } else if (filedata.rows.length > 0 && filedata.rows[0].filecached === 1) {
                                            mqClient.sendData(systemglobal.FileWorker_In, {
                                                messageReturn: false,
                                                messageID: message.id,
                                                messageAction: 'GenerateVideoPreview',
                                                messageType: 'command'
                                            }, function (ok) {
                                                if (ok) {
                                                    Logger.printLine("Polyfill", "File is cached elsewhere, Passing job to FileWorker...", "warn")
                                                    cb(true);
                                                } else {
                                                    Logger.printLine("Polyfill", "Failed to send request to FileWorker!", "warn")
                                                    cb(true);
                                                }
                                            })
                                        } else if (filedata.rows.length > 0 && filedata.rows[0].fileid !== null) {
                                            const fileparts = await db.query(`SELECT url, fileid FROM discord_multipart_files WHERE fileid = ? ORDER BY url`, [filedata.rows[0].fileid])
                                            if (fileparts.error) {
                                                SendMessage("SQL Error occurred when retrieving the message for message data", "err", 'main', "SQL", fileparts.error)
                                            } else if (fileparts.rows.length > 0) {
                                                Logger.printLine("Polyfill", `File has not preview, attempting to raw read a part of the file...`, "debug")
                                                url = fileparts.rows[0].url;
                                                Logger.printLine("Polyfill", `Need to download ${url}...`, "debug")
                                                generatePreview();
                                            } else {
                                                Logger.printLine("Polyfill", "Can't find the parts for this file!", "error");
                                                cb(true)
                                            }
                                        } else {
                                            Logger.printLine("Polyfill", "No video contents were found for that message!", "error");
                                            cb(true)
                                        }
                                    }
                                } else {
                                    cb(true);
                                }
                            })
                            .catch((er) => {
                                Logger.printLine("Discord", "Message was dropped, unable to get Message from Discord", "warn", er)
                                console.error(er)
                                cb(true);
                            })
                        break;
                    case 'ReplaceContent':
                        Logger.printLine("UpdateContent", `Replacing Content for ${MessageContents.messageID}...`, "debug")
                        const messageRecord = await db.query(`SELECT * FROM kanmi_records WHERE id = ? AND channel = ? AND server = ?`, [MessageContents.messageID, MessageContents.messageChannelID, MessageContents.messageServerID])
                        if (messageRecord.error) {
                            SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", messageRecord.error)
                            cb(false);
                        } else if (messageRecord.rows.length > 0) {
                            if (MessageContents.itemCacheData && MessageContents.itemCacheName && (MessageContents.itemCacheType || MessageContents.itemCacheType === 0)) {
                                db.safe(`SELECT discord_servers.chid_filecache FROM kanmi_channels, discord_servers WHERE kanmi_channels.channelid = ? AND discord_servers.serverid = kanmi_channels.serverid AND kanmi_channels.source = 0`, [MessageContents.messageChannelID], function (err, serverdata) {
                                    if (err || serverdata.length === 0) {
                                        SendMessage("SQL Error occurred when retrieving the guild data", "err", 'main', "SQL", err)
                                        cb(true);
                                    } else {
                                        switch (MessageContents.itemCacheType) {
                                            case 0:
                                                discordClient.createMessage(serverdata[0].chid_filecache.toString(), '', {
                                                    name: MessageContents.itemCacheName,
                                                    file: Buffer.from(MessageContents.itemCacheData, 'base64')
                                                })
                                                    .then((data) => {
                                                        cacheColor(MessageContents.messageID, data.attachments[0].proxy_url)
                                                        db.safe(`UPDATE kanmi_records SET cache_proxy = ? WHERE id = ? AND source = 0`, [data.attachments[0].proxy_url.split('/attachments').pop(), MessageContents.messageID], (err, result) => {
                                                            if (err) {
                                                                SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                cb(false);
                                                            } else {
                                                                db.safe(`INSERT INTO discord_cache VALUES (?, ?) ON DUPLICATE KEY UPDATE cache = ?`, [MessageContents.messageID, data.id, data.id], (err, cacheResults) => {
                                                                    if (err) {
                                                                        SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                        cb(false);
                                                                    } else {
                                                                        Logger.printLine("Discord", `Cached Files for ${MessageContents.messageID} to ${data.id}`, "info")
                                                                        cb(true);
                                                                    }
                                                                })
                                                            }
                                                        });
                                                    })
                                                    .catch((err) => {
                                                        Logger.printLine("Polyfill", "Failed to upload new content file!", "warn", err)
                                                        console.log(err);
                                                        cb(true);
                                                    })
                                                break;
                                            case 1:
                                                discordClient.createMessage(serverdata[0].chid_filecache.toString(), '', {
                                                    name: MessageContents.itemCacheName,
                                                    file: Buffer.from(MessageContents.itemCacheData, 'base64')
                                                })
                                                    .then((data) => {
                                                        cacheColor(MessageContents.messageID, data.attachments[0].proxy_url)
                                                        let filename
                                                        let filehash
                                                        const urlParts = data.attachments[0].url.split(`https://cdn.discordapp.com/attachments/`)
                                                        if (urlParts.length === 2) {
                                                            filehash = (urlParts[1].startsWith(`${data.channel.id}/`)) ? urlParts[1].split('/')[1] : urlParts[1];
                                                            filename = urlParts[1].split('/')[2]
                                                        } else {
                                                            filehash = data.attachments[0].url
                                                            filename = data.attachments[0].filename
                                                        }
                                                        db.safe(`UPDATE kanmi_records SET attachment_hash = ?, attachment_name = ? WHERE id = ? AND source = 0`, [filehash, filename, MessageContents.messageID], (err, result) => {
                                                            if (err) {
                                                                SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", err)
                                                                cb(false);
                                                            } else {
                                                                Logger.printLine("Discord", `Updated Attachments for ${MessageContents.messageID} to ${data.id}`, "info")
                                                                cb(true);
                                                            }
                                                        });
                                                    })
                                                    .catch((err) => {
                                                        Logger.printLine("Polyfill", "Failed to upload new content file!", "warn", err)
                                                        console.log(err);
                                                        cb(true);
                                                    })
                                                break;
                                            default:
                                                Logger.printLine("Discord", "Message was dropped, No data type!", "warn")
                                                cb(true);
                                                break;
                                        }
                                    }
                                });
                            } else {
                                Logger.printLine("Discord", "Message was dropped, No data was defined!", "error")
                                cb(true);
                            }
                        } else {
                            Logger.printLine("Discord", "Message was dropped, No records were found!", "error")
                            cb(true);
                        }
                        break;
                    case 'ValidateMessage':
                        if (MessageContents.messageID) {
                            try {
                                const message = await discordClient.getMessage(MessageContents.messageChannelID, MessageContents.messageID)
                                if (message) {
                                    Logger.printLine("validateMessage", `Successfully found message ${MessageContents.messageID}, Updating database`,"info")
                                    messageUpdate(message)
                                } else {
                                    SendMessage(`Failed to validate message ${MessageContents.messageID}, It no longer exists`, "validateMessage", 'main', "error")
                                    messageDelete({
                                        id: MessageContents.messageID,
                                        channel: {
                                            id: MessageContents.messageChannelID
                                        },
                                        guild: {
                                            id: MessageContents.messageServerID
                                        },
                                        guildID: MessageContents.messageServerID
                                    })
                                }
                            } catch (e) {
                                SendMessage(`Failed to validate message ${MessageContents.messageID}`, "validateMessage", 'main', "error")
                                console.log(e)
                            }
                        } else {
                            SendMessage("No Message ID was provided to validate", "validateMessage", 'main', "warn")
                        }
                        cb(true)
                        break;
                    default:
                        SendMessage("No Matching Command for " + MessageContents.messageAction, "Command", ChannelData.guild.id, "warn")
                        if (MessageContents.messageReturn === true) {
                            mqClient.sendData(MessageContents.fromClient, failcase, function (ok) {

                            });
                        }
                        cb(true);
                        break;
                }
            }
        } else {
            let DestinationChannelID = "" + MessageContents.messageChannelID.trim().split("\n").join('')
            async function sendToBin(error) {
                const BinChannelData = discordClient.getChannel(systemglobal.Discord_Recycling_Bin);
                if (BinChannelData && BinChannelData.name) {
                    SendMessage(`Undeliverable Channel : ${DestinationChannelID.toString().substring(0,128)} (${error}), Redirecting to Recycling Bin`, "err", 'main', "SendData");
                    if (await createMessage(MessageContents, systemglobal.Discord_Recycling_Bin, BinChannelData, level)) {
                        cb(true)
                    } else {
                        SendMessage(`Failed to write to Recycling Bin - Message was dropped!`, "error", 'main', "SendData");
                        mqClient.sendData(MQWorker10, MessageContents, (ok) => cb(ok));
                    }
                } else {
                    SendMessage(`Undeliverable Channel : ${DestinationChannelID.toString().substring(0,128)} (Not Readable) & Recycling Bin is not Accessible!, Message Retrying!`, "err", 'main', "SendData");
                    mqClient.sendData(MQWorker10, MessageContents, (ok) => cb(ok));
                }
            }

            const ChannelData = discordClient.getChannel(DestinationChannelID);
            if (ChannelData && ChannelData.name) {
                if (await createMessage(MessageContents, DestinationChannelID, ChannelData, level)) {
                    cb(true)
                } else {
                    if (systemglobal.Discord_Recycling_Bin) {
                        await sendToBin(`Not Writable`);
                    } else {
                        SendMessage(`Undeliverable Channel : ${DestinationChannelID.toString().substring(0,128)} (Not Writable), Message will be dropped!`, "err", 'main', "SendData");
                        mqClient.sendData(MQWorker10, MessageContents, (ok) => cb(ok));
                    }
                }
            } else if (systemglobal.Discord_Recycling_Bin) {
                await sendToBin("Not Readable");
            } else {
                SendMessage(`Undeliverable Channel : ${DestinationChannelID.toString().substring(0,128)} (Not Readable), Message will be dropped!`, "err", 'main', "SendData");
                mqClient.sendData(MQWorker10, MessageContents, (ok) => cb(ok));
            }
        }
    }
    async function addEmojisToMessage(msg, reactions) {
        await activeTasks.set(`ADDBTN_${msg.id}`, { started: Date.now().valueOf() });
        let emojis = []
        let success = false;
        const _extraNames = discordautoreact.filter(e => e.channelid === msg.channel.id).map(e => e.emoji_name.toString())
        if (addClearButton.indexOf(msg.channel.id) !== -1 || tempThread.has(msg.channel.id))
            emojis.push(...discordreact.filter(e => e.reaction_name === 'Clear' && e.serverid === msg.guildID ).map(e => (e.reaction_custom !== null) ? e.reaction_custom.toString() : e.reaction_emoji.toString()))
        if (msg.channel.id === systemglobal.Discord_Recycling_Bin)
            emojis.push(...discordreact.filter(e => e.reaction_name === 'DeleteFile' && e.serverid === msg.guildID ).map(e => (e.reaction_custom !== null) ? e.reaction_custom.toString() : e.reaction_emoji.toString()))
        emojis.push(
            ...discordreact.filter(e => e.serverid === msg.guildID && reactions.indexOf(e.reaction_name) !== -1 && !(systemglobal.Discord_FSMgr_Enable === false && (e.reaction_name=== 'Pin' || e.reaction_name=== 'Archive' || e.reaction_name=== 'MoveMessage'))).map(e => (e.reaction_custom !== null) ? e.reaction_custom.toString() : e.reaction_emoji.toString()),
            ...discordreact.filter(e => _extraNames.indexOf(e.reaction_name) !== -1 || (tempThread.has(msg.channel.id) && systemglobal.CMS_New_Thread_Reactions && systemglobal.CMS_New_Thread_Reactions.indexOf(e.reaction_name) !== -1)).map(e => (e.reaction_custom !== null) ? e.reaction_custom.toString() : e.reaction_emoji.toString())
        )
        emojis.map(async e => {
            try {
                await discordClient.addMessageReaction(msg.channel.id, msg.id, e);
                success = true;
            } catch (e) {
                SendMessage(`Error adding emotes to post! - ${e.message}`, "warn", "main", "Send", e);
            }
        })
        activeTasks.delete(`ADDBTN_${msg.id}`);
        return success;
    }
    async function createMessage(MessageContents, ChannelID, ChannelData, level) {
        if (Timers.has('taskSend'))
            clearTimeout(Timers.get('taskSend'))
        const _startTime = Date.now().valueOf()
        await activeTasks.set('SEND_MESSAGE', { started: _startTime, details: ChannelID });
        const scaleSize = 512;
        let resizeParam = {
            fit: sharp.fit.inside,
            withoutEnlargement: true
        }
        let preview = false;
        const contents = {
            content: (MessageContents.messageText && MessageContents.messageText.trim().length > 0) ? MessageContents.messageText.trim() : undefined,
            embed: (MessageContents.messageObject) ? MessageContents.messageObject : undefined,
            tts: (MessageContents.messageTTS)
        };
        // Generate File Array or Object
        const files = await (async () => {
            if (MessageContents.itemFileArray) {
                return MessageContents.itemFileArray.slice(0,4).map((e,i) => {
                    if (e.fileName.includes('-t9-preview-video')) {
                        preview = i
                    }
                    return {
                        file: Buffer.from(e.fileData, 'base64'),
                        name: e.fileName
                    }
                })
            } else if (MessageContents.itemFileData) {
                return {
                    file: Buffer.from(MessageContents.itemFileData, 'base64'),
                    name: (MessageContents.itemFileName) ? MessageContents.itemFileName : 'unknown'
                }
            } else {
                return undefined
            }
        })();
        // Generate Message Type String
        const typeText = (() => {
            let _typeText = [];
            if (files && files.length > 0) {
                if (files.length > 2 && preview) {
                    _typeText.push(`📁[${files.length - 1}]🖼`); }
                else if (files.length > 1 && preview) {
                    _typeText.push(`💾🖼`);
                } else if (files.length > 1) {
                    _typeText.push(`📁[${files.length}]`);
                } else {
                    _typeText.push(`💾`);
                }
            }
            if (contents.content) { _typeText.push('📄'); }
            if (contents.embed && contents.embed.length > 1) {
                _typeText.push(`📙[${contents.embed.length}]`)
            } else if (contents.embed) {
                _typeText.push('📙');
            }
            if (contents.tts) { _typeText.push('📞') }
            return _typeText.join('');
        })()

        discordClient.editStatus( "online", {
            name: 'Sending Data...',
            type: 0
        });
        let success = false;
        try {
            const data = await discordClient.createMessage(ChannelID, contents, files);
            if (data && data.id) {
                // Is this a spanned file part?
                if (MessageContents.fileUUID) {
                    const fileUUID = MessageContents.fileUUID // Get File UUID
                    const partN = parseInt(MessageContents.filePartN) + 1
                    const partTotal = parseInt(MessageContents.filePartTotal)
                    let hash = null
                    if (Array.isArray(files)) {
                        hash = md5(files[0].file);
                    } else {
                        hash = md5(files.file);
                    }
                    const addedPartToDB = await db.query(`INSERT INTO discord_multipart_files SET messageid = ?, channelid = ?, serverid = ?, fileid = ?, url = ?, hash = ?, valid = 1`, [data.id, ChannelID, data.member.guild.id, fileUUID, data.attachments[0].url, hash])
                    if (addedPartToDB.error) {
                        SendMessage("SQL Error occurred when saving a Spanned File parts records", "crit",  'main', "SQL", addedPartToDB.error)
                    } else {
                        Logger.printLine("SF-Capture", `Saving File Part, ${partN} of ${partTotal} for ${fileUUID} via ${data.id}`, "debug", {
                            messageID: data.id,
                            fileUUID: fileUUID,
                            fileURL: data.attachments[0].url,
                            hash: hash,
                            partN: partN,
                            total: partTotal
                        })
                    }
                }
                // Add Reaction Buttons
                if (MessageContents.addButtons)
                    await addEmojisToMessage(data, Array.from(MessageContents.addButtons));
                if (MessageContents.messageRefrance && MessageContents.messageRefrance.action && MessageContents.messageRefrance.action === 'jfsMove' ) {
                    await messageUpdate(data, MessageContents.messageRefrance)
                } else if (MessageContents.messageOriginalID && MessageContents.fromClient.includes('return.Sequenzia.Polyfills.')) {
                    const updatedMessage = await db.query(`UPDATE kanmi_records SET cache_proxy = ? WHERE id = ?`, [data.attachments[0].proxy_url.split('/attachments').pop(), MessageContents.messageOriginalID])
                    if (updatedMessage.error) {
                        SendMessage("SQL Error occurred when adding polyfills to the message cache", "err", 'main', "SQL", updatedMessage.error)
                    } else {
                        await db.query(`INSERT INTO discord_cache VALUES (?,?) ON DUPLICATE KEY UPDATE cache = ?`, [MessageContents.messageOriginalID, data.id, data.id])
                    }
                } else {
                    const colorSearchFormats = ['png', 'jpg', 'jpeg', 'gif']
                    let _color = undefined
                    if (files) {
                        const fileItem = (Array.isArray(files)) ? files[0] : files
                        if (colorSearchFormats.indexOf(fileItem.name.split('.').pop().toLowerCase()) !== -1) {
                            try {
                                _color = await getAverageColor(fileItem.file, {mode: 'precision'})
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }

                    await messageCreate(data, {
                        forceAdd: true,
                        preview: (preview) ? preview : undefined,
                        timestamp: (MessageContents.itemDateTime) ? MessageContents.itemDateTime : undefined,
                        userID: (MessageContents.messageUserID) ? MessageContents.messageUserID : undefined,
                        color: _color,
                        size: (MessageContents.itemSize) ? MessageContents.itemSize : undefined,
                        logLine: `Send Message: (${level}) Type: [${typeText}], From: ${MessageContents.fromClient}, To ${(ChannelData && (ChannelData.type === 11 || ChannelData.type === 12)) ? 'Thread' : 'Channel'}: ${(ChannelData) ? '"' + ChannelData.name.toString().substring(0,128) + '" ' + ChannelID + '' : ChannelID}${(ChannelData && ChannelData.guild && ChannelData.guild.name) ? '@' + ChannelData.guild.name : ''}`,
                        fileData: (MessageContents.fileData) ? MessageContents.fileData : undefined,
                    })
                    success = true;
                }
                // Pin this message?
                if (MessageContents.pinned || tempThread.has(ChannelID) || (data.embeds.length > 0 && data.embeds[0].title && (data.embeds[0].title.includes('📨 Tweet') ||data.embeds[0].title.includes('✳ Retweet') || (data.embeds[0].title.includes('🎆 '))))) {
                    try {
                        const m = await discordClient.getMessages(ChannelID, 10)
                        if (m.length === 0)
                            await discordClient.pinMessage(ChannelID, data.id)
                    } catch (e) {
                        Logger.printLine("Discord", "Error checking channel message count for first pinning", "warning", e);
                    }
                }
                if (MessageContents.tweetMetadata) {
                    try {
                        const addTweet = await db.query(`INSERT INTO twitter_tweets SET ?`, [{
                            messageid: data.id,
                            channelid: data.channel.id,
                            listid: MessageContents.tweetMetadata.list,
                            tweetid: MessageContents.tweetMetadata.id,
                            userid: MessageContents.tweetMetadata.userId
                        }])
                    } catch (e) {
                        Logger.printLine("Discord", "Failed to save tweet to database", "warning", e);
                    }
                }
            }
        } catch (er) {
            SendMessage(`Failed to send message to discord - ${er.message}`, "err", "main", "Send", er.message)
            if (!(er.message.includes("empty message") || er.message.includes(" entity too large") || er.message.includes("Invalid") || er.message.includes("No content") || er.message.includes("not supported")))
                success = true;

        }
        Timers.set('taskSend', setTimeout(() => { activeTasks.delete('SEND_MESSAGE'); }))
        return (success)
    }
    function playStation(connection, command) {
        function playSong() {
            function playID(trackKey) {
                nowPlaying.getItem(trackKey)
                    .then(function(track) {
                        connection.play(path.join(systemglobal.RadioFolder, track.musicbox, track.file))
                        localParameters.setItem('player-' + connection.id, {
                            status: 'on',
                            key: trackKey,
                            channel: connection.channelID,
                        })
                            .then(function () {
                                playingStatus.set(connection.id, true);
                            })
                            .catch(function (err) {
                                Logger.printLine(`Musicbox`, `Failed to set play status`, `error`, err)
                            })
                        SendMessage(`Now playing **${track.file}**`, "info", connection.id, "Radio");
                    })
            }
            if (command === "restart") {
                localParameters.getItem('player-' + connection.id)
                    .then(function (values) {
                        playID(values.key)
                        command = null
                    })
                    .catch(function (err) {
                        Logger.printLine(`Musicbox`, `Failed to get last track`, `error`, err)
                    })
            } else {
                nowPlaying.keys()
                    .then(function(keys) {
                        if (keys.length > 0) {
                            const guildkeys = filterItems(keys, connection.id + '-')
                            const song = guildkeys[Math.floor(Math.random() * keys.length)];
                            playID(song)
                        }
                    })
                    .catch(function (err) {
                        Logger.printLine(`Musicbox`, `Failed to get track keys`, `error`, err)
                    })
            }
        }
        playSong()
        connection.on("end", () => {
            nowPlaying.valuesWithKeyMatch(connection.id + '-')
                .then(function (items) {
                    if (parseInt(items.length.toString()) === 0) {
                        discordClient.leaveVoiceChannel(connection.channelID)
                        localParameters.setItem('player-' + connection.id, {
                            status: 'off',
                            key: '',
                            channel: '',
                        })
                            .then(function () {
                                playingStatus.set(connection.id, false);
                            })
                            .catch(function (err) {
                                SendMessage("❌ Failed to set player status", "system", connection.id, "Musicbox")
                                Logger.printLine(`Musicbox`, `Failed to set play status`, `error`, err)
                            })
                    } else {
                        localParameters.getItem('player-' + connection.id)
                            .then(function (values) {
                                nowPlaying.removeItem(values.key)
                                    .then(function () {
                                        playSong()
                                    })
                                    .catch(function (err) {
                                        Logger.printLine(`Musicbox`, `Failed to remove played track`, `error`, err)
                                    })
                            })
                            .catch(function (err) {
                                Logger.printLine(`Musicbox`, `Failed to get last track`, `error`, err)
                            })

                    }
                })
        });
    }
    function registerCommands() {
        discordClient.registerCommand("jfs", async (msg,args) => {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    function collector() {
                        switch (args[1].toLowerCase()) {
                            case 'enable':
                                if (collectorEnable.has(msg.guildID)) {
                                    messsageCollector.keys()
                                        .then(function (results) {
                                            const count = filterItems(results, msg.guildID + '-').length
                                            if (collectorEnable.get(msg.guildID)) {
                                                if (count === 0) {
                                                    SendMessage(`⚠️ Collector already enabled`, "system", msg.guildID, "Collector")
                                                } else {
                                                    SendMessage(`⚠️ Collector already enabled, with ${count} Message in Collector`, "system", msg.guildID, "Collector")
                                                }
                                            } else {
                                                localParameters.setItem('collector-' + msg.guildID, {
                                                    status: 'on'
                                                })
                                                    .then(function () {
                                                        if (count === 0) {
                                                            SendMessage(`📂 Message Collector is ready!`, "system", msg.guildID, "Collector")
                                                        } else {
                                                            SendMessage(`✅ Message Collector Enabled! ${count} Messages in Collector`, "system", msg.guildID, "Collector")
                                                        }
                                                        collectorEnable.set(msg.guildID, true)
                                                    })
                                                    .catch(function (err) {
                                                        SendMessage("❌ Failed to enable collector", "system", msg.guildID, "Collector")
                                                        Logger.printLine(`Collector`, `Failed to enable the message collector`, `error`, err)
                                                        collectorEnable.set(msg.guildID, false)
                                                    })
                                            }
                                        })
                                        .catch(function (err) {
                                            SendMessage(`❌ Error retrieving the items in the collector!`, `system`, msg.guildID, "Collector")
                                            Logger.printLine(`Collector`, `Failed retrieving the items in the collector`, `error`, err)
                                        })
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `system`, msg.guildID, "Collector")
                                    Logger.printLine(`Collector`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'disable':
                                if (collectorEnable.has(msg.guildID)) {
                                    messsageCollector.keys()
                                        .then(function (results) {
                                            const count = filterItems(results, msg.guildID + '-').length
                                            if (collectorEnable.get(msg.guildID)) {
                                                localParameters.setItem('collector-' + msg.guildID, {
                                                    status: 'off'
                                                })
                                                    .then(function () {
                                                        if (count === 0) {
                                                            SendMessage(`❎ Collector was disabled`, "system", msg.guildID, "Collector")
                                                        } else {
                                                            SendMessage(`⏸ Collector was disabled, there are still ${count} messages in Collector`, "system", msg.guildID, "Collector")
                                                        }
                                                        collectorEnable.set(msg.guildID, false)
                                                    })
                                                    .catch(function (err) {
                                                        SendMessage("❌ Failed to disable collector", "system", msg.guildID, "Collector")
                                                        Logger.printLine(`Collector`, `Failed to disable the message collector`, `error`, err)
                                                    })
                                            } else {
                                                if (count === 0) {
                                                    SendMessage(`⚠️ Collector already disabled`, "system", msg.guildID, "Collector")
                                                } else {
                                                    SendMessage(`⚠️ Collector already disabled, with ${count} Message in Collector`, "system", msg.guildID, "Collector")
                                                }
                                            }
                                        })
                                        .catch(function (err) {
                                            SendMessage(`❌ Error retrieving the items in the collector!`, `system`, msg.guildID, "Collector")
                                            Logger.printLine(`Collector`, `Failed retrieving the items in the collector`, `error`, err)
                                        })
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `system`, msg.guildID, "Collector")
                                    Logger.printLine(`Collector`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'search':
                                if (collectorEnable.has(msg.guildID)) {
                                    if (args.length > 3) {
                                        const channelnumber = args[2].replace("<#", "").replace(">", "");
                                        const searchTermString = args[3].toString();
                                        let numResults = 0
                                        discordClient.getMessages(channelnumber, 100000)
                                            .then((messages) => {
                                                SendMessage(`🔍 Searching ${messages.length.toString()} items...`, "system", msg.guildID, "Collector")
                                                let requests = messages.reverse().reduce((promiseChain, itemRequested) => {
                                                    return promiseChain.then(() => new Promise((resolve) => {
                                                        function addItem() {
                                                            const ItemID = `${itemRequested.guildID}-${Date.now().toString()}-${itemRequested.id}`
                                                            messsageCollector.setItem(ItemID, {
                                                                itemKey: ItemID,
                                                                messageID: itemRequested.id,
                                                                channelID: itemRequested.channel.id,
                                                                guildID: itemRequested.guildID,
                                                            })
                                                                .then(() => {
                                                                    Logger.printLine("AddMessageCollector", `Message ${itemRequested.id} added to Collector`, "debug");
                                                                    numResults++;
                                                                    resolve();
                                                                })
                                                                .catch(err => {
                                                                    Logger.printLine("AddMessageCollector", `Failed to add Message ${itemRequested.id} to Collector`, "err");
                                                                    resolve();
                                                                })
                                                        }

                                                        if (itemRequested.content.includes(searchTermString)) {
                                                            addItem();
                                                        } else if (itemRequested.attachments.length > 0) {
                                                            itemRequested.attachments.forEach((item) => {
                                                                if (item.filename.includes(searchTermString)) {
                                                                    addItem()
                                                                }
                                                            })
                                                            resolve()
                                                        } else {
                                                            resolve()
                                                        }
                                                    }));
                                                }, Promise.resolve());
                                                requests.then(function () {
                                                    SendMessage(`⚙️ Found and added ${numResults.toString()} items to the Collector`, "system", msg.guildID, "Collector")
                                                })
                                            })
                                    } else {
                                        SendMessage("⁉ Missing required channel destination or search term", "system", msg.guildID, "CollectorMove")
                                    }
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `system`, msg.guildID, "Collector")
                                    Logger.printLine(`Collector`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'clear':
                                if (collectorEnable.has(msg.guildID)) {
                                    localParameters.setItem('collector-' + msg.guildID, {
                                        status: 'off'
                                    })
                                        .then(function () {
                                            collectorEnable.set(msg.guildID, false)
                                            messsageCollector.keys()
                                                .then(function (results) {
                                                    const filteredkeys = filterItems(results, msg.guildID + '-')
                                                    for (let keyItem of filteredkeys) {
                                                        messsageCollector.removeItem(keyItem)
                                                            .catch(function (err) {
                                                                Logger.printLine(`Collector`, `Failed to remove an items from the collector`, `error`, err)
                                                            })
                                                    }
                                                    SendMessage(`🗑 ${filteredkeys.length} Messages Cleared from the Collector`, "system", msg.guildID, "Collector")
                                                })
                                                .catch(function (err) {
                                                    SendMessage(`❌ Error retrieving the items in the collector!`, `system`, msg.guildID, "Collector")
                                                    Logger.printLine(`Collector`, `Failed retrieving the items in the collector`, `error`, err)
                                                })
                                        })
                                        .catch(function (err) {
                                            SendMessage("❌ Failed to disable collector", "system", msg.guildID, "Collector")
                                            Logger.printLine(`Collector`, `Failed to disable the message collector`, `error`, err)
                                        })
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `system`, msg.guildID, "Collector")
                                    Logger.printLine(`Collector`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'status':
                                if (collectorEnable.has(msg.guildID)) {
                                    messsageCollector.keys()
                                        .then(function (results) {
                                            const count = filterItems(results, msg.guildID + '-').length;
                                            let head = `**🗳 ${count} Messages in the Collector`
                                            if (collectorEnable.get(msg.guildID)) {
                                                head += ` (✅)`
                                            } else {
                                                head += ` (🛑)`
                                            }
                                            let itemsText = ''
                                            messsageCollector.forEach(function (message) {
                                                if (message.value.guildID === msg.guildID) {
                                                    itemsText += `✉️ ${message.value.messageID} from <#${message.value.channelID}>\n`
                                                }
                                            })
                                                .then(function () {
                                                    if (count === 0) {
                                                        SendMessage(head + '**', "system", msg.guildID, "Collector")
                                                    } else {
                                                        SendMessage(head + ':**\n' + itemsText.substring(0, 1900), "system", msg.guildID, "Collector")
                                                    }
                                                })
                                        })
                                        .catch(function (err) {
                                            SendMessage(`❌ Error retrieving the items in the collector!`, `system`, msg.guildID, "Collector")
                                            Logger.printLine(`Collector`, `Failed retrieving the items in the collector`, `error`, err)
                                        })
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `system`, msg.guildID, "Collector")
                                    Logger.printLine(`Collector`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'done':
                                if (collectorEnable.has(msg.guildID)) {
                                    messsageCollector.keys()
                                        .then(function (results) {
                                            const count = filterItems(results, msg.guildID + '-').length
                                            if (collectorEnable.get(msg.guildID)) {
                                                if (args.length > 2) {
                                                    if (count === 0) {
                                                        SendMessage(`🛑 Collector is empty!`, `system`, msg.guildID,  "Collector")
                                                    } else {
                                                        const channelnumber = args[2].replace("<#", "").replace(">", "");
                                                        SendMessage(`⏳ Moving ${count} Messages, Please standby...`, "system", msg.guildID, "CollectorMove")
                                                        messsageCollector.keys()
                                                            .then(function (itemKeys) {
                                                                const sortedKeys = filterItems(itemKeys, msg.guildID + '-').sort().reverse()
                                                                let requests = sortedKeys.reduce((promiseChain, itemRequested) => {
                                                                    return promiseChain.then(() => new Promise((resolve) => {
                                                                        messsageCollector.getItem(itemRequested)
                                                                            .then(function (messages) {
                                                                                discordClient.getMessage(messages.channelID, messages.messageID)
                                                                                    .then(function (messageToMove) {
                                                                                        jfsMove(messageToMove, channelnumber, function (cb) {
                                                                                            if (!cb) {
                                                                                                messsageCollector.removeItem(itemRequested)
                                                                                                    .then(function () {
                                                                                                        Logger.printLine('CollectorMove', `Message ${messages.messageID} moved from ${messages.channelID} to ${channelnumber}`, "log")
                                                                                                        resolve()
                                                                                                    })
                                                                                                    .catch(function (err) {
                                                                                                        Logger.printLine('CollectorMove', `Failed to delete the item ${itemRequested} from the collector!`, "log", err)
                                                                                                        resolve()
                                                                                                    })
                                                                                            } else {
                                                                                                Logger.printLine("CollectorMove", `There was an error moving message : ${messages.messageID}`, "error")
                                                                                                resolve()
                                                                                            }
                                                                                        })
                                                                                    })
                                                                                    .catch((er) => {
                                                                                        Logger.printLine("CollectorMove", `Message was not found : ${messages.messageID}`, "error")
                                                                                        resolve()
                                                                                    })
                                                                            })
                                                                            .catch(function (err) {
                                                                                Logger.printLine(`Collector`, `Failed to get item ${itemRequested} from message collector`, `error`, err)
                                                                            })
                                                                    }));
                                                                }, Promise.resolve());
                                                                requests.then(function () {
                                                                    localParameters.setItem('collector-' + msg.guildID, {
                                                                        status: 'off'
                                                                    })
                                                                        .then(function () {
                                                                            collectorEnable.set(msg.guildID, false)
                                                                        })
                                                                        .catch(function (err) {
                                                                            SendMessage("❌ Failed to disable collector", "system", msg.guildID, "Collector")
                                                                            Logger.printLine(`Collector`, `Failed to disable the message collector`, `error`, err)
                                                                        })
                                                                })

                                                            })
                                                    }
                                                } else {
                                                    SendMessage("⁉ Missing required channel destination", "system", msg.guildID, "CollectorMove")
                                                }
                                            } else {
                                                SendMessage("⚠️ Collector already disabled", "system", msg.guildID, "Collector")
                                            }
                                        })
                                        .catch(function (err) {
                                            SendMessage(`❌ Error retrieving the items in the collector!`, `system`, msg.guildID, "Collector")
                                            Logger.printLine(`Collector`, `Failed retrieving the items in the collector`, `error`, err)
                                        })
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `system`, msg.guildID, "Collector")
                                    Logger.printLine(`Collector`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            default:
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "CollectorMove")
                                break;
                        }
                    }

                    switch (args[0].toLowerCase()) {
                        case 'lsmap':
                            db.simple(`SELECT channelid,watch_folder FROM kanmi_channels WHERE watch_folder IS NOT NULL AND source = 0`, function (err, folders) {
                                if (err) {
                                    SendMessage("SQL Error occurred when getting fileworker table", "err", 'main', "SQL", err)
                                } else {
                                    let message = '**Mapped Channels:**\n'
                                    for (let index in folders) {
                                        if (folders[index].watch_folder.toString() !== "MultiPartFolder" && folders[index].watch_folder.toString() !== "Data") {
                                            message += `📂 ${folders[index].watch_folder} => <#${folders[index].channelid}>\n`
                                        }
                                        if (parseInt(index) === folders.length - 1) {
                                            discordClient.createMessage(discordServers.get(msg.guildID).chid_system.toString(), {
                                                content: message.substring(0, 1980) + ""
                                            })
                                                .catch((er) => {
                                                    SendMessage("Failed to send message", "err", msg.guildID, "FWls", er)
                                                });
                                        }
                                    }
                                }
                            })
                            break;
                        case 'mkmap':
                            if (args.length > 2) {
                                const channelToAdd = args[1].replace("<#", "").replace(">", "");
                                const folderName = args[2]
                                Logger.printLine("Discord", `Created Map to ${channelToAdd} from ${folderName}`, "info")
                                db.safe(`UPDATE kanmi_channels SET watch_folder = ? WHERE channelid = ?`, [folderName, channelToAdd], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when writing to fileworker table", "err", 'main', "SQL", err)
                                    } else {
                                        mqClient.sendCmd('fileworker', 'RESET')
                                        SendMessage("✅ Created channel map", "system", msg.guildID, "FWAdd")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "FWAdd")
                            }
                            break;
                        case 'rmmap':
                            if (args.length > 1) {
                                Logger.printLine("Discord", `Removing map ${args[1]}`, "info")
                                db.safe(`UPDATE kanmi_channels SET watch_folder = null WHERE watch_folder = ?`, [args[1]], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when deleting from the fileworker table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage("❎ Removed channel map", "system", msg.guildID, "FWRm")
                                        mqClient.sendCmd('fileworker', 'RESET')
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "FWRm")
                            }
                            break;
                        case 'chmap':
                            if (args.length > 2) {
                                const channelToAdd = args[1].replace("<#", "").replace(">", "");
                                const folderName = args[2]
                                Logger.printLine("Discord", `Changed Map to ${channelToAdd} from ${folderName}`, "info")
                                db.safe(`UPDATE kanmi_channels SET watch_folder = ? WHERE channelid = ?`, [folderName, channelToAdd], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when writing to fileworker table", "err", 'main', "SQL", err)
                                    } else {
                                        mqClient.sendCmd('fileworker', 'RESET')
                                        SendMessage("✅ Changed channel map", "system", msg.guildID, "FWMod")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "FWMod")
                            }
                            break;
                        case 'rlch':
                            if (args.length > 2) {
                                const channelfrom = args[1].replace("<#", "").replace(">", "");
                                const channelnumber = args[2].replace("<#", "").replace(">", "");
                                const check1 = await discordClient.getChannel(channelfrom)
                                const check2 = await discordClient.getChannel(channelnumber)
                                if (!check1) {
                                    SendMessage(`"❌ Can not access "From" channel"`, "system", msg.guildID, "Move")
                                } else if (!check2) {
                                    SendMessage(`"❌ Can not access "To" channel"`, "system", msg.guildID, "Move")
                                } else if (args.length > 3 && args[3] === 'deep') {
                                    const messagesToMove = await discordClient.getMessages(channelfrom, (args.length > 4 && !isNaN(parseInt(args[4]))) ? parseInt(args[4]) : 1000000);
                                    if (messagesToMove && messagesToMove.length > 0) {
                                        for (let f of messagesToMove) {
                                            limiter3.removeTokens(1, function() {
                                                jfsMove(f, channelnumber, cb => {

                                                })
                                            });
                                        }
                                        SendMessage(`📂 ${messagesToMove.length} Messages moved from ${args[1]} to ${args[2]}`, "system", msg.guildID, "Move")
                                    } else {
                                        SendMessage("❌ Failed to get messages for that channel", "system", msg.guildID, "Move")
                                    }
                                } else {
                                    const messagesToMove = await db.query(`SELECT id, channel, server FROM kanmi_records WHERE channel = ? ORDER BY eid DESC${(args.length > 4 && !isNaN(parseInt(args[4]))) ? ' LIMIT ' + parseInt(args[4]) : ''}`, [channelfrom])
                                    if (messagesToMove.error) {
                                        SendMessage("❌ Failed to get messages for that channel due to SQL error", "system", msg.guildID, "Move", messagesToMove.error)
                                    } else if (messagesToMove.rows.length === 0) {
                                        SendMessage("❌ No messages stored in that channel, try `juzo jfs rlch " + args[1] + ' ' + args[2] + " deep`", "system", msg.guildID, "Move")
                                    } else {
                                        messagesToMove.rows.forEach(e => {
                                            mqClient.sendData(MQWorker3, {
                                                fromClient: `return.Discord.${systemglobal.SystemName}`,
                                                messageReturn: false,
                                                messageID: e.id,
                                                messageChannelID: e.channel,
                                                messageServerID: e.server,
                                                messageType: 'command',
                                                messageAction: 'MovePost',
                                                messageData: channelnumber
                                            }, function (callback) {
                                                if (!callback) {
                                                    Logger.printLine("Move", `Failed to request message ${e.id} to move`, "error")
                                                }
                                            })
                                        })
                                        SendMessage(`⏳ Requested ${messagesToMove.rows.length} Messages to be moved from ${args[1]} to ${args[2]}`, "system", msg.guildID, "Move")
                                    }

                                }
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "Move")
                            }
                            break;
                        case 'rmrf':
                            if (args.length > 1) {
                                const channelfrom = args[1].replace("<#", "").replace(">", "");
                                const messagesToDelete = await db.query(`SELECT id, channel, server, fileid FROM kanmi_records WHERE channel = ?`, [channelfrom])
                                if (messagesToDelete.error) {
                                    return "❌ SQL Failure"
                                } else {
                                    await Promise.all(messagesToDelete.rows.map(async msgdel => {
                                        mqClient.sendData(`${systemglobal.Discord_Out}.backlog`, {
                                            fromClient: `return.Discord.${systemglobal.SystemName}`,
                                            messageReturn: false,
                                            messageID: msgdel.id,
                                            messageChannelID: msgdel.channel,
                                            messageServerID: msgdel.server,
                                            messageType: 'command',
                                            messageAction: 'RemovePost'
                                        }, ok => {})
                                    }))
                                    return `Deleted ${messagesToDelete.rows.length} messages`
                                }
                            } else {
                                return "⁉ Missing required information"
                            }
                            break;
                        case 'chname':
                            if (args.length > 2) {
                                const channel = args[1].replace("<#", "").replace(">", "");
                                let newName = args.filter((e, i) => { if (i > 1) return e }).join(" ")
                                if (newName === '' || newName === ' ') {
                                    SendMessage("❌ New name could not be parsed", "system", msg.guildID, "RenameChannel")
                                } else {
                                    db.safe(`UPDATE kanmi_channels SET nice_name = ? WHERE channelid = ? `, [newName, channel], function (err, result) {
                                        if (err) {
                                            SendMessage("SQL Error occurred when saving to the channel cache", "err", 'main', "SQL", err)
                                        } else {
                                            SendMessage(`✅ Channel name was been updated to  ${newName}`, "system", msg.guildID, "RenameChannel")
                                        }
                                    })
                                }
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "RenameChannel")
                            }
                            break;
                        case 'rnf':
                            if (args.length > 3) {
                                const channelfrom = args[1].replace("<#", "").replace(">", "");
                                let newName = msg.content.split(args[2]).pop()
                                jfsRename(channelfrom, args[2], newName, function (complete) {
                                    if (complete) {
                                        SendMessage(`✅ File renamed to: ${newName}\nhttps://discord.com/channels/${msg.guildID}/${channelfrom}/${args[2]}/`, "system", msg.guildID, "Rename")
                                    }
                                });
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "Rename")
                            }
                            break;
                        case 'mvf':
                            if (args.length > 3) {
                                const channelfrom = args[1].replace("<#", "").replace(">", "");
                                const channelnumber = args[3].replace("<#", "").replace(">", "");
                                discordClient.getMessage(channelfrom, args[2])
                                    .then(function (messageToMove) {
                                        jfsMove(messageToMove, channelnumber, function (cb) {
                                            if (!cb) {
                                                SendMessage(`📂 Message moved from ${args[1]} to ${args[3]}`, "system", msg.guildID, "Move")
                                            } else {
                                                SendMessage("❌ There was an error moving the message", "system", msg.guildID, "Move")
                                            }
                                        })
                                    })
                                    .catch((er) => {
                                        SendMessage("❌ Message was not found", "system", msg.guildID, "Move", er)
                                    })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "Move")
                            }
                            break;
                        case 'rmf':
                            if (args.length > 2) {
                                const channelnumber = args[1].replace("<#", "").replace(">", "");
                                jfsRemoveSF(channelnumber, args[2], msg.guildID);
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "RMSF")
                            }
                            break;
                        case 'mvc':
                            if (args.length > 1) {
                                collector()
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "Move")
                            }
                            break;
                        case 'lsarc':
                            db.simple(`SELECT * FROM discord_archive_overide`, function (err, folders) {
                                if (err) {
                                    SendMessage("SQL Error occurred when getting fileworker table", "err", 'main', "SQL", err)
                                } else {
                                    let message = '**Mapped Archive Channels:**\n'
                                    for (let index in folders) {
                                        message += `🗄 <#${folders[index].fromch}> => <#${folders[index].archivech}>\n`
                                        if (parseInt(index) === folders.length - 1) {
                                            discordClient.createMessage(discordServers.get(msg.guildID).chid_system.toString(), {
                                                content: message.substring(0, 1980) + ""
                                            })
                                                .catch((er) => {
                                                    SendMessage("Failed to send message", "err", msg.guildID, "FWls", er)
                                                });
                                        }
                                    }
                                }
                            })
                            break;
                        case 'mkarc':
                            if (args.length > 2) {
                                const channelFrom = args[1].replace("<#", "").replace(">", "");
                                const channelArchive = args[2].replace("<#", "").replace(">", "");
                                db.safe(`INSERT INTO discord_archive_overide VALUES (?, ?)`, [channelFrom, channelArchive], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when writing to archive channel map table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage(`✅ Archive Channel Map Created`, "system", msg.guildID, "ArchiveMk")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "ArchiveMk")
                            }
                            break;
                        case 'rmarc':
                            if (args.length > 1) {
                                const channelFrom = args[1].replace("<#", "").replace(">", "");
                                db.safe(`DELETE FROM discord_archive_overide WHERE fromch = ?`, [channelFrom], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when deleting from archive channel map table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage(`❎ Archive Channel Map Removed`, "system", msg.guildID, "ArchiveRm")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "ArchiveRm")
                            }
                            break;
                        case 'repair':
                            if (args.length > 1) {
                                if (args[1] === 'all') {
                                    db.simple(`SELECT channelid FROM kanmi_channels WHERE parent != 'isparent' AND classification NOT LIKE '%system%' AND classification NOT LIKE '%timeline%' AND source = 0`, async function (err, result) {
                                        if (!(err) && result && result.length > 0) {
                                            let limit = undefined
                                            let forceLarge = false
                                            if (args.length > 2 && !isNaN(parseInt(args[2]))) {
                                                limit = parseInt(args[2])
                                            }
                                            if (args.length > 3 && args[3] === 'force') {
                                                forceLarge = true
                                            }

                                            SendMessage(`✅ Started Filesystem Repair...`, "system", msg.guildID, "RepairFileSystem")
                                            messageRecache(result, msg.guildID, 0, limit, forceLarge);
                                        } else {
                                            SendMessage(`❌ Failed to start filesystem repair, could not find and folders!`, "system", msg.guildID, "RepairFileSystem")
                                        }
                                    })
                                } else if (args[1] === 'parts' || args[1] === 'parity') {
                                    let limit = undefined
                                    let messagesBefore = 0
                                    if (args.length > 4 && !isNaN(parseInt(args[4]))) {
                                        messagesBefore = parseInt(args[4])
                                    }
                                    if (args.length > 2 && !isNaN(parseInt(args[2]))) {
                                        limit = parseInt(args[2])
                                    }
                                    SendMessage(`✅ Started Full Filesystem Parity Repair...`, "system", msg.guildID, "RepairFileSystem");
                                    spannedPartsRecache(messagesBefore, limit);
                                } else {
                                    const channelFrom = args[1].replace("<#", "").replace(">", "");
                                    let limit = undefined
                                    let messagesBefore = 0
                                    if (args.length > 4 && !isNaN(parseInt(args[4]))) {
                                        messagesBefore = parseInt(args[4])
                                    }
                                    if (args.length > 2 && !isNaN(parseInt(args[2]))) {
                                        limit = parseInt(args[2])
                                    }
                                    SendMessage(`✅ Started Filesystem Repair...`, "system", msg.guildID, "RepairFileSystem");
                                    messageRecache([{channelid: channelFrom}], msg.guildID, messagesBefore, limit, true);
                                }
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "ArchiveRm")
                            }
                            break;
                        case 'update':
                            SendMessage(`✅ Started Filesystem Update...`, "system", msg.guildID, "RepairFileSystem");
                            messageCheckCache();
                            break;
                        case 'initch':
                            discordClient.getRESTGuildChannels(msg.guildID)
                                .then(function (channels) {
                                    channels.forEach(function (channel) {
                                        channelCreate(channel);
                                    })
                                })
                            break;
                        default:
                            SendMessage("⁉ Unknown Command", "system", msg.guildID, "FSCmd")
                            break;
                    }
                } else {
                    SendMessage("⁉ Missing required information", "system", msg.guildID, "FSCmd")
                }
            }
        }, {
            argsRequired: true,
            caseInsensitive: true,
            description: "Manage the Discord Filesystem",
            fullDescription: "Allows you to manage channel mappings, create and remove channels\n" +
                "   **lsmap** - Lists all channel maps\n   **mkmap** - Create channel maps\n      [Channel, Folder]\n   **rmmap** - Removes a channel maps\n      [Folder]\n" +
                "   **chmap** - Remap a channel\n      [Channel, Folder]\n   **rlch** - Move All Messages to Channel\n      [ChFrom, ChTo, (deep), (count)]\n   **rmrf** - Delete All Files in a Channel\n      [Channel]\n   **chname** - Change the display name of a channel in Sequenzia (Spaces Ok)\n      [Channel, Name]\n" +
                "   **rnf** - Rename Message or file\n      [ChFrom, FileID, Filename]\n   **mvf** - Move Message or file\n      [ChFrom, MessageID, ChTo]\n   **rmf** - Delete Multi-Part File\n      [ChFrom, MessageID]\n" +
                "   **lsarc** - List Archive Channel Maps\n   **mkarc** - Create Archive Channel Map\n      [ChFrom, ChTo]\n   **rmarc** - Removes Archive Channel Map\n      [Channel]\n" +
                "   **mvc** - Manage the Collector\n      **enable** - Enable\n      **disable** - Disable\n      **status** - Displays status\n" +
                "      **done** - Moves all items to a channel\n         [Channel]\n      **search** - Search a channel for items to add\n         [Channel, Term]\n      **clear** - Clears all\n" +
                "   **repair** - Repairs a JFS folder or parity\n      [[Channel, all, or parts], (num to search), (force), (before id)]",
            usage: "command [arguments]",
            guildOnly: true
        })

        discordClient.registerCommand("seq", async function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    console.log(args)
                    switch (args[0].toLowerCase()) {
                        case 'roles':
                            if (args.length > 2) {
                                switch (args[1].toLowerCase()) {
                                    case 'list':
                                        try {
                                            const list = await db.query(`SELECT * FROM discord_permissons`);
                                            await discordClient.createMessage(msg.channel.id, `Named Permissions from Database`, [{
                                                file: Buffer.from(JSON.stringify(list.rows, null, '\t')),
                                                name: `roles.json`
                                            }])
                                        } catch (e) {
                                            return `Error sending metadata - ${e.message}`
                                        }
                                        break;
                                    case 'assign':
                                        const assignRoles = args[2].replace("<@&", "").replace(">", "");
                                        let assignedName = null
                                        if (args.length > 3) {
                                            assignedName = args[3]
                                        }
                                        const results = await db.query(`UPDATE discord_permissons SET name = ? WHERE role = ?`, [assignedName, assignRoles])
                                        console.log(results)
                                        return `Updated Role`
                                    default:
                                        return "⁉ Unknown Command"
                                }
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "RenameChannel")
                            }
                            break;
                        case 'layout':
                            if (args.length > 2) {
                                switch (args[1].toLowerCase()) {
                                    case 'super':
                                        switch (args[2].toLowerCase()) {
                                            case 'list':
                                                try {
                                                    const list = await db.query(`SELECT * FROM sequenzia_superclass`);
                                                    await discordClient.createMessage(msg.channel.id, `Superclass Metadata from Database`, [{
                                                        file: Buffer.from(JSON.stringify(list.rows, null, '\t')),
                                                        name: `superclass.json`
                                                    }])
                                                } catch (e) {
                                                    return `Error sending metadata - ${e.message}`
                                                }
                                                break;
                                            case 'update':
                                                if (args.length > 4) {
                                                    const superID = args[3].trim();
                                                    let object = {};
                                                    switch (args[4].toLowerCase()) {
                                                        case 'id':
                                                            object.super = args[5].trim();
                                                            break;
                                                        case 'name':
                                                            object.name = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'position':
                                                            object.position = parseInt(args[5].trim())
                                                            if (isNaN(object.position))
                                                                return `❌ Position must be a number!`
                                                            break;
                                                        case 'uri':
                                                            object.uri = args[5].trim();
                                                            break;
                                                        default:
                                                            return "⁉ Unknown Sub Command"
                                                    }
                                                    if (Object.keys(object).length > 0 && superID.length > 0) {
                                                        const results = await db.query(`UPDATE sequenzia_superclass SET ? WHERE super = ?`, [object, superID])
                                                        return `Updated Database, Wait for changes to be cached on Sequenzia and reload your account.`
                                                    }
                                                } else {
                                                    return "⁉ Missing required information"
                                                }
                                                break;
                                            case 'create':
                                                if (args.length > 5) {
                                                    const superID = args[3].trim();
                                                    const superURI = args[4].trim();
                                                    const superPosition = parseInt(args[5].trim());
                                                    if (isNaN(superPosition))
                                                        return `❌ Position must be a number!`
                                                    const superName = args.splice(6).join(' ').trim();

                                                    await db.query(`INSERT INTO sequenzia_superclass SET ?`, [{
                                                        super: superID,
                                                        name: superName,
                                                        uri: superURI,
                                                        position: superPosition
                                                    }])
                                                    return `Updated Database, Assign Classes to the new super`
                                                } else {
                                                    return "⁉ Missing required information\nFormat: SUPERID URI POSITION NAME"
                                                }
                                            case 'remove':
                                                const superID = args[3].trim();
                                                await db.query(`DELETE FROM sequenzia_superclass WHERE super = ?`, [superID])
                                                return `Updated Database, Super was removed`
                                            default:
                                                return "⁉ Unknown Command"
                                        }
                                        break;
                                    case 'class':
                                        switch (args[2].toLowerCase()) {
                                            case 'list':
                                                try {
                                                    const list = await db.query(`SELECT * FROM sequenzia_class`);
                                                    await discordClient.createMessage(msg.channel.id, `Class Metadata from Database`, [{
                                                        file: Buffer.from(JSON.stringify(list.rows, null, '\t')),
                                                        name: `class.json`
                                                    }])
                                                } catch (e) {
                                                    return `Error sending metadata - ${e.message}`
                                                }
                                                break;
                                            case 'update':
                                                if (args.length > 4) {
                                                    const classID = args[3].trim();
                                                    let object = {};
                                                    switch (args[4].toLowerCase()) {
                                                        case 'id':
                                                            object.class = args[5].trim();
                                                            break;
                                                        case 'super':
                                                            object.super = args[5].trim();
                                                            break;
                                                        case 'name':
                                                            object.name = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'icon':
                                                            object.icon = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'position':
                                                            object.position = parseInt(args[5].trim())
                                                            if (isNaN(object.position))
                                                                return `❌ Position must be a number!`
                                                            break;
                                                        case 'uri':
                                                            object.uri = args[5].trim();
                                                            if (object.uri.length === 0)
                                                                object.uri = null
                                                            break;
                                                        default:
                                                            return "⁉ Unknown Sub Command"
                                                    }
                                                    if (Object.keys(object).length > 0 && classID.length > 0) {
                                                        const results = await db.query(`UPDATE sequenzia_class SET ? WHERE class = ?`, [object, classID])
                                                        return `Updated Database, Wait for chnages to be cached on Sequenzia and reload your account.`
                                                    }
                                                } else {
                                                    return "⁉ Missing required information"
                                                }
                                                break;
                                            case 'create':
                                                if (args.length > 6) {
                                                    const classSuper = args[3].trim();
                                                    const classID = args[4].trim();
                                                    const classIcon = args[5].trim();
                                                    const classPosition = parseInt(args[6].trim());
                                                    if (isNaN(classPosition))
                                                        return `❌ Position must be a number!`
                                                    const className = args.splice(7).join(' ').trim();

                                                    await db.query(`INSERT INTO sequenzia_class SET ?`, [{
                                                        super: classSuper,
                                                        class: classID,
                                                        icon: classIcon,
                                                        name: className,
                                                        position: classPosition
                                                    }])
                                                    return `Updated Database, Assign Channels to the new class`
                                                } else {
                                                    return "⁉ Missing required information\nFormat: SUPERID CLASSID FA-ICON POSITION NAME"
                                                }
                                            case 'remove':
                                                const classID = args[3].trim();
                                                await db.query(`DELETE FROM sequenzia_class WHERE class = ?`, [classID])
                                                return `Updated Database, Class removed`
                                            default:
                                                return "⁉ Unknown Command"
                                        }
                                        break;
                                    case 'virtual_channel':
                                        switch (args[2].toLowerCase()) {
                                            case 'list':
                                                try {
                                                    const list = await db.query(`SELECT * FROM kanmi_virtual_channels`);
                                                    await discordClient.createMessage(msg.channel.id, `Virtual Channels Metadata from Database`, [{
                                                        file: Buffer.from(JSON.stringify(list.rows, null, '\t')),
                                                        name: `virtual_channels.json`
                                                    }])
                                                } catch (e) {
                                                    return `Error sending metadata - ${e.message}`
                                                }
                                                break;
                                            case 'update':
                                                if (args.length > 4) {
                                                    const classID = args[3].trim();
                                                    let object = {};
                                                    switch (args[4].toLowerCase()) {
                                                        case 'id':
                                                            object.virtual_cid = args[5].trim();
                                                            break;
                                                        case 'name':
                                                            object.name = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'description':
                                                            object.description = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'uri':
                                                            object.uri = args[5].trim();
                                                            if (object.uri.length === 0)
                                                                object.uri = null
                                                            break;
                                                        default:
                                                            return "⁉ Unknown Sub Command"
                                                    }
                                                    if (Object.keys(object).length > 0 && classID.length > 0) {
                                                        const results = await db.query(`UPDATE kanmi_virtual_channels SET ? WHERE virtual_cid = ?`, [object, classID])
                                                        return `Updated Database, Wait for chnages to be cached on Sequenzia and reload your account.`
                                                    }
                                                } else {
                                                    return "⁉ Missing required information"
                                                }
                                                break;
                                            case 'create':
                                                if (args.length > 6) {
                                                    const classID = args[3].trim();
                                                    const className = args.splice(4).join(' ').trim();

                                                    await db.query(`INSERT INTO kanmi_virtual_channels SET ?`, [{
                                                        virtual_cid: classID,
                                                        name: className
                                                    }])
                                                    return `Updated Database, Assign Channels to the new class`
                                                } else {
                                                    return "⁉ Missing required information\nFormat: VCID NAME"
                                                }
                                            case 'remove':
                                                const classID = args[3].trim();
                                                await db.query(`DELETE FROM kanmi_virtual_channels WHERE virtual_cid = ?`, [classID])
                                                return `Updated Database, Class removed`
                                            default:
                                                return "⁉ Unknown Command"
                                        }
                                        break;
                                    case 'channel':
                                        switch (args[2].toLowerCase()) {
                                            case 'list':
                                                try {
                                                    const list = await db.query(`SELECT channelid, serverid, parent, virtual_cid, name, nice_name, nice_title, classification, uri, watch_folder, notify, role, role_write, role_manage, description, nsfw FROM kanmi_channels WHERE classification IS NOT NULL AND classification != 'system' AND classification != 'timeline'`);

                                                    await discordClient.createMessage(msg.channel.id, `Channel Metadata from Database`, [{
                                                        file: Buffer.from(JSON.stringify(list.rows, null, '\t')),
                                                        name: `channels.json`
                                                    }])
                                                } catch (e) {
                                                    return `Error sending metadata - ${e.message}`
                                                }
                                                break;
                                            case 'update':
                                                if (args.length > 4) {
                                                    const ChannelID = args[3].replace("<#", "").replace(">", "");
                                                    let object = {};
                                                    let updateFW = false;
                                                    switch (args[4].toLowerCase()) {
                                                        case 'class':
                                                            object.classification = args[5].trim();
                                                            break;
                                                        case 'notify':
                                                            object.notify = args[5].replace("<#", "").replace(">", "");
                                                            break;
                                                        case 'name':
                                                            object.nice_name = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'title':
                                                            object.nice_title = args.splice(5).join(' ').trim();
                                                            break;
                                                        case 'folder':
                                                            object.watch_folder = args.splice(5).join(' ').trim();
                                                            updateFW = true
                                                            break;
                                                        case 'vcid':
                                                            object.virtual_cid = parseInt(args[5].trim())
                                                            if (isNaN(object.virtual_cid))
                                                                return `❌ Virtual Channel ID must be a number!`
                                                            break;
                                                        case 'uri':
                                                            object.uri = args[5].trim();
                                                            if (object.uri.length === 0)
                                                                object.uri = null
                                                            break;
                                                        case 'read':
                                                            if (isNaN(parseInt(args[5].replace("<@&", "").replace(">", "")))) {
                                                                object.role = args[5]
                                                            } else {
                                                                const role_name = await db.query(`SELECT name
                                                                                            FROM discord_permissons
                                                                                            WHERE role = ?`, [args[5].replace("<@&", "").replace(">", "")]);
                                                                if (role_name.rows.length > 0 & role_name.rows[0].name !== null) {
                                                                    object.role = role_name.rows[0].name
                                                                } else {
                                                                    return `❌ Roles does not exist or has not been assigned a name`
                                                                }
                                                            }
                                                            break;
                                                        case 'write':
                                                            if (isNaN(parseInt(args[5].replace("<@&", "").replace(">", "")))) {
                                                                object.role_write = args[5]
                                                            } else {
                                                                const role_name = await db.query(`SELECT name
                                                                                            FROM discord_permissons
                                                                                            WHERE role = ?`, [args[5].replace("<@&", "").replace(">", "")]);
                                                                if (role_name.rows.length > 0 & role_name.rows[0].name !== null) {
                                                                    object.role_write = role_name.rows[0].name
                                                                } else {
                                                                    return `❌ Roles does not exist or has not been assigned a name`
                                                                }
                                                            }
                                                            break;
                                                        case 'manage':
                                                            if (isNaN(parseInt(args[5].replace("<@&", "").replace(">", "")))) {
                                                                object.role_manage = args[5]
                                                            } else {
                                                                const role_name = await db.query(`SELECT name
                                                                                            FROM discord_permissons
                                                                                            WHERE role = ?`, [args[5].replace("<@&", "").replace(">", "")]);
                                                                if (role_name.rows.length > 0 & role_name.rows[0].name !== null) {
                                                                    object.role_manage = role_name.rows[0].name
                                                                } else {
                                                                    return `❌ Roles does not exist or has not been assigned a name`
                                                                }
                                                            }
                                                            break;
                                                        default:
                                                            return "⁉ Unknown Sub Command"
                                                    }
                                                    if (Object.keys(object).length > 0 && ChannelID.length > 0) {
                                                        const results = await db.query(`UPDATE kanmi_channels SET ? WHERE channelid = ?`, [object, ChannelID])
                                                        return `Updated Database, Wait for changes to be cached on Sequenzia and reload your account.`
                                                        if (updateFW) {
                                                            mqClient.sendCmd('fileworker', 'RESET');
                                                        }
                                                    }
                                                } else {
                                                    return "⁉ Missing required information"
                                                }
                                                break;
                                            case 'create-parent':
                                                if (args.length > 3) {
                                                    let parentName;
                                                    let parentServer = parseInt(args[3].trim());
                                                    if (isNaN(parentServer)) {
                                                        parentServer = msg.guildID;
                                                        parentName = args.splice(3).join(' ').trim();
                                                    } else {
                                                        parentServer = msg.guildID;
                                                        parentName = args.splice(4).join(' ').trim();
                                                    }
                                                    try {
                                                        const parentCreate = await discordClient.createChannel(parentServer, parentName, 4);
                                                        const guildRoles = await discordClient.getRESTGuildRoles(parentCreate.guild.id);
                                                        const roleSystem = guildRoles.filter(e => e.name === "⚡ System Engine").map(async e => {
                                                            return await discordClient.editChannelPermission(parentCreate.id, e.id, 395140262992, 0, 0, `Create new parent, permissions for ${e.name}`);
                                                        })
                                                        const roleAdminMode = guildRoles.filter(e => e.name === "🔓 Admin Mode").map(async e => {
                                                            return await discordClient.editChannelPermission(parentCreate.id, e.id, 17183089744, 0, 0, `Create new parent, permissions for ${e.name}`);
                                                        })
                                                        const roleReadOnly = guildRoles.filter(e => e.name === "📀 Data Reader").map(async e => {
                                                            return await discordClient.editChannelPermission(parentCreate.id, e.id, 1115136, 0, 0, `Create new parent, permissions for ${e.name}`);
                                                        })
                                                        if (parentCreate, guildRoles, roleSystem, roleAdminMode, roleReadOnly) {
                                                            return `Create Parent, Please move the channel to the position you want and use the layout commands to configure class and role access`
                                                        } else {
                                                            return `Create Failed - A Task Failed`
                                                        }
                                                    } catch (e) {
                                                        return `Create Failed - ${e.message}`
                                                    }
                                                } else {
                                                    return "⁉ Missing required information, Provide a name and or a serverID"
                                                }
                                            default:
                                                return "⁉ Unknown Command"
                                        }
                                        break;
                                    default:
                                        SendMessage("⁉ Unknown Command", "system", msg.guildID, "LayoutManager")
                                        break;
                                }
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "LayoutManager")
                            }
                            break;
                        default:
                            SendMessage("⁉ Unknown Command", "system", msg.guildID, "SequenziaManager")
                            break;
                    }
                } else {
                    SendMessage("⁉ Missing required information", "system", msg.guildID, "SequenziaManager")
                }
            }
        }, {
            argsRequired: true,
            caseInsensitive: true,
            description: "Manage Sequenzia",
            fullDescription: "Manage Features Related to the Sequenzia Interface\nUsage: https://github.com/UiharuKazari2008/sequenzia-compose/wiki/Administration#layout-commands",
            usage: "command [arguments]",
            guildOnly: true
        })

        discordClient.registerCommand("clr", function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id) || isAuthorizedUser('commandPub', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    if (args[1] === "Confirm") {
                        const channelToClear = args[0].replace("<#", "").replace(">", "");
                        deleteAbove(channelToClear);
                        SendMessage(`🗑 Channel has been cleared`, "system", msg.guildID, "Clear")
                    } else {
                        SendMessage("⁉ You did not confirm the action", "system", msg.guildID, "Clear")
                    }
                } else {
                    let channelClear = '';
                    if (msg.channel.id === discordServers.get(msg.guildID).chid_system.toString()) {
                        channelClear = discordServers.get(msg.guildID).chid_system.toString();
                    }
                    if (channelClear !== '') {
                        deleteAbove(channelClear);
                    } else {
                        Logger.printLine("Discord", "Not a recognized channel number", "error")
                    }
                }
            }
        }, {
            argsRequired: false,
            caseInsensitive: true,
            description: "Clears all messages from a channel",
            fullDescription: "Clears all messages from the system channel or a specified channel",
            usage: "#channel (optional)",
            guildOnly: true
        })

        discordClient.registerCommand("twit", function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    switch (args[0].toLowerCase()) {
                        case 'add':
                            if (args.length > 2) {
                                const channelToAdd = args[1].replace("<#", "").replace(">", "");
                                const username = args[2];
                                sendTwitterAction(username, "listManager", "adduser", "", channelToAdd, msg.guildID)
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "TwitterAdd")
                            }
                            break;
                        case 'rm':
                            if (args.length > 2) {
                                const channelToAdd = args[1].replace("<#", "").replace(">", "");
                                const username = args[2];
                                sendTwitterAction(username, "listManager", "removeuser", "", channelToAdd, msg.guildID)
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "TwitterAdd")
                            }
                            break;
                        case 'ls':
                            sendTwitterAction("empty", "listManager", "getusers", "", '', msg.guildID)
                            break;
                        case 'blkwd':
                            if (args.length > 1) {
                                Logger.printLine("Discord", `Blocked the word "${args[1]}"`, "info")
                                db.safe(`INSERT INTO twitter_blockedwords VALUES (?, ?)`, [args[1] + ' ', systemglobal.TwitterUser], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when writing to twitter blocked words table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage(`🚫 You will no longer receive tweets containing the word "${args[1]}"`, "system", msg.guildID, "TwitterBlock")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "TwitterBlock")
                            }
                            break;
                        case 'ublkwd':
                            if (args.length > 1) {
                                Logger.printLine("Discord", `Blocked the word "${args[1]}"`, "info")
                                db.safe(`DELETE FROM twitter_blockedwords WHERE word = ?`, [args[1] + ' '], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when deleting from the twitter blocked words table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage(`✅ You will receive tweets containing the word "${args[1]}"`, "system", msg.guildID, "TwitterUBlock")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "TwitterBlock")
                            }
                            break;
                        case 'release':
                            if (args.length > 1) {
                                mqClient.sendData(systemglobal.Twitter_In, {
                                    fromWorker: systemglobal.SystemName,
                                    messageText: "",
                                    messageIntent: 'releaseTweet',
                                    messageAction: (args.length > 2) ? args[2] : undefined,
                                    accountID: parseInt(args[1].toString())
                                }, function (ok) {
                                    if (ok)
                                        SendMessage(`Releasing a${(args.length > 2) ? ' ' + args[2] : ''} tweet for Twitter account #${args[1]}`, "system", msg.guildID, "TwitterRelease")
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "TwitterBlock")
                            }
                            break;
                        default:
                            SendMessage("⁉ Unknown Command", "system", msg.guildID, "TwitterMgr")
                            break;
                    }
                } else {
                    SendMessage("⁉ Missing required information", "system", msg.guildID, "TwitterMgr")
                }
            }
        }, {
            argsRequired: true,
            caseInsensitive: true,
            description: "Manage the Twitter Client",
            fullDescription: "Manages twitter lists and blocked words\n" +
                "   **get** - Get More Tweets (Flowcontrol only)\n   **add** - Add user to Twitter List\n      [Channel, Username]\n   **rm** - Remove user from Twitter List\n      [Channel, Username]\n   **ls** - Lists all users in a list\n" +
                "   **blkwd** - Add word to blocklist\n      [word]\n   **ublkwd** - Remove word from blocklist\n      [word]\n   **release** - Release a tweet on a Flow Controlled account\n      [accountID]",
            usage: "command [arguments]",
            guildOnly: true
        })

        discordClient.registerCommand("yt", function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    switch (args[0].toLowerCase()) {
                        case 'add':
                            if (args.length > 2) {
                                const channelToAdd = args[1].replace("<#", "").replace(">", "");
                                Logger.printLine("Discord", `Now Watching Channel "${args[2]}"`, "info")
                                db.safe(`INSERT INTO youtube_watchlist VALUES (?, ?, ?, null)`, [args[2], systemglobal.YouTubeUser, channelToAdd], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when writing to youtube list table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage(`✅ You are subscribed to that channel`, "system", msg.guildID, "YTWatch")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "YTWatch")
                            }
                            break;
                        case 'rm':
                            if (args.length > 1) {
                                Logger.printLine("Discord", `No longer watching channel "${args[1]}"`, "info")
                                db.safe(`DELETE FROM youtube_watchlist WHERE yuser = ?`, [args[1]], function (err, resultsend) {
                                    if (err) {
                                        SendMessage("SQL Error occurred when deleting from the youtube list table", "err", 'main', "SQL", err)
                                    } else {
                                        SendMessage(`❎ You are unsubscribed to that channel`, "system", msg.guildID, "YTRm")
                                    }
                                })
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "YTRm")
                            }
                            break;
                        default:
                            SendMessage("⁉ Unknown Command", "system", msg.guildID, "YouTubeMgr")
                            break;
                    }
                } else {
                    SendMessage("⁉ Missing required information", "system", msg.guildID, "YouTubeMgr")
                }
            }
        }, {
            argsRequired: true,
            caseInsensitive: true,
            description: "Manage the YouTube Client",
            fullDescription: "Manages followed youtube channels\n" +
                "   **add** - Add channel to subscription group\n      [Channel, UserID]\n**rm** - Remove a channel from a subscription group\n      [UserID]",
            usage: "command [arguments]",
            guildOnly: true
        })

        discordClient.registerCommand("pixiv", function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    switch (args[0].toLowerCase()) {
                        case 'recom':
                            sendPixivAction("empty", "GetRecommended", "get")
                            SendMessage(`⏳ Request was sent to Pixiv, View in <#${pixivaccount[0].feed_channelid}>`, "system", msg.guildID, "PixivRecom")
                            break;
                        case 'add':
                            if (args.length > 1) {
                                const userID = args[1];
                                sendPixivAction(userID, "Follow", "add")
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "PixivMgr")
                            }
                            break;
                        case 'rm':
                            if (args.length > 1) {
                                const userID = args[1];
                                sendPixivAction(userID, "Follow", "remove")
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "PixivMgr")
                            }
                            break;
                        case 'get':
                            if (args.length > 1) {
                                if (args[1].includes("pixiv.net/")) {
                                    const postID = parseInt(args[1].split("/").pop()).toString()
                                    if (postID !== 'NaN') {
                                        if (args[1].includes("/artworks/")) { // Illustration
                                            sendPixivAction(postID, "DownloadPost", "get", undefined, true)
                                            SendMessage(`⏳ Download request was sent to Pixiv, View in <#${discordServers.get(msg.guildID).chid_download}>`, "system", msg.guildID, "PixivDownload")
                                        } else if (args[1].includes("/users/")) { // User
                                            sendPixivAction(postID, "DownloadUser", "get", undefined, true)
                                            SendMessage(`⏳ Download request was sent to Pixiv, View in <#${discordServers.get(msg.guildID).chid_download}>`, "system", msg.guildID, "PixivDownload")
                                        }
                                    } else {
                                        SendMessage("⁉ No post ID was found", "system", msg.guildID, "PixivMgr")
                                    }
                                } else {
                                    const postID = parseInt(args[2]).toString()
                                    if (postID !== 'NaN') {
                                        if (args[1].toLowerCase() === "user") {
                                            sendPixivAction(postID, "DownloadUser", "get", undefined, true)
                                            SendMessage(`⏳ Download request was sent to Pixiv, View in <#${discordServers.get(msg.guildID).chid_download}>`, "system", msg.guildID, "PixivDownload")
                                        } else if (args[1].toLowerCase() === "illu" || args[1].toLowerCase() === "single") {
                                            sendPixivAction(postID, "DownloadPost", "get", undefined, true)
                                            SendMessage(`⏳ Download request was sent to Pixiv, View in <#${discordServers.get(msg.guildID).chid_download}>`, "system", msg.guildID, "PixivDownload")
                                        }
                                    } else {
                                        SendMessage("⁉ No post ID was found", "system", msg.guildID, "PixivMgr")
                                    }
                                }
                            } else {
                                SendMessage("⁉ Missing required information", "system", msg.guildID, "PixivDownload")
                            }
                            break;
                        default:
                            SendMessage("⁉ Unknown Command", "system", msg.guildID, "PixivMgr")
                            break;
                    }
                } else {
                    SendMessage("⁉ Missing required information", "system", msg.guildID, "PixivMgr")
                }
            }
        }, {
            argsRequired: true,
            caseInsensitive: true,
            description: "Manage the Pixiv Client",
            fullDescription: "Allows you to interact with the Pixiv Client Functions\n" +
                "   **recom** - Release a Recommended post for your account\n      **clear** - Refreshes Recommended posts for your account\n   **get** - Downloads a illustrations or a user\n      [(user/illu), PixivID]\n      [URL]\n" +
                "   **add** - Follow a user\n      [PixivUserID]\n   **rm** - Unfollow a user\n      [PixivUserID]\n",
            usage: "command [arguments]",
            guildOnly: true
        })

        if (systemglobal.RadioFolder) {
            discordClient.registerCommand("music", function (msg,args) {
                if (discordServers.get(msg.guildID).chid_system.toString() === msg.channel.id.toString()) {
                    if (args.length > 0) {
                        switch (args[0].toLowerCase()) {
                            case 'ls':
                                if (playingStatus.has(msg.guildID)) {
                                    let message = "List of current music boxes\n```"
                                    for (let item of musicFolders) {
                                        message = message + `🎹 - ${item}\n`
                                    }
                                    discordClient.createMessage(discordServers.get(msg.guildID).chid_system.toString(), {
                                        content: message.substring(0, 1900) + "```"
                                    })
                                        .catch((er) => {
                                            SendMessage("Failed to send message", "err", msg.guildID, "Playlist", er)
                                        });
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `systempublic`, msg.guildID, "Musicbox")
                                    Logger.printLine(`Musicbox`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'play':
                                if (playingStatus.has(msg.guildID)) {
                                    if (args.length > 1) {
                                        if (msg.member.voiceState.channelID !== null) {
                                            if (musicFolders.indexOf(args[1]) > -1) {
                                                nowPlaying.clear()
                                                    .then(() => {
                                                        const musicbox_name = musicFolders[musicFolders.indexOf(args[1])]
                                                        const files = shuffle(fs.readdirSync(path.join(systemglobal.RadioFolder, musicbox_name)))
                                                        for (let index in files) {
                                                            const key = msg.guildID.toString() + '-' + crypto.randomBytes(5).toString("hex")
                                                            nowPlaying.setItem(key, {
                                                                file: files[index].toString(),
                                                                musicbox: musicbox_name,
                                                            })
                                                                .then(function () {
                                                                    if (parseInt(index) === files.length - 1) {
                                                                        discordClient.joinVoiceChannel(msg.member.voiceState.channelID)
                                                                            .catch((err) => {
                                                                                SendMessage("There was an error connecting to the radio station!", "err", msg.guildID, "Radio", err)
                                                                            })
                                                                            .then((connection) => {
                                                                                if (playingStatus.get(msg.guildID)) {
                                                                                    connection.stopPlaying();
                                                                                } else {
                                                                                    playStation(connection)
                                                                                }
                                                                            });
                                                                    }

                                                                })
                                                                .catch(function (err) {
                                                                    Logger.printLine("Musicbox", `Failed to generate a track record for ${files[index].toString()}`, "err", err)
                                                                })
                                                        }
                                                    })
                                                    .catch(function (err) {
                                                        Logger.printLine("Musicbox", `Failed to clear the playlist`, "err", err)
                                                    })
                                            } else {
                                                SendMessage("⁉️ That music box is not available", "systempublic", msg.guildID, "Radio")
                                            }
                                        } else {
                                            SendMessage("⁉️ You are not currently connected to the radio station, Please join the channel!", "systempublic", msg.guildID, "Radio")
                                        }
                                    } else {
                                        SendMessage("⁉ Missing required information", "systempublic", msg.guildID, "Radio")
                                    }
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `systempublic`, msg.guildID, "Musicbox")
                                    Logger.printLine(`Musicbox`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'stop':
                                if (playingStatus.has(msg.guildID)) {
                                    if (discordClient.voiceConnections.size > 0) {
                                        if (discordClient.voiceConnections.has(msg.guildID)) {
                                            nowPlaying.clear()
                                                .then(() => {
                                                    if (playingStatus.get(msg.guildID)) {
                                                        discordClient.voiceConnections.get((msg.guildID)).stopPlaying();
                                                    }
                                                    discordClient.closeVoiceConnection(msg.guildID)
                                                    localParameters.setItem('player-' + msg.guildID, {
                                                        status: 'off',
                                                        key: '',
                                                        channel: '',
                                                    })
                                                        .then(function () {
                                                            playingStatus.set(msg.guildID, false);
                                                        })
                                                        .catch(function (err) {
                                                            SendMessage("❌ Failed to set player status", "system", msg.guildID, "Musicbox")
                                                            Logger.printLine(`Musicbox`, `Failed to set play status`, `error`, err)
                                                        })
                                                })
                                                .catch(function (err) {
                                                    Logger.printLine("Musicbox", `Failed to clear the playlist`, "err", err)
                                                })
                                        } else {
                                            SendMessage("⁉️ Radio is not currently playing", "systempublic", msg.guildID, "Radio")
                                        }
                                    } else {
                                        SendMessage("⁉️ Radio is not currently playing", "systempublic", msg.guildID, "Radio")
                                    }
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `systempublic`, msg.guildID, "Musicbox")
                                    Logger.printLine(`Musicbox`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'replay':
                                if (playingStatus.has(msg.guildID)) {
                                    if (msg.member.voiceState.channelID !== null) {
                                        discordClient.joinVoiceChannel(msg.member.voiceState.channelID)
                                            .catch((err) => {
                                                SendMessage("There was an error connecting to the radio station!", "err", msg.guildID, "RadioStop", err)
                                            })
                                            .then((connection) => {
                                                if (playingStatus.get(msg.guildID)) {
                                                    playStation(connection, "restart")
                                                }
                                            })
                                    } else {
                                        SendMessage("⁉️ You are not currently connected to the radio station, Please join the channel!", "systempublic", msg.guildID, "Radio")
                                    }
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `systempublic`, msg.guildID, "Musicbox")
                                    Logger.printLine(`Musicbox`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'next':
                                if (playingStatus.has(msg.guildID)) {
                                    if (msg.member.voiceState.channelID !== null) {
                                        discordClient.joinVoiceChannel(msg.member.voiceState.channelID)
                                            .catch((err) => {
                                                SendMessage("There was an error connecting to the radio station!", "err", msg.guildID, "RadioNext", err)
                                            })
                                            .then((connection) => {
                                                if (playingStatus.get(msg.guildID)) {
                                                    connection.stopPlaying();
                                                }
                                            })
                                    } else {
                                        SendMessage("⁉️ You are not currently connected to the radio station, Please join the channel!", "systempublic", msg.guildID, "Radio")
                                    }
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `systempublic`, msg.guildID, "Musicbox")
                                    Logger.printLine(`Musicbox`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            case 'pause':
                                if (playingStatus.has(msg.guildID)) {
                                    if (msg.member.voiceState.channelID !== null) {
                                        discordClient.joinVoiceChannel(msg.member.voiceState.channelID)
                                            .catch((err) => {
                                                SendMessage("There was an error connecting to the radio station!", "err", msg.guildID, "RadioPause", err)
                                            })
                                            .then((connection) => {
                                                if (connection.playing || connection.paused) {
                                                    if (connection.paused) {
                                                        connection.resume()
                                                    } else {
                                                        connection.pause()
                                                    }
                                                } else if (playingStatus.get(msg.guildID)) {
                                                    playStation(connection, "restart")
                                                }

                                            })
                                    } else {
                                        SendMessage("⁉️ You are not currently connected to the radio station, Please join the channel!", "systempublic", msg.guildID, "Radio")
                                    }
                                } else {
                                    SendMessage(`❌ System Parameters have not loaded yet!`, `systempublic`, msg.guildID, "Musicbox")
                                    Logger.printLine(`Musicbox`, `System Parameters have not loaded yet, please try again.`, `warn`)
                                }
                                break;
                            default:
                                SendMessage("⁉ Unknown Command", "systempublic", msg.guildID, "RadioCmd")
                                break;
                        }
                    } else {
                        SendMessage("⁉ Missing required information", "systempublic", msg.guildID, "PixivMgr")
                    }
                }
            }, {
                argsRequired: true,
                caseInsensitive: true,
                description: "Control Music Player",
                fullDescription: "Manages the radio Channel\n" +
                    "   **ls** - Lists all music boxes\n   **play** - Play a named musicbox\n      [Musicbox]\n   **stop** - Stop and Disconnect player\n   **next** - Next track\n   **pause** - Pause or Resume track\n",
                usage: "command [arguments]",
                guildOnly: true
            })
        }

        discordClient.registerCommand("status", async function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                if (args.length > 0) {
                    switch (args[0]) {
                        case 'tasks':
                            const activeProccessing = Object.entries(discordClient.requestHandler.ratelimits).filter(e => e[1].remaining === 0 && e[1].processing !== false && e[0] !== '/users/@me/guilds')
                            const taskNames = activeProccessing.filter(e => !e[0].startsWith('/')).map(e => e[0].split('/')[0])
                            return `${(activeProccessing.length > 0) ? '⏳ ' + activeProccessing.length + ' Tasks Enqueued' + ((taskNames.length > 0) ? ' (' + taskNames.join('/') + ')' : '').toString() : '💤 No Active Tasks'}`
                        case 'enable':
                            generateStatus(true, msg.guildID, args[1].replace("<#", "").replace(">", ""));
                            return `Added a insights display to <#${args[1].replace("<#", "").replace(">", "")}>`
                        case 'disable':
                            if (Timers.has(`StatusReport${msg.guildID}`)) {
                                clearInterval(Timers.get(`StatusReport${msg.guildID}`))
                                clearInterval(Timers.get(`StatusReportCheck${msg.guildID}`))
                                Timers.delete(`StatusReport${msg.guildID}`)
                                Timers.delete(`StatusReportCheck${msg.guildID}`)
                                await localParameters.del(`statusgen-${msg.guildID}`)
                                return "Disabled Insights Display for this guild, Please delete the message"
                            } else {
                                return `Insights Display is not enabled for this guild`
                            }
                        case 'delete':
                            if (args.length > 1) {
                                const statusData = (await db.query(`SELECT * FROM discord_status_records WHERE name = ?`, [args[1]])).rows;
                                const statusCache = statusValues.has(args[1])
                                if (statusData.length > 0 || statusCache) {
                                    statusValues.delete(args[1]);
                                    await db.query(`DELETE FROM discord_status_records WHERE name = ?`, [args[1]])
                                    return `Status value ${args[1]} was deleted successfully`
                                } else {
                                    return "Status value was not found!"
                                }
                            } else {
                                return "Missing the name of a status value to delete"
                            }
                        case 'list':
                            const statusCache = Array.from(statusValues.keys())
                            return 'Status Names:\n' + [...statusValues.keys(), ...(await db.query(`SELECT * FROM discord_status_records`, [args[1]])).rows.filter(e => statusCache.indexOf(e.name) === -1).map(e => e.name)].join('\n');
                        default:
                            return "Invalid Command"
                    }
                } else {
                    return `Missing command, use "help status"`
                }
            }
        }, {
            argsRequired: false,
            caseInsensitive: false,
            description: "Status Controls",
            fullDescription: "Enable/Disable Insights Display and Manage Stored Values\n" +
                "   **tasks** - Prints current request queue\n   **enable** - Add an insights display to this server\n      channel\n**disable** - Removes an insights display for this server\n      [system]\n"+
                "   **delete** - Deletes a stored status record from the cache/database\n      name\n   **list** - Lists all stored status records in the cache/database",
            usage: "command [arguments]",
            guildOnly: true
        })

        discordClient.registerCommand("restart", async function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                shutdownSystem((ok) => {
                    setTimeout(() => { process.exit(0) }, 5000)
                    return "Goodbye! Please restart from server shell!"
                });
            }
        }, {
            argsRequired: false,
            caseInsensitive: false,
            description: "Graceful Restart",
            fullDescription: "Safely and Gracefully restarts Discord I/O while ensuring all jobs and requests are completed",
            guildOnly: true
        })

        discordClient.registerCommand("update", async function (msg,args) {
            if (isAuthorizedUser('command', msg.member.id, msg.guildID, msg.channel.id)) {
                spawn('pm2', ['trigger', 'Updater', 'update-now'])
                return "Requested to update software"
            }
        }, {
            argsRequired: false,
            caseInsensitive: false,
            description: "Update Projects",
            fullDescription: "Updates Kanmi and any other projects definded in the configuration file",
            guildOnly: true
        })
    }
    function isAuthorizedUser(permission, userid, guildid, channelid) {
        let action = false;
        let systemchannelid = '';
        discordservers.forEach(function(server) {
            if (server.serverid.toString() === guildid) {
                systemchannelid = server.chid_system.toString()
            }
        })

        //console.log(`${userid} requested ${permission} privileges for ${guildid}@${channelid}/${systemchannelid}`)

        switch (permission) {
            case 'interact':
                if (authorizedUsers.has(guildid)) {
                    authorizedUsers.get(guildid).forEach(function(user) {
                        if (user.toString() === userid.toString()) {
                            action = true;
                        }
                    })
                    if (action === false) {
                        Logger.printLine("InteractionSecurity", `Unauthorized Interaction by ${userid} @ ${guildid} on ${channelid}`, 'error')
                    }
                    if (botUsers.has(guildid)) {
                        botUsers.get(guildid).forEach(function(user) {
                            if (user.toString() === userid.toString()) {
                                action = false;
                            }
                        })
                    }
                } else {
                    action = false;
                }
                break;
            case 'command':
                if (systemchannelid === channelid) {
                    if (authorizedUsers.has(guildid)) {
                        authorizedUsers.get(guildid).forEach(function(user) {
                            if (user.toString() === userid.toString()) { action = true; }
                        })
                        if (action === false) {
                            Logger.printLine("InteractionSecurity", `Unauthorized Command by ${userid} @ ${guildid} on ${channelid}`, 'error')
                        }
                        if (botUsers.has(guildid)) {
                            botUsers.get(guildid).forEach(function(user) {
                                if (user.toString() === userid.toString()) {
                                    action = false;
                                }
                            })
                        }
                    } else {
                        console.log('Server not found')
                        action = false;
                    }
                } else {
                    console.log('Not system channel')
                    action = false;
                }
                break;
            case 'ReqFile':
                action = true;
                break;
            case 'notBot':
                let bots = [];
                botUsers.forEach(function(guildserver) {
                    guildserver.forEach(function(user) {
                        bots.push(user);
                    })
                })
                if (parseInt(bots.indexOf(userid.toString()).toString()) === -1) {
                    action = true;
                }
                break;
            case 'elevateAllowed':
                if (systemchannelid === channelid) {
                    if (sudoUsers.has(guildid)) {
                        sudoUsers.get(guildid).forEach(function(user) {
                            if (user.toString() === userid.toString()) { action = true; }
                        })
                        if (action === false) {
                            Logger.printLine("InteractionSecurity", `Unauthorized Elevation by ${userid} @ ${guildid} on ${channelid}`, 'error')
                        }
                        if (botUsers.has(guildid)) {
                            botUsers.get(guildid).forEach(function(user) {
                                if (user.toString() === userid.toString()) {
                                    action = false;
                                }
                            })
                        }
                    } else {
                        action = false;
                    }
                } else {
                    action = false;
                }
                break;
            default:
                action = false;
                break;
        }
        return action;
    }
    function SendMessage(message, channel, guild, proccess, inbody) {
        let body = 'undefined'
        let proc = 'Unknown'
        let errmessage = ''
        if (typeof proccess !== 'undefined' && proccess) {
            if (proccess !== 'Unknown') {
                proc = proccess
            }
        }
        if (typeof inbody !== 'undefined' && inbody) {
            if (proc === "SQL") {
                body = "" + inbody.sqlMessage
            } else if (Object.getPrototypeOf(inbody) === Object.prototype) {
                if (inbody.message) {
                    body = "" + inbody.message
                } else {
                    body = "" + JSON.stringify(inbody)
                }
            } else {
                body = "" + inbody
            }
        }
        let sendto, loglevel
        if (channel === "system") {
            loglevel = 'info'
            message = "" + message
        } else if (channel === "systempublic") {
            loglevel = 'info'
            message = "" + message
        } else if (channel === "info") {
            loglevel = 'info'
            message = "🆗 " + message
        } else if (channel === "warn") {
            loglevel = 'warning'
            message = "⚠ " + message
        } else if (channel === "err") {
            loglevel = 'error'
            message = "❌ " + message
        } else if (channel === "crit") {
            loglevel = 'critical'
            message = "⛔ " + message
        } else if (channel === "message") {
            loglevel = 'notice'
            message = "✉️ " + message
        } else {
            loglevel = 'info'
        }
        if (body !== "undefined" ) {
            errmessage = ":\n```" + body.substring(0,500) + "```"
        }
        if (channel === "err" || channel === "crit" ) {
            Logger.printLine(proc, message, loglevel, inbody)
            console.log(inbody)
        } else {
            Logger.printLine(proc, message, loglevel)
            console.log(inbody)
        }
        if (guild.toString() === 'main') {
            if (channel === "system") {
                sendto = staticChID['homeGuild'].System
            } else if (channel === "info") {
                sendto = staticChID['homeGuild'].AlrmInfo
            } else if (channel === "warn") {
                sendto = staticChID['homeGuild'].AlrmWarn
            } else if (channel === "err") {
                sendto = staticChID['homeGuild'].AlrmErr
            } else if (channel === "crit") {
                sendto = staticChID['homeGuild'].AlrmCrit
            } else if (channel === "message") {
                sendto = staticChID['homeGuild'].AlrmNotif
            } else {
                sendto = channel
            }
            discordClient.createMessage(sendto, {
                content: message.substring(0,255) + errmessage
            })
                .catch((er) => {
                    Logger.printLine("Discord", "Failed to send Message", "critical", er)
                });
        } else {
            if (channel === "system") {
                sendto = discordServers.get(guild).chid_system
            } else if (channel === "info") {
                sendto = discordServers.get(guild).chid_msg_info
            } else if (channel === "warn") {
                sendto = discordServers.get(guild).chid_msg_warn
            } else if (channel === "err") {
                sendto = discordServers.get(guild).chid_msg_err
            } else if (channel === "crit") {
                sendto = discordServers.get(guild).chid_msg_crit
            } else if (channel === "message") {
                sendto = discordServers.get(guild).chid_msg_notif
            } else {
                sendto = channel
            }

            discordClient.createMessage(sendto, {
                content: message.substring(0,255) + errmessage
            })
                .catch((er) => {
                    Logger.printLine("Discord", "Failed to send Message", "critical", er)
                });
        }
    }
    // Discord Framework - Maintenance
    async function cleanOldMessages() {
        const _startTime = Date.now().valueOf()
        await activeTasks.set('MSG_PRUNING', { started: _startTime });
        Logger.printLine("SQL", "Getting Discord Autoclean", "debug")
        const autoclean = await db.query(`SELECT * FROM discord_autoclean`)
        if (autoclean.error) {
            Logger.printLine("SQL", "Error getting auto message pruning channels!", "emergency", autoclean.error)
        } else {
            await Promise.all(autoclean.rows.map(async (channel, i, a) => {
                try {
                    const fullmsg = await discordClient.getMessages(channel.channelid, { limit: 10000 })
                    if (fullmsg) {
                        const deleteThese = fullmsg.filter(msg => { return msg.createdAt <= (Date.now() - (parseFloat(channel.time) * 86400000))});
                        if (channel.pintop === 1) {
                            const lastPin = fullmsg.filter(msg => { return msg.createdAt > (Date.now() - (parseFloat(channel.time) * 86400000))}).pop();
                            if (lastPin && lastPin.pinned === false) {
                                try {
                                    await discordClient.pinMessage(channel.channelid, lastPin.id)
                                } catch (err) {
                                    Logger.printLine("AutoClean", `Failed to pin last message`, 'error', err)
                                }
                            }
                        }
                        const bulkMessages = deleteThese.filter( msg => { return msg.createdAt >= (Date.now() - 1166400000) }).map(e => e.id.toString());
                        const oboMessages = deleteThese.filter( msg => { return msg.createdAt < (Date.now() - 1166400000) }).map(e => e.id.toString());
                        await activeTasks.set('MSG_PRUNING', { started: _startTime, details: `${i + 1}/${a.length}:${deleteThese.length}` });

                        if (bulkMessages.length > 0) {
                            const count = bulkMessages.length
                            try {
                                await discordClient.deleteMessages(channel.channelid, bulkMessages, 'Request to delete old messages')
                                Logger.printLine("AutoClean", `Deleted ${count} messages, ${oboMessages.length} must be deleted individually`, 'info')
                            } catch (err) {
                                Logger.printLine("AutoClean", `Error Deleting old messages`, 'error', err)

                            }
                        }
                        if (oboMessages.length > 0) {
                            await Promise.all(oboMessages.map(async msg => {
                                try {
                                    await discordClient.deleteMessage(channel.channelid, msg, 'Request to delete old messages')
                                } catch (err) {
                                    Logger.printLine("AutoClean", `Error Deleting old messages`, 'error', err)
                                }
                            }))
                        }
                    }
                } catch (err) {
                    console.error(err)
                    Logger.printLine("AutoClean", `Failed to get messages for channel ${channel.channelid}`, "error", err)
                    if (err.message === 'Unknown Channel') {
                        try {
                            await db.query(`DELETE FROM discord_autoclean WHERE channelid = ?`, [channel.channelid])
                        } catch (e) {
                            Logger.printLine("AutoClean", `Failed to delete dead channel ${channel.channelid}`, "error", e)
                        }
                    }
                }
            }))
        }
        await activeTasks.delete('MSG_PRUNING');
    }
    async function deleteAbove(channel, last) {
        const _startTime = Date.now().valueOf()
        await activeTasks.set('MSG_DELETE_ABOVE', { started: _startTime });
        try {
            const fullmsg = await discordClient.getMessages(channel, '10000', last)
            if (fullmsg) {
                let _bulkMessages = fullmsg.filter( msg => { return msg.createdAt >= (Date.now() - 1166400000) }).map(e => e.id.toString());
                const oboMessages = fullmsg.filter( msg => { return msg.createdAt < (Date.now() - 1166400000) }).map(e => e.id.toString());
                activeTasks.set('MSG_DELETE_ABOVE', { started: _startTime, details: fullmsg.length });
                try {
                    const lastmsg = await discordClient.getMessages(channel, '1' );
                    if (lastmsg && lastmsg.length > 0) {
                        if (lastmsg.pop().id === last) {
                            try {
                                await discordClient.deleteMessage(channel, last, 'Request to delete old messages')
                            } catch (err) {
                                Logger.printLine("Clean", `Error Deleting old messages`, 'error', err);
                            }
                        } else {
                            try {
                                await discordClient.pinMessage(channel, last)
                            } catch (err) {
                                Logger.printLine("Clean", `Error Pinning last message`, 'error', err);
                            }
                        }
                    }
                } catch (err) {
                    Logger.printLine("Clean", `Error Checking last message`, 'error', err);
                }
                if (_bulkMessages.length > 0) {
                    const count = _bulkMessages.length
                    try {
                        await discordClient.deleteMessages(channel, _bulkMessages, 'Request to delete old messages')
                        Logger.printLine("Clean", `Deleted ${count} messages, ${oboMessages.length} must be deleted individually`, 'info')
                    } catch (err) {
                        Logger.printLine("Clean", `Failed to delete ${count} messages`, 'error', err)
                    }
                }
                if (oboMessages.length > 0) {
                    await Promise.all(oboMessages.map(async (msg) => {
                        try {
                            await discordClient.deleteMessage(channel, msg, 'Request to delete old messages')
                        } catch (err) {
                            Logger.printLine("Clean", `Error Deleting old messages`, 'error', err)
                        }
                    }))
                }
            }
        } catch (err) {
            console.error(err)
            Logger.printLine("Clean", `Failed to get messages for channel ${channel}`, "error", err)
        }
        await activeTasks.delete('MSG_DELETE_ABOVE');
    }
    async function reloadLocalCache() {
        await activeTasks.set('REFRESH_LOCAL_CACHE',{ started: Date.now().valueOf() });
        try {
            let registeredServers = new Map();
            await Promise.all(discordservers.map(async (server) => {
                const _br = (discordperms.filter(e => { return e.server === server.serverid && e.name === 'sysbot'}).pop()).role
                const _au = (discordperms.filter(e => { return e.server === server.serverid && e.name === 'system_interact' }).pop()).role
                const _ad = (discordperms.filter(e => { return e.server === server.serverid && e.name === 'system_admin' }).pop()).role

                await registeredServers.set(server.serverid, {
                    authenticatedRole: _au,
                    botsRole: _br,
                    sudoRole: _ad,
                })
            }))
            await Promise.all(Array.from(discordClient.guilds.keys()).filter(e => registeredServers.has(e)).map(async (guildID) => {
                const guild = discordClient.guilds.get(guildID)
                const authenticatedRole = registeredServers.get(guild.id.toString()).authenticatedRole
                const botsRole = registeredServers.get(guild.id.toString()).botsRole
                const sudoRole = registeredServers.get(guild.id.toString()).sudoRole
                let _authorizedUsers = [];
                let _sudoUsers = [];
                let _botUsers = [];
                await Promise.all(Array.from(guild.members.keys()).map(async (memberID) => {
                    const member = guild.members.get(memberID)
                    if (parseInt(member.roles.indexOf(authenticatedRole).toString()) !== -1) {
                        _authorizedUsers.push(member.id);
                    }
                    if (parseInt(member.roles.indexOf(sudoRole).toString()) !== -1) {
                        _sudoUsers.push(member.id);
                    }
                    if (parseInt(member.roles.indexOf(botsRole).toString()) !== -1) {
                        _botUsers.push(member.id);
                    }
                }))
                await authorizedUsers.set(guild.id.toString(), _authorizedUsers);
                await sudoUsers.set(guild.id.toString(), _sudoUsers);
                await botUsers.set(guild.id.toString(), _botUsers);

                const _updateServer = await db.query('UPDATE discord_servers SET avatar = ?, name = ? WHERE serverid = ? AND authware_enabled = 0', [guild.icon, guild.name, guild.id])
                if (_updateServer.error) {
                    SendMessage(`Error updating server info for ${guild.name}!`, "warning", 'main', "SQL", _updateServer.error)
                }

                await Promise.all(Array.from(guild.channels.keys()).map(async (channelID) => {
                    const channel = guild.channels.get(channelID);
                    const found = await db.query('SELECT * FROM kanmi_channels WHERE channelid = ? AND source = 0', [channel.id])
                    if (found.error) {
                        SendMessage(`Error verifying channel info for ${channel.id}!`, "warning", 'main', "SQL", found.error)
                    } else if (found.rows.length > 0) {
                        await channelUpdate(channel);
                    } else {
                        await channelCreate(channel);
                    }
                }))
            }))
            if (systemglobal.Discord_Recycling_Bin) {
                try {
                    const messages = await discordClient.getMessages(systemglobal.Discord_Recycling_Bin, 6)
                    await cacheData.set(systemglobal.Discord_Recycling_Bin, (messages) ? messages.length : 0)
                } catch (err) {
                    Logger.printLine("RefreshCache", `Unable to check contents of recycling bin`, 'error', err)
                    console.error(err)
                }
            }
            await checkThreadsExpirations();
        } catch (err) {
            Logger.printLine("RefreshCache", `Failed to refresh local cache data`, 'error', err)
            console.log(err);
        }
        await activeTasks.delete('REFRESH_LOCAL_CACHE');
    }
    async function syncStatusValues (){
        const statusData = await db.query(`SELECT * FROM discord_status_records`);
        const statusKeys = statusData.rows.map(e => e.name)

        await Promise.all(Array.from(statusValues.keys()).filter(e => statusKeys.indexOf(e) === -1).map(async k => {
            await db.query(`INSERT INTO discord_status_records SET ?`, [{
                name: k,
                data: JSON.stringify(statusValues.get(k))
            }])
            console.log('Added new status key to database')
        }))
        await Promise.all(statusData.rows.map(async exStat => {
            const _cacheValue = statusValues.get(exStat.name);
            if (exStat.name.includes('watchdog')) {
                await statusValues.set(exStat.name, exStat.data);
            } else if (_cacheValue && md5(JSON.stringify(exStat.data)) !== md5(JSON.stringify(_cacheValue))) {
                await db.query(`REPLACE INTO discord_status_records SET ?`, [{
                    name: exStat.name,
                    data: JSON.stringify(_cacheValue)
                }])
                //console.log(`Updated status value for ${exStat.name} in database`)
            } else if (!_cacheValue) {
                await statusValues.set(exStat.name, exStat.data);
                console.log(`Imported status value for ${exStat.name} in database`)
            }
        }))
    }
    async function refreshCounts() {
        await activeTasks.set('REFRESH_COUNTS', true);
        const totalCounts = await db.query(`SELECT SUM(filesize) AS total_data, COUNT(filesize) AS total_count FROM kanmi_records`)
        if (totalCounts.error) {
            Logger.printLine("RefreshCounts", `Unable to check total counts`, 'error', totalCounts.error)
         } else if (totalCounts.rows.length === 1) {
            const totalStatus = await db.query(`SELECT * FROM discord_status WHERE name LIKE 'seq_total_%'`)
            if (totalStatus.error) {
                Logger.printLine("RefreshCounts", `Unable to check total counts status channels`, 'error', totalStatus.error)
            } else if (totalStatus.rows.length > 0) {
                await Promise.all(totalStatus.rows.map(async (chStatus) => {
                    let textValue
                    if (chStatus.name.endsWith('files')) {
                        textValue = `📁 ${totalCounts.rows[0].total_count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} Files`;
                    } else if (chStatus.name.endsWith('usage')) {
                        const totalData = parseInt(totalCounts.rows[0].total_data.toString());
                        textValue = ''
                        if (totalData > 1024000) {
                            textValue = `💾 ${(totalData / 1024000).toFixed(2)} TB`
                        } else if (totalData > 1024) {
                            textValue = `💾 ${(totalData / 1024).toFixed(2)} GB`
                        } else {
                            textValue = `💾 ${totalData} MB`
                        }
                    }
                    if (textValue) {
                        const channel = discordClient.getChannel(chStatus.channel);
                        if (channel && channel.name !== textValue) {
                            try {
                                await discordClient.editChannel(chStatus.channel, {name: textValue}, "Update Total Counts")
                            } catch (err) {
                                console.error(err.message)
                                Logger.printLine("Discord", "Can't update channel name for Total count Updates", "error", err)
                            }
                        }
                    }
                }))
            }
        }
        await activeTasks.delete('REFRESH_COUNTS');
    }
    function resetStates() {
        localParameters.keys().then((localKeys) => {
            discordClient.guilds.forEach((guild) => {
                // Resume Music Playback
                if (systemglobal.RadioFolder) {
                    if (localKeys.indexOf("player-" + guild.id) !== -1 ) {
                        localParameters.getItem('player-' + guild.id)
                            .then(function (values) {
                                if (values.status === 'on' && values.channel !== null) {
                                    playingStatus.set(guild.id, true);
                                    nowPlaying.valuesWithKeyMatch(guild.id + '-')
                                        .then(function (items) {
                                            discordClient.joinVoiceChannel(values.channel)
                                                .catch((err) => {
                                                    SendMessage("There was an error connecting to the radio station!", "err", guild.id, "RadioStop", err)
                                                })
                                                .then((connection) => {
                                                    if (parseInt(items.length.toString()) === 0) {
                                                        discordClient.leaveVoiceChannel(values.channel)
                                                        localParameters.setItem('player-' + guild.id, {
                                                            status: 'off',
                                                            key: '',
                                                            channel: '',
                                                        })
                                                            .then(function () {
                                                                playingStatus.set(guild.id, false);
                                                            })
                                                            .catch(function (err) {
                                                                SendMessage("❌ Failed to set player status", "system", guild.id, "Musicbox")
                                                                Logger.printLine(`Musicbox`, `Failed to set play status`, `error`, err)
                                                            })
                                                    } else {
                                                        playStation(connection, "restart")
                                                    }
                                                })
                                        })
                                } else {
                                    playingStatus.set(guild.id, false);
                                }
                            })
                            .catch(function (err) {
                                Logger.printLine(`Musicbox`, `Failed to set play status`, `error`, err)
                            })
                    } else {
                        Logger.printLine("Musicbox", `Initializing Play Status for "${guild.name}"`, 'warn')
                        localParameters.setItem('player-' + guild.id, {
                            status: 'off',
                            key: '',
                            channel: '',
                        })
                            .catch(function (err) {
                                Logger.printLine(`player`, `Failed to initialize the Play Status for "${guild.name}"`, `error`, err)
                            })
                        playingStatus.set(guild.id, false);
                    }
                }
                // Resume Collector
                if (localKeys.indexOf("collector-" + guild.id) !== -1 ) {
                    localParameters.getItem("collector-" + guild.id).then((value) => {
                        if ( value.status === 'on' ) {
                            collectorEnable.set(guild.id, true)
                        } else {
                            collectorEnable.set(guild.id, false)
                        }
                    })
                        .catch(function(err) {
                            collectorEnable.set(guild.id, false)
                            Logger.printLine("messageCollector", `Failed to read the local parameter for the collector status for "${guild.name}"!`, 'error', err)
                        })
                } else {
                    Logger.printLine("messageCollector", `Initializing Message Collector for "${guild.name}"`, 'warn')
                    localParameters.setItem('collector-' + guild.id, {
                        status: 'off'
                    })
                        .catch(function (err) {
                            Logger.printLine(`Collector`, `Failed to initialize the message collector for "${guild.name}"`, `error`, err)
                            collectorEnable.set(guild.id, false)
                        })
                }
            })
        });
        // Generate Music Folders
        if (systemglobal.RadioFolder) {
            musicFolders = fs.readdirSync(systemglobal.RadioFolder);
        }
    }
    function resetInitStates() {
        localParameters.keys().then((localKeys) => {
            discordClient.getRESTGuilds()
                .then(function (guilds) {
                    guilds.forEach(function (guild) {
                        if (localKeys.indexOf("statusgen-" + guild.id) !== -1 ) {
                            Logger.printLine(`StatusGenerator`, `Initialized Timer for status update for "${guild.name}"`, `info`)
                            Timers.set(`StatusReport${guild.id}`, setInterval(() => {
                                generateStatus(true, guild.id)
                            }, 300000))
                            Timers.set(`StatusReportCheck${guild.id}`, cron.schedule('* 0-2,9-23 * * *', () => {
                                generateStatus(false, guild.id)
                            }))
                        }
                    })
                })
        });
        // Generate Music Folders
        if (systemglobal.Discord_Radio_Enable && systemglobal.RadioFolder) {
            musicFolders = fs.readdirSync(systemglobal.RadioFolder);
        }
    }
    async function generateStatus(forceUpdate, guildID, channelID) {
        let data
        try {
            data = await localParameters.getItem('statusgen-' + guildID)
        } catch (e) {
            console.error("Failed to get guild local parameters")
        }
        let channel = null
        let systemWarning = false;
        let UndeliveredMQ = 0;
        let bannerWarnings = [];
        let systemFault = false;
        let bannerFault = [];
        if (channelID) {
            channel = channelID
        }
        else if (data && data.channel) {
            channel = data.channel
        }
        else {
            return false;
        }

        const activeProccessing = Object.entries(discordClient.requestHandler.ratelimits).filter(e => e[1].remaining === 0 && e[1].processing !== false && e[0] !== '/users/@me/guilds')
        const taskNames = activeProccessing.filter(e => !e[0].startsWith('/')).map(e => e[0].split('/')[0])
        const statusData = Array.from(statusValues.entries()).map(e => {
            return {
                name: e[0],
                data: e[1]
            }
        })

        let embed = {
            "footer": {
                "text": "System Status",
                "icon_url": discordClient.guilds.get(guildID).iconURL
            },
            "timestamp": (new Date().toISOString()) + "",
            "color": 65366,
            "image" : {
                "url": null
            },
            "fields": [
                {
                    "name": "🕓 Uptime",
                    "value": `${msConversion(process.uptime() * 1000)} (${msConversion(discordClient.uptime)})`.substring(0,1024),
                    "inline": true
                },
                {
                    "name": "📚 Servers",
                    "value": `${discordClient.guilds.size}`.substring(0,1024),
                    "inline": true
                },
            ]
        }
        let discordMQ = {
            "title": "Discord I/O Queue Status",
            "color": 1502061,
            "fields": []
        }
        let fileworkerMQ = {
            "title": "FileWorker Queue Status",
            "color": 1502061,
            "fields": []
        }
        // Get MQ Statics
        let discordMQMessages = 0;
        try {
            const promisifiedRequest = function(options) {
                return new Promise((resolve,reject) => {
                    request(options, (error, response, body) => {
                        if (response) {
                            return resolve(response);
                        }
                        if (error) {
                            return reject(error);
                        }
                    });
                });
            };
            const ampqResponse = await promisifiedRequest({
                url: `http://${systemglobal.MQServer}:15672/api/queues`,
                headers: {
                    'content-type': "application/json",
                    "Authorization" : "Basic " + Buffer.from(systemglobal.MQUsername + ":" + systemglobal.MQPassword).toString("base64"),
                }
            })
            let ampqJSON = [];
            if (!ampqResponse.err && ampqResponse.body) {
                ampqJSON = JSON.parse(ampqResponse.body.toString()).filter(e => !e.name.startsWith('command.'));
            } else if (ampqResponse.err) {
                console.error(ampqResponse.err)
            }
            await ampqJSON.filter(e => e.name.includes(MQWorker10)).forEach(e => { UndeliveredMQ = e.messages; })
            await ampqJSON.filter(e => e.name.includes('.discord')).map(e => {
                discordMQMessages = discordMQMessages + e.messages
                let _name = ''
                let _return = '';
                let id = 0;
                switch (e.name.split('.')[0].toLowerCase()) {
                    case 'inbox':
                        _name += '📥'
                        id = id + 10
                        break;
                    case 'outbox':
                        _name += '📤'
                        break;
                    default:
                        break;
                }
                switch (e.name.split('.discord').pop().toLowerCase()) {
                    case '.':
                        _name += '⭐ Standard'
                        id = id + 1
                        break;
                    case '.priority':
                        _name += '💨 Priority'
                        break;
                    case '.package.priority':
                        _name += '💨 Packaged Priority'
                        break;
                    case '.package':
                        _name += '💨 Packaged'
                        break;
                    case '.backlog':
                        _name += '☃ Backlog'
                        id = id + 2
                        break;
                    default:
                        _name = e.name
                        break;
                }
                if (e.messages > 0) {
                    _return += `📬: ${e.messages}(${e.messages_details.rate})\n`
                }
                if (e.message_bytes >= 1000000) {
                    _return += `📦: ${(e.message_bytes / 1000000).toFixed(1)}M\n`
                } else if (e.message_bytes >= 1000) {
                    _return += `📦: ${(e.message_bytes / 1000).toFixed(1)}K\n`
                } else if (e.message_bytes > 100) {
                    _return += `📦: ${e.message_bytes}B\n`
                }
                if (e.message_stats) {
                    if (e.message_stats.publish > 1000000) {
                        _return += `📈: ▶${(e.message_stats.publish / 100000).toFixed(1)}M`
                    } else if (e.message_stats.publish > 1000) {
                        _return += `📈: ▶${(e.message_stats.publish / 1000).toFixed(1)}K`
                    } else if (e.message_stats.publish > 0) {
                        _return += `📈: ▶${e.message_stats.publish}`
                    } else {
                        _return += `Never Activated`
                    }
                    if (e.message_stats.publish > 0) {
                        _return += ` ☑${((e.message_stats.ack / e.message_stats.publish) * 100).toFixed()}% 🔁${((e.message_stats.redeliver / e.message_stats.publish) * 100).toFixed(0)}%`
                    }
                }
                if (e.messages > 2) {
                    return [id, {
                        "name": _name,
                        "value": _return.substring(0,1024),
                    }]
                }
                return null
            }).filter(e => e !== null).sort((a, b) => a[0]-b[0]).forEach(e => {
                discordMQ.fields.push(e[1])
            })
            await ampqJSON.filter(e => e.name.includes('.fileworker')).map(e => {
                let _name = ''
                let _return = '';
                let id = 0;
                switch (e.name.split('.').pop().toLowerCase()) {
                    case 'fileworker':
                        _name += '⚙ Remote Requests'
                        break;
                    case 'backlog':
                        _name += '⚙ Backlog Requests'
                        id = id + 1
                        break;
                    case 'local':
                        const hostname = e.name.split('inbox.fileworker.').pop().split('.local')[0]
                        _name += '💽 ' + hostname + ' File Uploads'
                        id = hostname
                        break;
                    default:
                        _name += e.name
                        break;
                }
                if (e.messages > 0) {
                    _return += `📬: ${e.messages}(${e.messages_details.rate})\n`
                }
                if (e.message_bytes >= 1000000) {
                    _return += `📦: ${(e.message_bytes / 1000000).toFixed(1)}M\n`
                } else if (e.message_bytes >= 1000) {
                    _return += `📦: ${(e.message_bytes / 1000).toFixed(1)}K\n`
                } else if (e.message_bytes > 100) {
                    _return += `📦: ${e.message_bytes}B\n`
                }
                if (e.message_stats) {
                    if (e.message_stats.publish > 1000000) {
                        _return += `📈: ▶${(e.message_stats.publish / 100000).toFixed(1)}M`
                    } else if (e.message_stats.publish > 1000) {
                        _return += `📈: ▶${(e.message_stats.publish / 1000).toFixed(1)}K`
                    } else if (e.message_stats.publish > 0) {
                        _return += `📈: ▶${e.message_stats.publish}`
                    } else {
                        _return += `Never Activated`
                    }
                    if (e.message_stats.publish > 0) {
                        _return += ` ☑${((e.message_stats.ack / e.message_stats.publish) * 100).toFixed()}% 🔁${((e.message_stats.redeliver / e.message_stats.publish) * 100).toFixed(0)}%`
                    }
                }
                if (e.messages > 2) {
                    return [id, {
                        "name": _name,
                        "value": _return.substring(0,1024),
                    }]
                }
                return null
            }).filter(e => e !== null).sort((a, b) => a[0]-b[0]).forEach(e => {
                fileworkerMQ.fields.push(e[1])
            })
        } catch (e) {
            console.error(e);
        }
        let _ud = [];
        // Get Insight Footer Image
        if (systemglobal.Discord_Insights_Custom_Image_URL && systemglobal.Discord_Insights_Custom_Image_URL[guildID] !== undefined) {
            embed.image = {
                "url": systemglobal.Discord_Insights_Custom_Image_URL[guildID]
            }
        }
        else if (systemglobal.Discord_Insights_Custom_Image_URL && systemglobal.Discord_Insights_Custom_Image_URL.default !== undefined) {
            embed.image = {
                "url": systemglobal.Discord_Insights_Custom_Image_URL.default
            }
        }
        else {
            embed.image = undefined;
        }
        // Undelivered Messages Counts
        if (systemglobal.Discord_Recycling_Bin && cacheData.has(systemglobal.Discord_Recycling_Bin)) {
            const binChannel = await cacheData.get(systemglobal.Discord_Recycling_Bin);
            if (binChannel >= 5) { systemFault = true; }
            if (binChannel > 0)
                _ud.push("🅰 " + (`${(binChannel < 5) ? "🆕" : "🚨"} ${(binChannel < 5) ? binChannel : "5+"} Items Waiting`))
            if (UndeliveredMQ > 0)
                _ud.push("🅱 " + (`${(UndeliveredMQ < 5) ? "🆕" : "🚨"} ${(UndeliveredMQ < 5) ? UndeliveredMQ : "5+"} Items Waiting`));
        }
        else {
            if (UndeliveredMQ >= 5) { systemFault = true; }
            if (UndeliveredMQ > 0)
                _ud.push(`${(UndeliveredMQ < 5) ? "🆕" : "🚨"} ${(UndeliveredMQ < 5) ? UndeliveredMQ : "5+"} Items Waiting`);
        }
        embed.fields.push({
            "name": "✉ Undelivered",
            "value": `${(_ud.length > 0) ? _ud.join('\n') : '✅ None'}`.substring(0,1024),
            "inline": true
        })

        let _bt = '❔ Unknown'
        let _bc = null;

        // File Count and Usage
        const totalCounts = await db.query(`SELECT SUM(filesize) AS total_data, COUNT(filesize) AS total_count FROM kanmi_records WHERE (attachment_hash IS NOT NULL OR fileid IS NOT NULL)`);
        if (!totalCounts.error && totalCounts.rows.length > 0) {
            // File Count
            embed.fields.push({
                "name": "📁 Files",
                "value": `${totalCounts.rows[0].total_count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`.substring(0,1024),
                "inline": true
            })
            const totalData = parseInt(totalCounts.rows[0].total_data.toString());
            // File Usage
            let totalText = ''
            if (totalData > 1024000) {
                totalText += `${(totalData / 1024000).toFixed(2)} TB`
            } else if (totalData > 1024) {
                totalText += `${(totalData / 1024).toFixed(2)} GB`
            } else {
                totalText += `${totalData} MB`
            }
            embed.fields.push({
                "name": "💾 Usage",
                "value": totalText.substring(0,1024),
                "inline": true
            })
        }
        // Backup and Sync System
        _bc = await Promise.all((await db.query(`SELECT DISTINCT system_name FROM kanmi_backups ORDER BY system_name`)).rows.map(async (row) => {
            const configForHost = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) ORDER BY system_name`, [row.system_name])
            let partsDisabled = false;
            let cdsAccess = false;
            let backupInterval = 3600000;
            let ignoreQuery = [];
            if (configForHost.rows.length > 0) {
                const _backup_config = configForHost.rows.filter(e => e.param_key === 'backup');
                if (_backup_config.length > 0 && _backup_config[0].param_data) {
                    if (_backup_config[0].param_data.backup_parts)
                        partsDisabled = !(_backup_config[0].param_data.backup_parts);
                    if (_backup_config[0].param_data.interval_min)
                        backupInterval = parseInt(_backup_config[0].param_data.interval_min.toString()) * 60000
                    if (_backup_config[0].param_data.cache_base_path || _backup_config[0].param_data.pickup_base_path)
                        cdsAccess = true;
                }
                const _backup_ignore = configForHost.rows.filter(e => e.param_key === 'backup.ignore');
                if (_backup_ignore.length > 0 && _backup_ignore[0].param_data) {
                    if (_backup_ignore[0].param_data.channels)
                        ignoreQuery.push(..._backup_ignore[0].param_data.channels.map(e => `channel != '${e}'`))
                    if (_backup_ignore[0].param_data.servers)
                        ignoreQuery.push(..._backup_ignore[0].param_data.servers.map(e => `server != '${e}'`))
                }
            }



            const fileCounts = await db.query(`SELECT COUNT(x.eid) AS backup_needed FROM (SELECT * FROM kanmi_records WHERE source = 0 AND ((attachment_hash IS NOT NULL AND attachment_extra IS NULL)${(cdsAccess) ? ' OR (filecached IS NOT NULL AND filecached = 1)' : ''})${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) x LEFT OUTER JOIN (SELECT * FROM kanmi_backups WHERE system_name = ?) y ON (x.eid = y.eid) WHERE y.bid IS NULL`, [row.system_name]);
            let partCounts = { rows: [] }
            if (!partsDisabled) {
                partCounts = await db.query(`SELECT COUNT(x.partmessageid) AS backup_needed FROM (SELECT kanmi_records.eid, kanmi_records.fileid, kanmi_records.source, discord_multipart_files.messageid AS partmessageid FROM discord_multipart_files, kanmi_records WHERE discord_multipart_files.fileid = kanmi_records.fileid AND discord_multipart_files.valid = 1 AND kanmi_records.source = 0${(ignoreQuery.length > 0) ? ' AND (' + ignoreQuery.join(' AND ') + ')' : ''}) x LEFT OUTER JOIN (SELECT * FROM discord_multipart_backups WHERE system_name = ?) y ON (x.partmessageid = y.messageid) WHERE y.bid IS NULL`, [row.system_name]);
            }
            return {
                hostname: row.system_name,
                files: (fileCounts.rows.length > 0) ? parseInt(fileCounts.rows[0].backup_needed.toString()) : 0,
                parts: (!partsDisabled) ? (fileCounts.rows.length > 0) ? parseInt(partCounts.rows[0].backup_needed.toString()) : 0 : 0,
                interval: backupInterval
            }
        }))
        let backupValues = [];
        function getPrefix(index, length) {
            let _bcP = ''
            if (length > 1) {
                switch (index + 1) {
                    case 1:
                        _bcP += (length < 3) ? '🅰' : '1️⃣'
                        break;
                    case 2:
                        _bcP += (length < 3) ? '🅱' : '2️⃣'
                        break;
                    case 3:
                        _bcP += '3️⃣'
                        break;
                    case 4:
                        _bcP += '4️⃣'
                        break;
                    case 5:
                        _bcP += '5️⃣'
                        break;
                    case 6:
                        _bcP += '6️⃣'
                        break;
                    case 7:
                        _bcP += '7️⃣'
                        break;
                    case 8:
                        _bcP += '8️⃣'
                        break;
                    case 9:
                        _bcP += '9️⃣'
                        break;
                    case 10:
                        _bcP += '🔟'
                        break;
                    default:
                        _bcP += '*️⃣'
                        break;
                }
                _bcP += ' '
            }
            return _bcP
        }
        let extraText= []
        backupValues = statusData.filter(f => f.name.startsWith('syncstat_'))
            .map((e,i,a) => {
                const _bcF = _bc.filter(f => f.hostname.startsWith(e.name.split('_').pop()))
                if (_bcF.length > 0) {
                    if (e.data.active && e.data.total > 25) {
                        const _si = e.data;
                        let lns = [];
                        if (((e.data.timestamp) ? ((Date.now().valueOf() - e.data.timestamp) >= (_bcF[0].interval * 2)) : false)) {
                            systemWarning = true;
                            bannerWarnings.push(`🗄 Sync System ${getPrefix(i, a.length)}"${_bcF[0].hostname}" has not responded sense <t:${(e.data.timestamp / 1000).toFixed(0)}:R>`)
                        } else {
                            if (_bcF[0].files >= 500 || _bcF[0].parts >= 500) {
                                systemWarning = true;
                                bannerWarnings.push(`🗄 Sync System ${getPrefix(i, a.length)}"${_bcF[0].hostname}" is degraded!`)
                            } else if (_bcF[0].files >= 100 || _bcF[0].parts >= 250) {
                                systemWarning = true;
                                bannerWarnings.push(`🗄 Sync System ${getPrefix(i, a.length)}"${_bcF[0].hostname}" may be degrading!`)
                            }


                            if (_bcF.length > 0 && _bcF[0].files > 0 && _si.proccess === 'files') {
                                lns.push(`🔄💾 ${_bcF[0].files.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} - 📥${_si.percent}% (${_si.left.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")})`)
                            } else if (_bcF.length > 0 && _bcF[0].files > 0) {
                                lns.push(`✅💾 ${_bcF[0].files.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                            }
                            if (_bcF.length > 0 && _bcF[0].parts > 0 && _si.proccess === 'parts') {
                                lns.push(`🔄🧩 ${_bcF[0].parts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} - 📥${_si.percent}% (${_si.left.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")})`)
                            } else if (lns.length > 0 && _bcF.length > 0 && _bcF[0].parts > 0) {
                                lns.push(`🟦🧩 ${_bcF[0].parts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                            } else if (_bcF.length > 0 && _bcF[0].parts > 0) {
                                lns.push(`✅🧩 ${_bcF[0].parts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                            }
                        }
                        if (lns.length > 0) {
                            return {
                                "name": `🗄 ${getPrefix(i, a.length)}${_si.hostname} Sync Status`,
                                "value": `${lns.join('\n')}`.substring(0,1024)
                            };
                        } else {
                            if (_bcF[0].files > 0) {
                                extraText.push(`${getPrefix(i, a.length)}💾 ${_bcF[0].files.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                            }
                            if (_bcF[0].parts > 0) {
                                extraText.push(`${getPrefix(i, a.length)}🧩 ${_bcF[0].parts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                            }
                        }
                    } else {
                        if (e.data.cleanup) {
                            systemWarning = true;
                            bannerWarnings.push(`🗄 Sync System ${getPrefix(i, a.length)}"${_bcF[0].hostname}" is cleaning up the filesystem`)
                        }
                        if (((e.data.timestamp && _bcF[0]) ? ((Date.now().valueOf() - e.data.timestamp) >= (_bcF[0].interval * 2)) : false)) {
                            systemWarning = true;
                            bannerWarnings.push(`🗄 Sync System ${getPrefix(i, a.length)}"${_bcF[0].hostname}" has not responded sense <t:${(e.data.timestamp / 1000).toFixed(0)}:R>`)
                        }
                        if (_bcF[0].files > 25) {
                            extraText.push(`${getPrefix(i, a.length)}💾 ${_bcF[0].files.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                        }
                        if (_bcF[0].parts > 50) {
                            extraText.push(`${getPrefix(i, a.length)}🧩 ${_bcF[0].parts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                        }
                    }
                }
                return false
            }).filter(e => !(!e))
        if (backupValues.length > 0) {
            embed.fields.push({
                "name": "🗄 Sync",
                "value": `🔄 ${backupValues.length} Active${(extraText.length) ? '\n' : ''}${extraText.join('\n')}`.substring(0,1024),
                "inline": true
            })
            embed.fields.push(...backupValues)
        }
        else {
            const _bcF = _bc.filter(e => e.files >= 25 || e.parts >= 50 )
            if (_bcF.length > 0) {
                const length = statusData.filter(f => f.name.startsWith('syncstat_')).length
                _bt = [];
                await _bcF.forEach((e,i) => {
                    if (e.files > 0) {
                        _bt.push(`${getPrefix(i, length)}💾 ${e.files.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                    }
                    if (e.parts > 0) {
                        _bt.push(`${getPrefix(i, length)}🧩 ${e.parts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`)
                    }
                    if (e.files >= 500 || e.parts >= 500) {
                        systemWarning = true;
                        bannerWarnings.push(`🗄 Sync System ${getPrefix(i, _bcF.length)}"${e.hostname}" is degraded!`)
                    } else if (e.files >= 100 || e.parts >= 250) {
                        systemWarning = true;
                        bannerWarnings.push(`🗄 Sync System ${getPrefix(i, _bcF.length)}"${e.hostname}" may be degrading!`)
                    }
                })
                _bt = _bt.join('\n')
            } else {
                _bt = '✅ Complete'
            }
            embed.fields.push({
                "name": "🗄 Sync",
                "value": _bt.substring(0,1024),
                "inline": true
            })
        }
        // Active Tasks
        let _ioT = []
        if (activeProccessing.length > 0) {
            _ioT.push('**🔄 ' + activeProccessing.length + ' Requests Enqueued' + ((taskNames.length > 0) ? ' (' + taskNames.join('/') + ')' : '').toString() + '**')
        }
        else {
            _ioT.push('🟢 No Active Requests')
        }
        if (activeTasks.size > 0) {
            let _ioOA = [];
            await activeTasks.forEach(async (v,k) => {
                let _it = `${k}`
                if (v.started) {
                    if (Date.now().valueOf() >= v.started + 300000) {
                        _it = `⚠${k}`
                        systemWarning = true;
                        bannerWarnings.push(`⚙ Active Job "${k}" is taking a long time to complete`)
                    } else if (Date.now().valueOf() >= v.started + 60000) {
                        _it = `⏳${k}`
                    }
                }
                if (v.details) {
                    _it += `[${v.details}]`
                }
                _ioOA.push(`*${_it}*`)
            })
            _ioT.push(`⚙ ${activeTasks.size} Active Jobs`)
            _ioT.push(..._ioOA)
        } else {
            _ioT.push(`💤 No Active Jobs`)
        }
        if (discordMQMessages > 0) {
            _ioT.push(`***📬 ${discordMQMessages} Pending Jobs***`)
            if (discordMQMessages > 150) {
                systemFault = true;
                bannerFault.unshift('📬 Message Queue is actively backlogged!')
            } else if (discordMQMessages > 50) {
                systemWarning = true;
                bannerWarnings.unshift('📬 Message Queue is getting congested')
            }
        }
        embed.fields.push({
            "name": "⚡ I/O Engine",
            "value": _ioT.join('\n').substring(0,1024)
        })
        if (activeProccessing.length > 10) { systemWarning = true; }
        // Extended Entity Statistics
        function convertMBtoText(value, noUnit) {
            const diskValue = parseFloat(value.toString());
            if (diskValue >= 1000000) {
                return `${(diskValue / (1024 * 1024)).toFixed(1)}${(noUnit) ? '' : ' TB'}`
            } else if (diskValue >= 1000) {
                return `${(diskValue / 1024).toFixed(1)}${(noUnit) ? '' : ' GB'}`
            } else {
                return `${diskValue.toFixed(1)}${(noUnit) ? '' : ' MB'}`
            }
        }
        const diskValues = statusData.filter(e => e.name.endsWith('_disk'))
            .map(statusRecord => {
                const _si = statusRecord.data;
                let _sL = [];
                if (_si.diskFault) {
                    bannerFault.push(`📀 Disk "${_si.diskMount}" free space is low!`);
                }
                if (_si.preferUsed) {
                    _sL.push(`${_si.statusIcon} ${convertMBtoText(_si.diskUsed)} (${_si.diskPercent}%)`)
                    _sL.push(`${convertMBtoText(_si.diskFree, true)} / ${convertMBtoText(_si.diskTotal)}`)
                } else {
                    _sL.push(`${_si.statusIcon} ${convertMBtoText(_si.diskFree)} (${_si.diskPercent}%)`)
                    _sL.push(`${convertMBtoText(_si.diskUsed, true)} / ${convertMBtoText(_si.diskTotal)}`)
                }

                return {
                    "name": `${_si.diskIcon}${(_si.diskName && _si.diskName.length > 1) ? ' ' + _si.diskName : ''} Disk${(!((_si.timestamp) ? ((Date.now().valueOf() - _si.timestamp) < (4 * 60 * 60000)) : true)) ? ' 🕗' : ''}`,
                    "value": `${_sL.join('\n')}`.substring(0,1024),
                    "inline": true
                };
            })
        if (diskValues.length > 0) {
            embed.fields.push(...diskValues)
        }
        const watchdogValues = statusData.filter(e => e.name.startsWith('watchdog_'))
            .map(statusRecord => {
                const _si = statusRecord.data;
                bannerWarnings.push(..._si.wdWarnings.map(e => '👁 ' + e));
                bannerFault.push(..._si.wdFaults.map(e => '👁 ' + e));

                return `${_si.header}${_si.name}: ${_si.statusIcons}`;
            })
        if (watchdogValues.length > 0) {
            embed.fields.push({
                "name": `👁 Service Watchdog`,
                "value": `${watchdogValues.join('\n')}`.substring(0,1024)
            })
        }
        // Twitter Flow Control Statistics
        embed.fields.push(...statusData.filter(e => e.name.startsWith('tflow_'))
            .map(statusRecord => {
                let statusItems = [];
                const _si = statusRecord.data;
                if (_si.flowVolume) {
                    if (_si.flowCountTotal <= ((_si.flowVolume.empty) ? _si.flowVolume.empty : 4)) {
                        if (_si.flowMode !== 0) {
                            systemFault = true;
                            bannerFault.unshift(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account's Flow control operator mode mismatches`)
                        }
                        statusItems.push(`**🛑 Queue Empty!**`);
                        if (_si.flowMinAlert) {
                            systemWarning = true;
                            bannerFault.push(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account Flow is empty!`)
                        }
                    }
                    else if (_si.flowCountTotal <= ((_si.flowVolume.min) ? _si.flowVolume.min : 64)) {
                        if (_si.flowMode !== 0) {
                            systemFault = true;
                            bannerFault.unshift(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account's Flow control operator mode mismatches`)
                        }
                        statusItems.push(`**🔻 Queue Underflow!**`);
                        if (_si.flowMinAlert) {
                            systemWarning = true;
                            bannerWarnings.push(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account Flow is running out of items!`)
                        }
                    }
                    else if (_si.flowCountTotal >= ((_si.flowVolume.max) ? _si.flowVolume.max : 1500)) {
                        if (_si.flowMode !== 2) {
                            systemFault = true;
                            bannerFault.unshift(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account's Flow control operator mode mismatches`)
                        }
                        statusItems.push(`**🌊 Queue Overflow!**`);
                        if (_si.flowMaxAlert) {
                            systemWarning = true;
                            bannerWarnings.push(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account Flow is overflowing!, Rectifying`)
                        }
                    }
                    else if (_si.statusIcon) {
                        if (_si.flowMode !== 1) {
                            systemFault = true;
                            bannerFault.unshift(`${_si.accountShortName} ${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account's Flow control operator mode mismatches`)
                        }
                    }
                }
                if (_si.flowCountTotal > 1) {
                    let _siT = [];
                    if (_si.flowCountSend > 0) { _siT.push(`📨 ${_si.flowCountSend}`) }
                    if (_si.flowCountLikeRt > 0) { _siT.push(`❤ ${_si.flowCountLikeRt}`) }
                    if (_si.flowCountLike > 0) { _siT.push(`💙 ${_si.flowCountLike}`) }
                    if (_si.flowCountRt > 0) { _siT.push(`🔄 ${_si.flowCountRt}`) }
                    if (_siT.length > 0) { statusItems.push(_siT.join(' / ')) }
                }

                return {
                    "name": `${_si.accountShortName}${(_si.accountName && _si.accountName.length > 1) ? ' ' + _si.accountName : ''} Account`,
                    "value": `${(statusItems.length > 0) ? statusItems.join('\n') : '❓ No Data'}`.substring(0,1024),
                    "inline": true
                };
            }))
        let embdedArray = [];
        if (discordMQ.fields.length > 0){
            embdedArray.push(discordMQ)
        }
        if (fileworkerMQ.fields.length > 0){
            embdedArray.push(fileworkerMQ)
        }
        if (systemFault || bannerFault.length > 0) {
            embed.color = 16711680
        }
        else if (systemWarning) {
            embed.color = 16771840
        }
        const activeAlarmClocks = Array.from(Timers.keys()).filter(e => e.startsWith(`alarmSnoozed-`) || e.startsWith(`alarmExpires-`)).map(e => {
            return `*${(e.startsWith(`alarmExpires-`)) ? '*⏰' : '💤'} ${Timers.get(e).text}${(e.startsWith(`alarmExpires-`)) ? '*' : ''}*`
        })
        if (activeAlarmClocks.length > 0) {
            embed.fields.unshift({
                "name": `🔔 Reminders`,
                "value": activeAlarmClocks.join('\n').substring(0,1024)
            })
        }
        if (bannerWarnings.length > 0) {
            embed.fields.unshift({
                "name": `⚠ Active Warnings`,
                "value": bannerWarnings.join('\n').substring(0,1024)
            })
        }
        if (bannerFault.length > 0) {
            embed.fields.unshift({
                "name": `⛔ Active Faults`,
                "value": bannerFault.join('\n').substring(0,1024)
            })
        }

        // Check if embed has changed
        if (data && data.message && !channelID) {
            function haveSameData(o1, o2) {
                if (!o1 || !o1.fields)
                    return false;
                if (!o2 || !o2.fields)
                    return false;
                const fo1 = clone(o1.fields.filter(e => !e.name.includes('Uptime')));
                const fo2 = clone(o2.fields.filter(e => !e.name.includes('Uptime')));

                if (fo1.length === fo2.length) {
                    //console.log(fo1.map((e,i) => `${e.value === fo2[i].value} / ${e.value} / ${fo2[i].value }`))
                    return (fo1.map((e,i) => `${e.value}` === `${fo2[i].value}`).filter(e => e !== true).length === 0) && o1.color === o2.color
                }
                return false;
            }

            const lastEmbeds = (previousStatusObjects.has(guildID)) ? previousStatusObjects.get(guildID) : false
            const finalEmbeds = [embed, ...embdedArray];
            let diffData = [];
            if (lastEmbeds) {
                diffData = finalEmbeds.map((e,i) => (haveSameData(e, lastEmbeds[i])) ).filter(e => e === false)
            }

            if (forceUpdate || !lastEmbeds || diffData.length > 0) {
                discordClient.editMessage(channel, data.message, {
                    embeds: finalEmbeds
                })
                    .then(msg => {
                        localParameters.setItem('statusgen-' + guildID, {
                            channel: msg.channel.id,
                            message: msg.id,
                        })
                        previousStatusObjects.set(guildID, msg.embeds);
                        if (Object.keys(msg.reactions).length === 0) {
                            (async () => {
                                const reactionNeeded = await db.query(`SELECT reaction_emoji, reaction_custom, reaction_name FROM discord_reactions WHERE (serverid = ? OR serverid IS NULL) AND reaction_name = 'RefreshStatus' LIMIT 1`, [msg.guildID]);
                                if (reactionNeeded.rows.length > 0) {
                                    let emoji = reactionNeeded.rows[0].reaction_emoji
                                    if (reactionNeeded.rows[0].reaction_custom !== null) {
                                        emoji = reactionNeeded.rows[0].reaction_custom
                                    }
                                    await discordClient.addMessageReaction(msg.channel.id, msg.id, emoji)
                                        .catch(err => {
                                            console.error(err);
                                        })
                                }
                            })()
                        } else if (Object.keys(msg.reactions).length !== 0 && Object.values(msg.reactions).filter(e => e.count > 1).length > 0) {
                            discordClient.removeMessageReactions(msg.channel.id, msg.id)
                                .then(() => {
                                    (async () => {
                                        const reactionNeeded = await db.query(`SELECT reaction_emoji, reaction_custom, reaction_name FROM discord_reactions WHERE (serverid = ? OR serverid IS NULL) AND reaction_name = 'RefreshStatus' LIMIT 1`, [msg.guildID]);
                                        if (reactionNeeded.rows.length > 0) {
                                            let emoji = reactionNeeded.rows[0].reaction_emoji
                                            if (reactionNeeded.rows[0].reaction_custom !== null) {
                                                emoji = reactionNeeded.rows[0].reaction_custom
                                            }
                                            await discordClient.addMessageReaction(msg.channel.id, msg.id, emoji)
                                                .catch(err => {
                                                    console.error(err);
                                                })
                                        }
                                    })()
                                })
                                .catch(err => console.error(err))
                        }
                    })
                    .catch(e => {
                        console.error(e)
                    });
            }
        } else {
            discordClient.createMessage(channel, {
                embeds: [embed, ...embdedArray]
            })
                .then(async msg => {
                    await localParameters.setItem('statusgen-' + guildID, {
                        channel: msg.channel.id,
                        message: msg.id,
                    })
                    const reactionNeeded = await db.query(`SELECT reaction_emoji, reaction_custom, reaction_name FROM discord_reactions WHERE (serverid = ? OR serverid IS NULL) AND reaction_name = 'RefreshStatus' LIMIT 1`, [msg.guildID]);
                    if (reactionNeeded.rows.length > 0) {
                        let emoji = reactionNeeded.rows[0].reaction_emoji
                        if (reactionNeeded.rows[0].reaction_custom !== null) {
                            emoji = reactionNeeded.rows[0].reaction_custom
                        }
                        await discordClient.addMessageReaction(msg.channel.id, msg.id, emoji)
                            .catch(err => {
                                console.error(err);
                            })
                    }
                })
                .catch(e => {
                    console.error(e)
                });
        }

        if (!Timers.get(`StatusReport${guildID}`)) {
            console.log('Started new status timer');
            Timers.set(`StatusReport${guildID}`, setInterval(() => {
                generateStatus(false, guildID)
            }, 300000))
        }
    }
    async function revalidateFiles() {
        activeTasks.set('VALIDATE_PARTS' ,{ started: Date.now().valueOf() });
        try {
            const parts = await db.query(`SELECT * FROM discord_multipart_files`)
            const files = await db.query(`SELECT * FROM kanmi_records WHERE fileid IS NOT NULL ORDER BY eid DESC`)

            for (let e of parts.rows.filter(e => e.valid === 0)) {
                try {
                    const partMessage = await discordClient.getMessage(e.channelid, e.messageid)
                    if (partMessage) {
                        if (partMessage.attachments.length > 0) {
                            if (!e.url === partMessage.attachments[0].url) {
                                const updatedPart = await db.query(`UPDATE discord_multipart_files SET url = ?, valid = 1 WHERE messageid = ?`, [partMessage.attachments[0].url, e.messageid])
                                if (updatedPart.error) {
                                    Logger.printLine("ValidateParts", `Failed to write attachments value for Spanned Part in database - ${e.fileid}`, "error", updatedPart.error)
                                }
                            } else {
                                Logger.printLine("ValidateParts", `Spanned Part File has the same URL, possibly damaged? - ${e.fileid} - "${partMessage.attachments[0].url}"`, "warning")
                                const updatedPart = await db.query(`UPDATE discord_multipart_files SET valid = 1 WHERE messageid = ?`, [e.messageid])
                                if (updatedPart.error) {
                                    Logger.printLine("ValidateParts", `Failed to validate part for Spanned Part in database - ${e.fileid}`, "error", updatedPart.error)
                                }
                            }
                        } else {
                            Logger.printLine("ValidateParts", `Failed to get valid attachments for Spanned Part - ${e.fileid}`, "error")
                        }
                    }
                } catch (err) {
                    if (err.message === 'Unknown Message') {
                        Logger.printLine("ValidateParts", `Spanned Part "${e.messageid}" does not exist in discord - ${e.fileid}`, "error")
                        await db.query(`DELETE FROM discord_multipart_files WHERE messageid = ?`, [e.messageid])
                    }
                }
            }
            for (let e of files.rows.filter(e => e.paritycount && e.paritycount > parts.rows.filter(f => f.fileid === e.fileid).length)) {
                for (let f of parts.rows.filter(f => f.fileid === e.fileid)) {
                    const filesize = await new Promise((resolve) => {
                        remoteSize(f.url, async (err, size) => {
                            if (!err || (size !== undefined && size > 0)) {
                                resolve(size)
                            } else {
                                console.error(err)
                                resolve(false)
                            }
                        })
                    })
                    if (!filesize) {
                        Logger.printLine("ValidateParts", `Spanned Part "${f.messageid}" does not exist in discord - ${f.fileid}`, "error")
                        await db.query(`DELETE FROM discord_multipart_files WHERE messageid = ?`, [f.messageid])
                    }
                }
            }
            //const orphanedParity = await db.query(`SELECT * FROM discord_multipart_files WHERE fileid NOT IN (SELECT fileid FROM kanmi_records WHERE fileid IS NOT NULL)`)
        } catch (e) {
            console.error(e)
        }
        activeTasks.delete('VALIDATE_PARTS');
        setTimeout(revalidateFiles, 14400000)
    }
    async function triggerAlarm(id) {
        const _snoozedAlm = (Timers.has(`alarmSnoozed-${id}`)) ? Timers.get(`alarmSnoozed-${id}`) : false;
        if (_snoozedAlm) {
            clearTimeout(_snoozedAlm.snoozeTimer);
            Timers.delete(`alarmSnoozed-${id}`);
        }
        const alarm = Timers.get(`alarmClock-${id}`);
        try {
            const alarmMessage = await discordClient.createMessage((alarm.channel) ? alarm.channel : staticChID['homeGuild'].AlrmNotif, { tts: true, content: '**⏰ ' + alarm.text + `${(alarm.mention) ? '**\n<@' + alarm.mention + '>' : '**'}` })
            Logger.printLine("AlarmClock", `Alarm Clock #${alarm.id} was triggered! Expires in ${(alarm.expires && alarm.expires >= 1) ? alarm.expires : 30} Minutes`, 'info')
            await Timers.set(`alarmExpires-${alarmMessage.id}`, {
                id: alarm.id,
                text: alarm.text,
                expirationTimer: setTimeout(async () => {
                    try {
                        await discordClient.deleteMessage(alarmMessage.channel.id, alarmMessage.id, 'Expired Alarm')
                    } catch (err) {
                        Logger.printLine("AlarmClock", `Failed to delete expired notification for alarm #${alarm.id}`, 'error', err)
                    }
                    await clearTimeout(Timers.get(`alarmExpires-${alarmMessage.id}`).expirationTimer);
                    Timers.delete(`alarmExpires-${alarmMessage.id}`)
                }, (alarm.expires && alarm.expires >= 1) ? alarm.expires * 60 * 1000 : 30 * 60 * 1000)
            })
            if (alarm.snooze !== null) {
                const snoozeBtn = await db.query(`SELECT * FROM discord_reactions WHERE (serverid = ? OR serverid IS NULL) AND reaction_name = ? OR reaction_name = ? ORDER BY position LIMIT 2`, [alarmMessage.guildID, 'AlarmSnooze', 'Check'])
                if (snoozeBtn.rows.length > 0) {
                    await Promise.all(snoozeBtn.rows.map(async e => {
                        try {
                            await discordClient.addMessageReaction(alarmMessage.channel.id, alarmMessage.id, (e.reaction_custom !== null) ? e.reaction_custom.toString() : e.reaction_emoji.toString())
                        } catch (err) {
                            Logger.printLine("AlarmClock", `Failed to add extra buttons for alarm #${alarm.id}`, 'error', err)
                        }
                    }))
                }
            }
        } catch (err) {
            Logger.printLine("AlarmClock", `Failed to send alarm notification for alarm #${alarm.id}`, 'error', err)
        }
    }
    // Discord Framework - Remote Management
    async function sendTwitterAction(body, type, action, media, chid, guildid, embed, overide) {
        let channelNsfw = false
        if (chid) {
            try {
                channelNsfw = discordClient.getChannel(chid).nsfw;
            } catch (e) {
                SendMessage("Unable to get channel NSFW status", "err", guildid,"Twitter")
                channelNsfw = false;
            }
        }
        if (type === "listManager" && !TwitterLists.has(chid) && !(embed && embed.length > 0 && TwitterListsEncoded.has(embed[0].color))) {
            SendMessage("The specified Twitter list was not found!", "err", guildid,"Twitter")
        } else {
            if (overide || TwitterCDSBypass.has(overide) || TwitterLists.has(chid) || (embed && embed.length > 0 && TwitterListsEncoded.has(embed[0].color)) || TwitterLikeList.has(chid) || (embed && embed.length > 0 && TwitterPixivLike.has(embed[0].color)) || TwitterPixivLike.has(chid) || TwitterActivityChannels.has(chid) || (discordServers.has(guildid) && chid === discordServers.get(guildid).chid_download)) {
                let originalembeds = []
                let listID = ''
                if (embed) {
                    originalembeds = embed
                }
                if (!TwitterCDSBypass.has(overide) && discordServers.has(guildid) && chid === discordServers.get(guildid).chid_download) {
                    mqClient.sendData(`${systemglobal.Twitter_In}`, {
                        fromWorker: systemglobal.SystemName,
                        botSelfID: selfstatic.id,
                        listID: chid,
                        messageText: "" + body,
                        messageIntent: type,
                        messageAction: action,
                        messageFileData: media,
                        messageChannelOveride: overide,
                        messageFileType: 'url',
                        messageEmbeds: originalembeds,
                        accountID: 1
                    }, function (ok) {
                        Logger.printLine("Discord", `Message (${type}/${action}) forwarded to Twitter`, "info")
                    })
                } else {
                    if (TwitterLikeList.has(chid)) {
                        listID = TwitterLikeList.get(chid)
                    } else if (TwitterCDSBypass.has(overide)) {
                        listID = overide
                    } else if (embed && embed.length > 0 && TwitterListsEncoded.has(embed[0].color)) {
                        listID = TwitterListsEncoded.get(embed[0].color);
                    } else {
                        listID = TwitterLists.get(chid)
                    }
                    console.log(listID)
                    let _destination = 1
                    if (embed && embed.length > 0 && embed[0].footer && embed[0].footer.text && embed[0].footer.text.includes('🆔:')) {
                        _destination = embed[0].footer.text.split('🆔:').join('')
                    } else if (TwitterRedirects.has(listID) && type !== "listManager") {
                        _destination = TwitterRedirects.get(listID)
                    } else if (TwitterPixivLike.has(chid)) {
                        _destination = TwitterPixivLike.get(chid)
                    } else if (embed && embed.length > 0 && TwitterPixivLike.has(embed[0].color)) {
                        _destination = TwitterPixivLike.get(embed[0].color)
                    } else if (TwitterListAccounts.has(listID)) {
                        _destination = TwitterListAccounts.get(listID)
                    } else if (TwitterActivityChannels.has(chid)) {
                        _destination = TwitterActivityChannels.get(chid)
                    }
                    mqClient.sendData(systemglobal.Twitter_In, {
                        fromWorker: systemglobal.SystemName,
                        botSelfID: selfstatic.id,
                        listID: listID,
                        messageText: "" + body,
                        messageIntent: type,
                        messageAction: action,
                        messageFileData: media,
                        messageChannelOveride: overide,
                        messageFileType: 'url',
                        messageEmbeds: originalembeds,
                        accountID: parseInt(_destination.toString())
                    }, function (ok) {
                        Logger.printLine("Twitter", `Message (${type}/${action}) forwarded to Twitter / ${_destination}`, "info", 'main')
                    })
                }
            } else if (channelNsfw === false || channelNsfw === undefined) {
                const twitter_sendoverides = await db.query(`SELECT taccount FROM twitter_sendoverides WHERE channelid = ?`, [chid])
                if (twitter_sendoverides.error) {
                    SendMessage("SQL Error occurred when retrieving twitter account records", "err", guildid, "Twitter", twitter_sendoverides.error)
                }

                if (type === 'SendTweet') {
                    const messageBody = body
                    let _destination = 1
                    if (TwitterActivityChannels.has(chid)) {
                        _destination = TwitterActivityChannels.get(chid)
                    } else if (twitter_sendoverides.rows > 0) {
                        _destination = twitter_sendoverides.rows[0].taccount
                    }
                    mqClient.sendData(systemglobal.Twitter_In, {
                        fromWorker: systemglobal.SystemName,
                        botSelfID: selfstatic.id,
                        listID: (embed.length > 0 && TwitterListsEncoded.has(embed[0].color)) ? TwitterListsEncoded.get(embed[0].color) : TwitterLists.get(chid),
                        messageText: "" + messageBody,
                        messageIntent: type,
                        messageAction: action,
                        messageFileData: media,
                        messageChannelOveride: overide,
                        messageFileType: 'url',
                        messageEmbeds: [],
                        accountID: parseInt(_destination.toString())
                    }, function (ok) {
                        Logger.printLine("Discord", `Message (${type}/${action}) forwarded to Twitter`, "info")
                    })
                } else {
                    SendMessage("Not a Tweeter Action", "warn", guildid, "Twitter");
                }
            } else if (channelNsfw === true) {
                SendMessage("Can not perform twitter actions on a NSFW channel!", "warn", guildid, "Twitter")
            }
        }
    }
    async function sendPixivAction(body, type, action, _chid, createThread, allowDuplicates) {
        let chid = _chid;
        let PostID, PostArtist, PostName
        if (action === "get") {
            PostID = body
        } else if (type === "Follow") {
            PostID = body
        } else if (typeof body === 'string') {
            PostID = body.split(' - ').pop().split(':')[0]
        } else if (body.hasOwnProperty('url')) {
            PostID = body.url.split('/').pop();
            PostName = (body.title) ? body.title : undefined
            PostArtist = (body.author) ? body.author.name.split(") - ")[0] : undefined
        } else {
            PostID = body
        }
        try {
            if (systemglobal.CMS_Timeline_Parent && createThread && !systemglobal.CMS_Disable_Threads) {
                const newMessage = await discordClient.createMessage((chid) ? chid : systemglobal.CMS_Timeline_Parent, (type === 'DownloadUser' || type === 'DownloadPost') ? `Downloading ${PostID} illustrations` : `Downloading related posts to ${PostID}`)
                if (newMessage) {
                    const newThread = await discordClient.createThreadWithMessage(newMessage.channel.id, newMessage.id, {
                        name: (type === 'DownloadUser' || type === 'DownloadPost') ? `🎇 ${PostID} Illustrations` : `🎆 Related to ${PostID}`,
                        autoArchiveDuration: 1440,
                        type: eris.PublicThreadChannel
                    })
                    if (newThread && newThread.id) {
                        tempThread.set(newThread.id, newThread)
                        chid = newThread.id
                        Logger.printLine("PixivAction", `Generated new thread for ${PostID}'s images`, "info")
                        SendMessage(`View results for request here <#${newThread.id}>`, staticChID['homeGuild'].AlrmNotif, "main", "PixivRequest")
                        try {
                            const pinnedMessage = await discordClient.createMessage(newThread.id, 'Top of Thread')
                            await discordClient.pinMessage(pinnedMessage.channel.id, pinnedMessage.id)
                        } catch (err) {
                            Logger.printLine("PixivAction", `Failed to create top of thread pin`, "error", err)
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
            Logger.printLine("PixivAction", `Failed to create new thread for this request! Falling back to request`, "error", err)
        }
        mqClient.sendData(systemglobal.Pixiv_In, {
            fromWorker: systemglobal.SystemName,
            postID: PostID,
            messageChannelID: chid,
            messageText: PostName,
            messageArtist: PostArtist,
            messageIntent: type,
            messageAction: action,
            allowDuplicates: allowDuplicates,
        }, function (ok) {
        })
    }
    async function downloadMessageFile(fullmsg, destination, deleteItem) {
        await activeTasks.set(`SAVE_${fullmsg.id}`, { started: Date.now().valueOf() });
        let sendTo = fullmsg.channel.id
        if (destination) {
            sendTo = destination
        }

        if (fullmsg.embeds.length > 0 && ((fullmsg.embeds[0].title && fullmsg.embeds[0].title.includes('🎆 ')) || (discordServers.get(fullmsg.guildID).chid_download === fullmsg.channel.id && fullmsg.content.includes("pixiv.")))) {
            let messageText = ''
            let messageEdited = fullmsg
            if (fullmsg.embeds[0] && fullmsg.embeds[0].description !== undefined) {
                messageText += `**${fullmsg.embeds[0].description}**\n`
            }
            messageEdited.content = `${messageText}**🎆 ${fullmsg.embeds[0].author.name}** : ***${fullmsg.embeds[0].title.replace('🎆 ', '')}${(fullmsg.embeds[0].description) ? '\n' + fullmsg.embeds[0].description : ''}***`
            let image = (fullmsg.embeds[0].image) ? fullmsg.embeds[0].image : (fullmsg.attachments[0]) ? fullmsg.attachments[0] : undefined;
            image.filename = getIDfromText(image.url)
            messageEdited.attachments = [ image ];

            if (fullmsg.embeds[0].timestamp)
                messageEdited.full_timestamp = fullmsg.embeds[0].timestamp

            jfsMove(messageEdited, destination, function (cb) { activeTasks.delete(`SAVE_${fullmsg.id}`); }, true);
        }
        else if (fullmsg.content.includes("pixiv.") && fullmsg.attachments.length > 0) {
            jfsMove(fullmsg, destination, function (cb) { activeTasks.delete(`SAVE_${fullmsg.id}`); }, true)
        }
        else if ((fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && (fullmsg.embeds[0].title.includes('📨 Tweet') || fullmsg.embeds[0].title.includes('✳ Retweet')) && sendTo !== discordServers.get(fullmsg.guildID).chid_download)) {
            let messageEdited = fullmsg;
            let channelID = destination;
            let image = (fullmsg.embeds[0].image) ? fullmsg.embeds[0].image : (fullmsg.attachments[0]) ? fullmsg.attachments[0] : undefined;
            const listID = (TwitterListsEncoded.has(fullmsg.embeds[0].color)) ? TwitterListsEncoded.get(fullmsg.embeds[0].color) : TwitterLists.get(sendTo);
            const TweetID = fullmsg.embeds[0].url.split('/').pop();
            const name = fullmsg.embeds[0].author.name.split(" (@")[0];
            const username = fullmsg.embeds[0].author.name.split(" (@").pop().slice(0, -1).toLowerCase();
            let messageText = ''
            if (fullmsg.embeds[0] && fullmsg.embeds[0].description !== undefined) {
                messageText += `\n**${fullmsg.embeds[0].description}**`
            }
            if (fullmsg.embeds[0].timestamp)
                messageEdited.full_timestamp = fullmsg.embeds[0].timestamp

            image.filename = username + "-" + getIDfromText(image.url).replace(":large", "");
            messageEdited.attachments = [ image ];
            messageEdited.content = `**🌁 Twitter Image** - ***${name} (@${username})***${messageText}`;

            db.safe(`SELECT * FROM twitter_list WHERE listid = ?`, [listID], function (err, listinfo) {
                if (err) {
                    Logger.printLine("SQL", `SQL Error when getting Twitter Lists records`, "emergency", err)
                    activeTasks.delete(`SAVE_${fullmsg.id}`);
                } else {
                    db.safe(`SELECT channelid FROM twitter_user_redirect WHERE twitter_username = ?`, [username], function (err, channelreplacement) {
                        if (err) {
                            Logger.printLine("SQL", `SQL Error when getting to the Twitter Redirect records`, "emergency", err)
                        } else if (!destination && channelreplacement.length > 0) {
                            channelID = channelreplacement[0].channelid
                        } else if (!destination && listinfo.length > 0) {
                            channelID = listinfo[0].saveid
                        }

                        if (TwitterLikeList.has(sendTo) && TwitterAutoLike.has(TwitterLikeList.get(sendTo)) || TwitterAutoLike.has(listID)) {
                            sendTwitterAction(fullmsg.content, "LikeRT", "add", fullmsg.attachments, sendTo, fullmsg.guildID, fullmsg.embeds);
                        }
                        if (image) {
                            jfsMove(messageEdited, channelID, function (cb) { }, true);
                            activeTasks.delete(`SAVE_${fullmsg.id}`);
                        } else if (fullmsg.embeds.length > 0 && fullmsg.embeds[0].video) {
                            const ID = getIDfromText(fullmsg.embeds[0].url);
                            const FileName = `${username}-${ID}.mp4`;
                            mqClient.sendData(systemglobal.FileWorker_In, {
                                messageChannelID: channelID,
                                messageReturn: false,
                                messageText: `**🎞 Twitter Video** - ***${name} (@${username})***${messageText}`,
                                itemFileName: FileName,
                                itemVideoURL: fullmsg.embeds[0].video.url
                            }, function (ok) {
                                if (ok) {
                                    activeTasks.delete(`SAVE_${fullmsg.id}`);
                                    Logger.printLine("TwitterDownload", `Tweet ${TweetID} will be downloaded to ${channelID}, Sent to file worker proxy downloader`, "info", fullmsg.embeds[0], {
                                        messageChannelID: channelID,
                                        messageReturn: false,
                                        messageText: `**🎞 Twitter Video** - ***${name} (@${username})***${messageText}`,
                                        itemFileName: FileName,
                                        itemVideoURL: fullmsg.embeds[0].video.url
                                    })
                                }
                            })
                        } else {
                            sendTwitterAction(fullmsg.content, 'Download', "add", fullmsg.attachments, fullmsg.channel.id, fullmsg.guildID, fullmsg.embeds, destination);
                            activeTasks.delete(`SAVE_${fullmsg.id}`);
                            if (deleteItem) {
                                setTimeout(function () {
                                    discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id, "Clean out download request")
                                        .catch(function (err) {
                                            Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                                        })
                                }, 2500)
                            }
                        }
                    })
                }
            })
        }
        else if (fullmsg.content.includes("twitter.com") || (fullmsg.embeds.length > 0 && fullmsg.embeds[0].url && fullmsg.embeds[0].url.includes("twitter.com"))) {
            if (TwitterLikeList.get(sendTo) && TwitterAutoLike.has(TwitterLikeList.get(sendTo)) || TwitterAutoLike.has(sendTo)) {
                sendTwitterAction(fullmsg.content, "LikeRT", "add", fullmsg.attachments, sendTo, fullmsg.guildID, fullmsg.embeds);
            }
            sendTwitterAction(fullmsg.content, 'Download', "add", fullmsg.attachments, fullmsg.channel.id, fullmsg.guildID, fullmsg.embeds, destination);
            activeTasks.delete(`SAVE_${fullmsg.id}`);
            if (deleteItem) {
                setTimeout(function () {
                    discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id, "Clean out download request")
                        .catch(function (err) {
                            Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                        })
                }, 2500)
            }
        }
        else if ((fullmsg.embeds[0] !== undefined && fullmsg.embeds[0].type === 'video') || fullmsg.content.includes("youtube.com") || fullmsg.content.includes("youtu.be")) {
            let content = {}
            if (fullmsg.embeds[0] !== undefined && fullmsg.embeds[0].video.url) {
                content = {
                    messageChannelID: discordServers.get(fullmsg.guildID).chid_download_video.toString(),
                    messageText: `**🎞 ${fullmsg.embeds[0].provider.name} Video** - ***${fullmsg.embeds[0].title}***`,
                    itemFileName: `${fullmsg.embeds[0].author.name.replace(/[^\w\s]/gi, '').split(' ').join('_')}-${fullmsg.embeds[0].title.replace(/[^\w\s]/gi, '').split(' ').join('_')}.mp4`,
                    itemVideoURL: fullmsg.embeds[0].url
                }
            } else {
                let filename
                let sendChannelID
                const url = Array.from(getUrls(fullmsg.content, {exclude: ["https://t.co/"]}))
                const cleanedUrl = url[0]
                if (fullmsg.content === url[0]) {
                    filename = "downloaded-video"
                } else {
                    filename = fullmsg.content
                }
                if (fullmsg.channel.id === discordServers.get(fullmsg.guildID).chid_download) {
                    sendChannelID = discordServers.get(fullmsg.guildID).chid_download
                } else {
                    sendChannelID = discordServers.get(fullmsg.guildID).chid_download_video.toString()
                }
                content = {
                    messageChannelID: sendChannelID,
                    messageText: `**🎞 Downloaded Video**`,
                    itemFileName: `${getIDfromText(filename).replace(/[^\w\s]/gi, '').split(' ').join('_')}.mp4`,
                    itemVideoURL: '' + cleanedUrl
                }
            }
            mqClient.sendData(systemglobal.FileWorker_In, content, function (ok) {
                if (ok) {
                    activeTasks.delete(`SAVE_${fullmsg.id}`);
                    Logger.printLine("Download", `Video ${content.itemVideoURL} will be downloaded to ${discordServers.get(fullmsg.guildID).chid_download_video.toString()}, Sent to file worker proxy downloader`, "debug", content)
                    if (deleteItem) {
                        setTimeout(function () {
                            discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id, "Clean out download request")
                                .catch(function (err) {
                                    Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                                })
                        }, 2500)
                    }
                }
            })
        }
        else if (fullmsg.embeds[0] !== undefined && (fullmsg.embeds[0].type === 'image' || fullmsg.embeds[0].type === 'article') && (fullmsg.embeds[0].thumbnail || fullmsg.embeds[0].image)) {
            db.safe(`SELECT * FROM flickr_watchlist WHERE approval_ch = ?`, [fullmsg.channel.id], function (err, flickrchannel) {
                if (err) {
                    SendMessage("SQL Error occurred when retrieving the download data", "err", 'main', "SQL", err)
                    activeTasks.delete(`SAVE_${fullmsg.id}`);
                } else {
                    db.safe(`SELECT * FROM discord_download WHERE channelid = ?`, [fullmsg.channel.id], function (err, downloaddata) {
                        if (err) {
                            SendMessage("SQL Error occurred when retrieving the download data", "err", 'main', "SQL", err)
                            activeTasks.delete(`SAVE_${fullmsg.id}`);
                        } else {
                            if (downloaddata && downloaddata.length > 0) {
                                destination = downloaddata[0].channelto.toString()
                            } else if (flickrchannel && flickrchannel.length > 0) {
                                destination = flickrchannel[0].save_ch.toString()
                            }
                            let imageurl = undefined
                            if (fullmsg.embeds[0].thumbnail) {
                                imageurl = fullmsg.embeds[0].thumbnail.url
                            } else if (fullmsg.embeds[0].image) {
                                imageurl = fullmsg.embeds[0].image.url
                            }
                            let referal = null
                            let posttitle = `**🖼 Image**`
                            if (fullmsg.embeds[0].url) {
                                referal = fullmsg.embeds[0].url
                            }
                            if (fullmsg.embeds[0].description) {
                                posttitle += ` - ***${fullmsg.embeds[0].description}***\n`
                            } else if (fullmsg.embeds[0].title) {
                                posttitle += ` - ***${fullmsg.embeds[0].title}***\n`
                            }
                            const content = {
                                messageChannelID: destination,
                                messageText: posttitle,
                                itemReferral: referal,
                                itemFileName: imageurl.split('/').pop(),
                                itemFileURL: imageurl
                            }
                            mqClient.sendData(systemglobal.FileWorker_In, content, function (ok) {
                                if (ok) {
                                    activeTasks.delete(`SAVE_${fullmsg.id}`);
                                    Logger.printLine("Download", `Image ${content.itemFileURL} will be downloaded to ${discordServers.get(fullmsg.guildID).chid_download_video.toString()}, Sent to file worker proxy downloader`, "debug", content)
                                    if (deleteItem) {
                                        setTimeout(function () {
                                            discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id, "Clean out download request")
                                                .catch(function (err) {
                                                    Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                                                })
                                        }, 2500)
                                    }
                                }
                            })
                        }
                    })
                }
            })
        }
        else {
            activeTasks.delete(`SAVE_${fullmsg.id}`);
            Logger.printLine("Download", `Can't download ${fullmsg.id}`, "debug")
        }
    }
    async function downloadRemoteFile(msg, serverdata) {
        await activeTasks.set(`RSAVE_${msg.id}`, { started: Date.now().valueOf() });
        const isRecommended = (msg.content.includes("RECOM"))
        const contents = msg.content.replace('REQUEST ', '').split("  _DEST_  ")[0].replace('RECOM','').trim().replace('FORCE','').trim()
        const forceAllItems = (msg.content.includes('FORCE'))
        const url = Array.from(getUrls(contents, {exclude: ["https://t.co/"]}))
        let moveTo = serverdata.chid_download
        if (msg.content.split(" _DEST_ ").length > 1) {
            moveTo = msg.content.replace('REQUEST ', '').split(" _DEST_ ")[1].replace('RECOM','').trim();
        }
        if (msg.embeds[0] !== undefined && msg.embeds[0].type === 'image' && (msg.embeds[0].thumbnail || msg.embeds[0].image) && !(msg.content.includes("pixiv.net/") || msg.content.includes("youtube.com") || msg.content.includes("youtu.be") || msg.content.includes("twitter.com"))) {
            downloadMessageFile(msg, moveTo, true)
            activeTasks.delete(`RSAVE_${msg.id}`);
        } else if (url.length > 0) {
            await Promise.all(url.map(async (urlItem) => {
                if (urlItem.includes("twitter.com") && !urlItem.includes("/status/")) {
                    (async () => {
                        let chid = undefined
                        const username = urlItem.split('/').pop().trim()
                        try {
                            if (systemglobal.CMS_Timeline_Parent && !systemglobal.CMS_Disable_Threads) {
                                const newMessage = await discordClient.createMessage(systemglobal.CMS_Timeline_Parent, `Downloading ${username} illustrations`)
                                if (newMessage) {
                                    const newThread = await discordClient.createThreadWithMessage(newMessage.channel.id, newMessage.id, {
                                        name: `📧 ${username} Tweets`,
                                        autoArchiveDuration: 1440,
                                        type: eris.PublicThreadChannel
                                    })
                                    if (newThread && newThread.id) {
                                        tempThread.set(newThread.id, newThread)
                                        chid = newThread.id
                                        Logger.printLine("DownloadTweets", `Generated new thread for ${username}'s tweets`, "info")
                                        SendMessage(`View results for request here <#${newThread.id}>`, staticChID['homeGuild'].AlrmNotif, "main", "DownloadTweets")
                                        try {
                                            const pinnedMessage = await discordClient.createMessage(newThread.id, 'Top of Thread')
                                            await discordClient.pinMessage(pinnedMessage.channel.id, pinnedMessage.id)
                                        } catch (err) {
                                            Logger.printLine("DownloadTweets", `Failed to create top of thread pin`, "error", err)
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.error(err)
                            Logger.printLine("DownloadTweets", `Failed to create new thread for this request! Falling back to request`, "error", err)
                        }
                        mqClient.sendData(systemglobal.Twitter_In, {
                            fromWorker: systemglobal.SystemName,
                            botSelfID: selfstatic.id,
                            messageText: "",
                            messageIntent: 'DownloadUser',
                            messageAction: 'add',
                            messageChannelID: chid,
                            allowDuplicates: forceAllItems,
                            userID: username,
                            accountID: 1
                        }, async(ok) => {
                            Logger.printLine("Discord", `Request to download user forwarded to Twitter`, "info")
                            try {
                                await discordClient.deleteMessage(msg.channel.id, msg.id, "Download Requested")
                            } catch (err) {

                            }
                        })
                    })()
                } else if (urlItem.includes("pixiv.net/")) {
                    const postID = parseInt(urlItem.split("/").pop()).toString()
                    if (postID !== 'NaN') {
                        if (urlItem.includes("/artworks/")) { // Illustration
                            sendPixivAction(postID, `Download${(isRecommended) ? 'Recommended' : 'Post'}`, "get", moveTo, (moveTo === serverdata.chid_download && isRecommended), forceAllItems)
                            setTimeout(function () {
                                discordClient.deleteMessage(msg.channel.id, msg.id, "Clean out download request")
                                    .catch(function (err) {
                                        Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                                    })
                            }, 2500)
                        } else if (urlItem.includes("/users/")) { // User
                            sendPixivAction(postID, "DownloadUser", "get", moveTo, (moveTo === serverdata.chid_download), forceAllItems)
                            setTimeout(function () {
                                discordClient.deleteMessage(msg.channel.id, msg.id, "Clean out download request")
                                    .catch(function (err) {
                                        Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                                    })
                            }, 2500)
                        } else {
                            Logger.printLine("DownloadMgr", `Unknown Pixiv URL or function not implemented for this type`, 'warn')
                        }
                    } else {
                        SendMessage("No known ID was passed to the download channel", "warn", msg.guildID, "DownloadMgr")
                    }
                } else if (urlItem.includes("youtube.com") || urlItem.includes("youtu.be") || urlItem.includes("twitter.com")) {
                    downloadMessageFile(msg, moveTo,true)
                } else if (msg.embeds[0] !== undefined && msg.embeds[0].type === 'image' && (msg.embeds[0].thumbnail || msg.embeds[0].image)) {
                    downloadMessageFile(msg, moveTo, true)
                } else {
                    mqClient.sendData(systemglobal.FileWorker_In, {
                        messageChannelID: moveTo,
                        messageText: '**🌐 Download** - `' + urlItem + '`',
                        itemFileName: urlItem.split("/").pop(),
                        itemFileURL: urlItem,
                        itemReferral: `https://${urlItem.split("/")[2]}/`
                    }, function (ok) {
                        if (ok) {
                            setTimeout(function () {
                                discordClient.deleteMessage(msg.channel.id, msg.id, "Clean out download request")
                                    .catch(function (err) {
                                        Logger.printLine("DownloadMgr", `Failed to remove download request`, 'error', err)
                                    })
                            }, 2500)
                        }
                    })
                }
            }));
            activeTasks.delete(`RSAVE_${msg.id}`);
        } else {
            activeTasks.delete(`RSAVE_${msg.id}`);
        }
    }
    // Discord Framework - Data Management
    async function addStandardReactions(msg) {
        let reactions = []
        // Add Generic Reaction Buttons to a post
        if (systemglobal.Discord_FSMgr_Enable === true) {
            reactions.push("Pin")
        }
        if (msg.content.includes("youtube.com") || msg.content.includes("youtu.be")) { // Youtube Video Link, Add Download Buttons
            if (!TwitterLists.has(msg.channel.id) && !(msg.embeds.length > 0 && TwitterListsEncoded.has(msg.embeds[0].color))) {
                reactions.push("Download")
            }
        }
        if (systemglobal.Discord_FSMgr_Enable === true) {
            reactions.push("Archive", "MoveMessage") // Add Archive
        }
        await addEmojisToMessage(msg, reactions);
    }
    function addFavorite(chid, msgid, guildid) {
        // Readd database fav, need to do stuff for this
        discordClient.pinMessage(chid, msgid)
            .then(function () {
                Logger.printLine("Discord", `Pinned Message ${msgid}`, "info")
            })
            .catch((er) => {
                if (er.message && !(er.message.includes("Maximum number of pins"))) {
                    SendMessage("Failed to Pin the message to a channel", "warn", guildid, "Discord", er)
                } else {
                    Logger.printLine("Discord", `Pinned Message (via Database) ${msgid}`, "info")
                }
            });
    }
    function removeFavorite(chid, msgid, guildid) {
        discordClient.unpinMessage(chid, msgid)
            .then(function(){
                Logger.printLine("Discord", `Unpinned Message ${msgid}`, "info")
            })
            .catch((er) => {
                SendMessage("Failed to Unpin the message to a channel", "warn", guildid, "Discord", er)
            });
    }
    async function cacheColor(msgid, url) {
        await activeTasks.set(`CACHE_COLOR_${msgid}`, {started: Date.now().valueOf()});
        return new Promise(resolve => {
            const imageFilesFormats = ['jpg', 'jfif', 'png', 'webm', 'gif']
            if (url.split('.').length > 1 && imageFilesFormats.indexOf(url.split('.').pop().toLowerCase()) !== -1) {
                request.get({
                    url: url,
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
                    if (err) {
                        SendMessage(`Failed to download message attachments from discord for color cache - ${err.message}`, "err", 'main', "Polyfill", err)
                        resolve(false);
                        activeTasks.delete(`CACHE_COLOR_${msgid}`);
                    } else if (!body || (body && body.length < 100)) {
                        SendMessage(`Failed to download message attachments from discord for color cache - No Data`, "err", 'main', "Polyfill")
                        resolve(false);
                        activeTasks.delete(`CACHE_COLOR_${msgid}`);
                    } else {
                        try {
                            const _color = await getAverageColor(body, {mode: 'precision'})
                            const result = await db.query(`UPDATE kanmi_records SET colorR = ?, colorG = ?, colorB = ?, dark_color = ? WHERE id = ?`, [_color.value[0], _color.value[1], _color.value[2], (_color.isDark) ? '1' : '0', msgid])
                            if (result.error)
                                Logger.printLine('SQL', `Failed to save color for ${msgid}`, 'error', result.error);
                            resolve(true)
                            activeTasks.delete(`CACHE_COLOR_${msgid}`);
                        } catch (err) {
                            resolve(true)
                            Logger.printLine('cacheColor', `Failed to save color for ${msgid} - ${url}`, 'error');
                            activeTasks.delete(`CACHE_COLOR_${msgid}`);
                        }
                    }
                })
            } else {
                resolve(true)
                activeTasks.delete(`CACHE_COLOR_${msgid}`);
            }
        })
    }
    // Discord Framework - File Systems Tasks
    async function jfsMove(message, moveTo, cb, delay) {
        await activeTasks.set(`JFSMOVE_${message.id}`, { started: Date.now().valueOf() });
        if (message.attachments.length === 0 || (message.attachments.length > 0 && message.attachments.filter(e => e.size > 7900000).length === 0)) {
            let emotesToAdd = []
            Object.keys(message.reactions).forEach(function (key) {
                emotesToAdd.push(key)
            });
            let messagecontent = ""
            if (moveTo && (moveTo.toString() === discordServers.get(message.guildID).chid_archive.toString() || moveTo.toString() === discordServers.get(message.guildID).chid_archive_nsfw.toString())) {
                messagecontent = `🗄 Archived from <#${message.channel.id}> (` +
                    `${new Date(message.timestamp).toLocaleDateString("en-US")}` + " " +
                    `${new Date(message.timestamp).toLocaleTimeString("en-US")})\n` + message.content
            } else {
                messagecontent = "" + message.content
            }
            if (message.attachments && message.attachments.length > 0) {
                Logger.printLine("Move", `Need to download ${message.attachments[0].url}`, "debug", message.attachments[0])
                request.get({
                    url: message.attachments[0].url,
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
                    if (err) {
                        SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Move", err)
                        activeTasks.delete(`JFSMOVE_${message.id}`)
                        cb(false);
                    } else if (!body || (body && body.length < 100)) {
                        SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Move")
                        activeTasks.delete(`JFSMOVE_${message.id}`)
                        cb(false);
                    } else {
                        const colorSearchFormats = ['png', 'jpg', 'jfif', 'jpeg', 'gif']
                        let _color = undefined

                        let messagefiles = [
                            {
                                file: Buffer.from(body),
                                name: message.attachments[0].filename
                            }
                        ];
                        if (colorSearchFormats.indexOf(message.attachments[0].filename.split('.').pop().toLowerCase()) !== -1) {
                            try {
                                _color = await getAverageColor(body, {mode: 'precision'})
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        if (message.attachments.length > 1 && message.attachments.filter(e => e.filename.includes('-t9-preview-video')).length > 0) {
                            const previewAttachment = message.attachments.filter(e => e.filename.includes('-t9-preview-video')).pop()
                            Logger.printLine("Move", `Need to download preview ${previewAttachment.url}`, "debug", previewAttachment)
                            const previewItem = await new Promise(resolve => {
                                request.get({
                                    url: previewAttachment.url,
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
                                }, function (err, res, previewbody) {
                                    if (err) {
                                        resolve(false)
                                        console.error(err)
                                    } else {
                                        resolve(previewbody)
                                    }
                                })
                            })
                            if (previewItem) {
                                messagefiles.push({
                                    file: Buffer.from(previewItem),
                                    name: previewAttachment.filename
                                })
                            }
                        }

                        try {
                            const data = await discordClient.createMessage(moveTo, {content: `${messagecontent}`}, messagefiles)
                            await messageUpdate(data, {
                                channel: message.channel.id,
                                id: message.id,
                                action: 'jfsMove',
                                timestamp: (message.full_timestamp) ? message.full_timestamp : undefined,
                                delay: (delay),
                                color: _color,
                            })
                            if (data.content && data.content.includes('🏷 Name:')) {
                                jfsMigrateFileParts(data);
                            }
                            if (delay) {
                                discordClient.editMessage(message.channel.id, message.id, `<:Download:830552108377964615> **Downloaded Successfully!**`)
                                    .catch((er) => {

                                    })
                            }
                            try {
                                if (message.embeds.length > 0 && message.embeds[0].title && message.embeds[0].title.includes('🎆 ')) {
                                    const foundMessage = await db.query(`SELECT * FROM pixiv_tweets WHERE id = ?`, [message.id])
                                    if (foundMessage.error) {
                                        SendMessage("SQL Error occurred when retrieving the previouly sent tweets for pixiv", "err", 'main', "SQL", foundMessage.error)
                                    } else if (foundMessage.rows.length === 0 && ((pixivaccount[0].like_taccount_nsfw !== null && message.channel.nsfw) || pixivaccount[0].like_taccount !== null)) {
                                        await db.query(`INSERT INTO pixiv_tweets SET id = ?`, [message.id])
                                        sendTwitterAction(`Artist: ${message.embeds[0].author.name}\nSource: ${message.embeds[0].url}`, 'SendTweet', "send", [(data.attachments[0]) ? data.attachments[0] : message.attachments[0]], moveTo, message.guildID, []);
                                    }
                                    sendPixivAction(message.embeds[0], 'Like', "add");
                                }
                            } catch (err) {
                                console.error(err);
                            }
                            activeTasks.delete(`JFSMOVE_${message.id}`)
                            cb(true)
                        } catch (er) {
                            SendMessage("Failed to send message to discord", "err", message.guildID, "Move", er)
                            activeTasks.delete(`JFSMOVE_${message.id}`)
                            if (er.message.includes("empty message") || er.message.includes("to large")) {
                                cb(true)
                            } else {
                                cb(false)
                            }
                        }
                    }
                })
            } else {
                discordClient.createMessage(moveTo, {content: message.content})
                    .then(async (data) => {
                        // Send Response
                        await addEmojisToMessage(data, emotesToAdd);
                        await messageUpdate(data, {
                            channel: message.channel.id,
                            id: message.id,
                            action: 'jfsMove',
                            timestamp: (message.full_timestamp) ? message.full_timestamp : undefined,
                            delay: (delay)
                        })
                        if (data.content && data.content.includes('🏷 Name:')) {
                            await jfsMigrateFileParts(data);
                        }
                        activeTasks.delete(`JFSMOVE_${message.id}`)
                        cb(true);
                    })
                    .catch((er) => {
                        SendMessage("Failed to send message to discord", "err", message.guildID, "Move", er)
                        activeTasks.delete(`JFSMOVE_${message.id}`)
                        if (er.message.includes("empty message") || er.message.includes("to large")) {
                            cb(true)
                        } else {
                            cb(false)
                        }
                    });
            }
        } else {
            message.attachments.filter(e => !e.filename.includes('-t9-preview')).forEach(e => {
                mqClient.sendData(systemglobal.FileWorker_In, {
                    fromClient: MQWorker1,
                    messageReturn: false,
                    messageRefrance: {
                        id: message.id,
                        channel: message.channel.id,
                        action: 'jfsMove',
                        no_update_dimentions: true
                    },
                    messageChannelID: moveTo,
                    messageText: message.content,
                    itemFileName: e.filename,
                    itemFileURL: e.url,
                    itemReferral: `https://discord.app/`
                }, function (ok) {
                    if (ok) {
                        SendMessage(`Sent move request to #${moveTo} via the FileWorker`, "warn", 'main', "Move")
                    }
                })
            })
            activeTasks.delete(`JFSMOVE_${message.id}`)
            cb(true);
        }
    }
    async function jfsMigrateFileParts(data) {
        await activeTasks.set(`JFSPARITY_SYNC_${data.id}`, { started: Date.now().valueOf() })
        const input = data.content.split("**\n*")[0].replace("**🧩 File : ", '').replace(/\n|\r/g, '').trim();
        const fileParts = await db.query(`SELECT * FROM discord_multipart_files WHERE fileid = ? AND serverid != ?`, [input, data.guildID])
        const newServerData = await db.query(`SELECT * FROM discord_servers WHERE serverid = ?`, [data.guildID])
        if (fileParts.error) {
            Logger.printLine('MoveMessage-Parts', `Unable to get file parts for ${input}`, 'error', fileParts.error);
        }
        if (newServerData.error) {
            Logger.printLine('MoveMessage-Parts', `Unable to get server data for moving file parts`, 'error', newServerData.error);
        }
        if (fileParts.rows.length > 0 && newServerData.rows.length > 0) {
            // noinspection ES6MissingAwait
            await Promise.all(fileParts.rows.map(async filepart => {
                try {
                    const orgPartMsg = await discordClient.getMessage(filepart.channelid, filepart.messageid)
                    await new Promise(resolve => {
                        request.get({
                            url: orgPartMsg.attachments[0].url,
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
                        }, async function (err, res, partbody) {
                            if (err) {
                                SendMessage("Failed to download file part attachments from discord", "err", data.guildID, "Move", err)
                                resolve(false);
                            } else if (!partbody || (partbody && partbody.length < 100)) {
                                SendMessage("Failed to download file part attachments from discord", "err", data.guildID, "Move")
                                resolve(false);
                            } else {
                                await discordClient.createMessage(newServerData.rows[0].chid_filedata, orgPartMsg.content, {
                                    file: Buffer.from(partbody),
                                    name: orgPartMsg.attachments[0].filename
                                })
                                    .then(async newPartMsg => {
                                        const movedMessage = await db.query(`REPLACE INTO discord_multipart_files SET ?`, [{
                                            channelid: newPartMsg.channel.id,
                                            messageid: newPartMsg.id,
                                            serverid: data.guildID,
                                            fileid: input,
                                            url: newPartMsg.attachments[0].url,
                                            hash: md5(partbody),
                                        }])
                                        if (movedMessage.error) {
                                            Logger.printLine('MoveMessage-Parts', `Failed to update File Part ${orgPartMsg.id}@${orgPartMsg.channel.id} to ${newPartMsg.id}@${newPartMsg.channel.id}`, 'error', movedMessage.error)
                                            resolve(false);
                                        } else {
                                            resolve(true);
                                            await discordClient.deleteMessage(filepart.channelid, filepart.messageid);
                                            Logger.printLine('MoveMessage-Parts', `Moved File Part ${orgPartMsg.id}@${orgPartMsg.channel.id} to ${newPartMsg.id}@${newPartMsg.channel.id}`, 'debug')
                                        }
                                    })
                                    .catch(err => {
                                        SendMessage("Failed to move message part to new discord server", "err", data.guildID, "Move", err)
                                        resolve(false);
                                    })
                            }
                        })
                    })
                } catch (err) {
                    SendMessage("Failed to get message part to move to the new discord server", "err", data.guildID, "Move", err)
                    if (err.message && err.message.toLowerCase().includes('unknown message')) {
                        await db.query(`DELETE FROM discord_multipart_files WHERE channelid = ? AND messageid = ?`, [filepart.channelid, filepart.messageid])
                    }
                }
            }))
            activeTasks.delete(`JFSPARITY_SYNC_${data.id}`)
        } else {
            activeTasks.delete(`JFSPARITY_SYNC_${data.id}`)
        }
    }
    async function jfsRotate(message, rotate, cb) {
        await activeTasks.set(`ROTATE_IMG_${message.id}`, { started: Date.now().valueOf() });
        let messagecontent = "" + message.content
        const moveTo = message.channel.id;
        if (typeof message.attachments != "undefined" && message.attachments != null && message.attachments.length != null && message.attachments.length > 0) {
            Logger.printLine("Rotate", `Need to download ${message.attachments[0].url}`, "debug", message.attachments[0])
            const result = await new Promise(resolve => {
                request.get({
                    url: message.attachments[0].url,
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
                }, function (err, res, body) {
                    if (err) {
                        SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Rotate", err)
                        resolve(true);
                    } else if (!body || (body && body.length < 100)) {
                        SendMessage("Failed to download message attachments from discord", "err", message.guildID, "Rotate")
                        resolve(true);
                    } else {
                        sharp(Buffer.from(body))
                            .rotate(parseInt(rotate.toString()))
                            .toBuffer((err, buffer) => {
                                if (err) {
                                    SendMessage("Failed to rotate message with sharp", "err", message.guildID, "Rotate", err)
                                    resolve(true)
                                } else {
                                    discordClient.createMessage(moveTo, {content: `${messagecontent}`}, {
                                        file: buffer,
                                        name: message.attachments[0].filename
                                    })
                                        .then(async (data) => {
                                            Logger.printLine('RotateMessage', `Rotated Message ${data.id}@${data.channel.id} to ${rotate} deg`, 'debug')
                                            await messageUpdate(data, {
                                                channel: message.channel.id,
                                                id: message.id,
                                                action: 'jfsRotate'
                                            })
                                            resolve(true)
                                        })
                                        .catch((er) => {
                                            SendMessage("Failed to send message to discord", "err", message.guildID, "Rotate", er)
                                            if (er.message.includes("empty message") || er.message.includes("to large")) {
                                                resolve(true)
                                            } else {
                                                resolve(true)
                                            }
                                        });
                                }
                            })
                    }
                })
            })
            cb((result))
            activeTasks.delete(`ROTATE_IMG_${message.id}`)
        } else {
            SendMessage("Failed to rotate message, no attachments or not a image", "err", message.guildID, "Rotate")
            activeTasks.delete(`ROTATE_IMG_${message.id}`)
            cb(true)
        }
    }
    async function jfsRename(channelid, messageid, name, cb) {
        await activeTasks.set(`JFSRENAME_${messageid}`, { started: Date.now().valueOf() });
        const response = await db.query(`SELECT content_full, real_filename, fileid FROM kanmi_records WHERE id = ? AND source = 0`, [messageid])
        if (response.error) {
            SendMessage("SQL Error occurred when retrieving the channel classification data", "err", 'main', "SQL", response.error)
            cb(false)
        } else if (response.rows.length > 0 && response.rows[0].fileid) {
            const completeText = response.rows[0].content_full.split("🏷 Name:")[0].trim() + '🏷 Name: ' + name.trim().replace(/[/\\?%*:|"<> ]/g, '_') + ' (' + response.rows[0].content_full.split("🏷 Name:").pop().split(' (').pop()
            const updatedFile = await db.query(`UPDATE kanmi_records SET content_full = ?, real_filename = ? WHERE id = ? AND source = 0`, [completeText, name.trim().replace(/[/\\?%*:|"<> ]/g, '_'), messageid])
            if (updatedFile.error) {
                SendMessage("SQL Error occurred when saving to the message cache", "err", 'main', "SQL", updatedFile.error)
                cb(false)
            } else {
                try {
                    await discordClient.editMessage(channelid, messageid, completeText)
                } catch (err) {
                    SendMessage("❌ File could not be renamed", "system", 'main', "Rename", err.message)
                }
                cb(true)
            }
        } else {
            SendMessage("❌ File could not be renamed because it does not exist", "system", 'main', "Rename")
            cb(true)
        }
        activeTasks.delete(`JFSRENAME_${messageid}`)
    }
    function jfsArchive(fullmsg, serverdata) {
        db.safe(`SELECT archivech FROM discord_archive_overide WHERE fromch = ?`, [fullmsg.channel.id], function (err, archiveoveride) {
            if (err) {
                SendMessage("SQL Error occurred when retrieving the reaction table", "err", 'main', "SQL", err)
            } else {
                let archiveChannel = ""
                if (typeof archiveoveride != "undefined" && archiveoveride != null && archiveoveride.length != null && archiveoveride.length > 0) {
                    archiveChannel = archiveoveride[0].archivech
                } else if (fullmsg.channel.nsfw === true) {
                    archiveChannel = serverdata.chid_archive_nsfw.toString()
                } else {
                    archiveChannel = serverdata.chid_archive.toString()
                }
                jfsMove(fullmsg, archiveChannel, function (cb) {
                    if (cb != false) {
                        SendMessage(`Message archived from <#${fullmsg.channel.id}> to <#${archiveChannel}>`, "info", fullmsg.guildID, "Move")
                    } else {
                        SendMessage("There was an error archiving the message", "err", fullmsg.guildID, "Move")
                    }
                })
            }
        })
    }
    function jfsRemove(fullmsg) {
        if (fullmsg.content.includes("🧩 File : ")) {
            jfsRemoveSF(fullmsg.channel.id, fullmsg.id, fullmsg.guildID)
        } else {
            discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id)
                .catch((er) => {
                    SendMessage("There was a error removing the message", "err", fullmsg.guildID, "CleanPost", er)
                })
        }
    }
    async function jfsRemoveSF(channelnumber, messsageid, guildid, fileid) {
        await activeTasks.set(`JFSPARITY_DEL_${messsageid}`, { started: Date.now().valueOf() });
        try {
            let fileUUID = 0
            if (fileid) {
                fileUUID = fileid
            } else {
                const messagetoyeet = await discordClient.getMessage(channelnumber, messsageid)
                const input = messagetoyeet.content.split("**\n*")[0].replace("**🧩 File : ", '')
                fileUUID = input.trim().replace(/\n|\r/g, '')
            }
            const messagestodelete = await db.query(`SELECT * FROM discord_multipart_files WHERE fileid = ?`, [fileUUID])
            if (messagestodelete.error) {
                SendMessage("SQL Error occurred when retrieving the Spanned File lookup table", "err", 'main', "SQL", messagestodelete.error)
            } else {
                if (messagestodelete.rows.length > 1) {
                    await Promise.all(messagestodelete.rows.map(async messagepart => {
                        const deletedPart = await db.query(`DELETE FROM discord_multipart_files WHERE messageid = ? AND channelid = ?`, [messagepart.channelid, messagepart.messageid])
                        if (deletedPart.error) {
                            SendMessage("SQL Error occurred when retrieving the Spanned File lookup table", "err", 'main', "SQL", deletedPart.error)
                        }
                        try {
                            await discordClient.deleteMessage(messagepart.channelid, messagepart.messageid, "Cleanup Message Parts")
                        } catch (er) {
                            if (er && !er.message.includes("Unknown"))
                                SendMessage("Failed to delete the fileparts from the storage channel", "err", guildid, "SFrm", er)
                        }
                    }))
                } else {
                    SendMessage("No Spanned File was found in the database for " + fileUUID, "err", guildid, "SFrm")
                }
            }
            if (channelnumber && messsageid) {
                try {
                    await discordClient.deleteMessage(channelnumber, messsageid)
                    if (channelnumber !== discordServers.get(guildid).chid_download) {
                        SendMessage(`🗑 Deleted the Multi-Part File`, "info", guildid, "RMSF")
                    }
                } catch (er) {
                    SendMessage("There was a error getting the discord message for the Spanned File deletion process", "err", guildid, "RMSF", er)
                }
            }
            activeTasks.delete(`JFSPARITY_DEL_${messsageid}`)
        } catch (err) {
            SendMessage("There was a error getting the discord message for the Spanned File deletion process", "err", guildid, "RMSF", err)
            activeTasks.delete(`JFSPARITY_DEL_${messsageid}`)
        }
    }
    function jfsGetSF(fileUUID, options) {
        db.safe(`SELECT fileid, filecached, real_filename, paritycount FROM kanmi_records WHERE fileid = ? AND source = 0`, [fileUUID], (err, filedata) => {
            if (err) {
                SendMessage("SQL Error occurred when retrieving the server data table", "err", 'main', "SQL", err)
            } else if (filedata.length > 0) {
                if (filedata[0].filecached) {
                    Logger.printLine("SFDownload", `File ${fileUUID} is already cached!`, "info")
                } else {
                    Logger.printLine("SFDownload", `Sending request to download ${filedata[0].paritycount} parts for ${filedata[0].real_filename} to FileWorker`, "info")
                    mqClient.sendData(systemglobal.FileWorker_In, {
                        userRequest: options.userID,
                        messageType: 'command',
                        messageAction: 'CacheSpannedFile',
                        fileUUID: fileUUID,
                    }, function (ok) { })
                }
            } else {
                SendMessage("No Spanned File was found in the database, with ID " + fileUUID, "err", filedata[0].server, "SFDownload")
            }
        })
    }
    // Discord Framework - Thread Management
    function cycleThreads(type) {
        db.safe(`SELECT * FROM discord_autothread WHERE ${(type) ? 'expire <= NOW() + INTERVAL 1 HOUR AND ' : ''}(check_constantly = ? OR check_constantly IS NULL)`, [(type) ? 1 : 0], (err, threadlist) => {
            if (err) {
                SendMessage("SQL Error occurred when retrieving the auto thrads table", "err", 'main', "SQL", err)
            } else {
                threadlist.forEach(e => {
                    discordClient.createMessage(e.channelid, `Generating new Thread for ${moment().format("MM/DD/YY HH:mm")}`)
                        .then(starterMsg => {
                            discordClient.createThreadWithMessage(starterMsg.channel.id, starterMsg.id, {
                                name: e.prefix,
                                autoArchiveDuration: e.lifetime,
                                type: eris.PublicThreadChannel
                            })
                                .then(async newThread => {
                                    /*if (systemglobal.Discord_Thread_CMS_Add_Memebers && systemglobal.Discord_Thread_CMS_Add_Memebers.length > 0) {
                                        await systemglobal.Discord_Thread_CMS_Add_Memebers.forEach(async m => {
                                            await discordClient.
                                        })
                                    }*/
                                    if (e.addtc === 1) {
                                        discordClient.createMessage(newThread.id, `🕔 Inital Timecode: ${moment().format("HH:mm MMMM Do")}`)
                                            .then(sentTC => {
                                                discordClient.pinMessage(sentTC.channel.id, sentTC.id)
                                                    .catch(function (err) {
                                                        Logger.printLine("ThreadTimecode", `Failed to pin last message`, 'error', err)
                                                    })
                                                Logger.printLine("ThreadTimecode", `Added timecode to ${sentTC.channel.id}`, 'info')
                                            })
                                            .catch(function(err) {
                                                Logger.printLine("ThreadTimecode", `Failed to send timecode messages for thread ${newThread.id}`, "error", err)
                                            });
                                    }
                                    if (e.tcparent === 1) {
                                        discordClient.createMessage(e.channelid, `🕔 Timecode: ${moment().format("HH:mm MMMM Do")}`)
                                            .then(sentTC => {
                                                discordClient.pinMessage(sentTC.channel.id, sentTC.id)
                                                    .catch(function (err) {
                                                        Logger.printLine("ThreadTimecode", `Failed to pin last message`, 'error', err)
                                                    })
                                                Logger.printLine("ThreadTimecode", `Added timecode to ${sentTC.channel.id}`, 'info')
                                            })
                                            .catch(function(err) {
                                                Logger.printLine("ThreadTimecode", `Failed to send timecode messages for thread ${e.channelid}`, "error", err)
                                            });
                                    }
                                    if (e.lastthread && e.cycletime) {
                                        const lastThread = discordClient.getChannel(e.lastthread);
                                        if (lastThread) {
                                            const timestamp = moment.unix(convertIDtoUnix(lastThread.lastMessageID)/1000).format('MMMM Do');
                                            discordClient.editChannel(lastThread.id, {
                                                name: `🧊 ${lastThread.name} (${timestamp})`
                                            }, 'Expired Thread')
                                                .then(async lastThreadEdited => {
                                                    db.safe(`UPDATE discord_autothread SET lastthread = ?, expire = NOW() + INTERVAL ${e.cycletime} HOUR WHERE id = ?`, [newThread.id, e.id], (err, updatedLastThread) => {
                                                        if (err) {
                                                            Logger.printLine("ThreadManager", "Failed to update the last thread in history", "error", err);
                                                        } else {
                                                            Logger.printLine("ThreadManager", `Provisioned new Thread (${lastThread.id} => ${newThread.id})`, "info");
                                                            db.safe(`UPDATE discord_reactions_autoadd SET channelid = ? WHERE channelid = ?`, [newThread.id, lastThread.id], (err, updatedReactions) => {
                                                                if (err) {
                                                                    Logger.printLine("ThreadManager", "Failed to update the thread reactions", "error", err);
                                                                }
                                                            });
                                                        }
                                                    });

                                                    discordClient.createMessage(lastThreadEdited.id, `🧊 Thread Terminated`)
                                                        .then(sentLast => {
                                                            discordClient.pinMessage(sentLast.channel.id, sentLast.id)
                                                                .catch(function (err) {
                                                                    Logger.printLine("ThreadTimecode", `Failed to pin last message`, 'error', err)
                                                                })
                                                            db.safe(`SELECT reaction_emoji, reaction_custom FROM discord_reactions WHERE reaction_name = ? AND serverid = ?`, ['DeleteThread', sentLast.guildID], function (err, discordreact) {
                                                                if (err) {
                                                                    SendMessage("SQL Error occurred when retrieving the reaction table", "err", 'main', "SQL", err)
                                                                } else {
                                                                    if (discordreact.length > 0) {
                                                                        let emoji = discordreact[0].reaction_emoji
                                                                        if (discordreact[0].reaction_custom !== null) {
                                                                            emoji = discordreact[0].reaction_custom
                                                                        }
                                                                        discordClient.addMessageReaction(sentLast.channel.id, sentLast.id, emoji)
                                                                            .catch((er) => {
                                                                                SendMessage("Error adding emotes to post!", "warn", sentLast.guildID, "AutoAdd", er)
                                                                            });
                                                                    }
                                                                }
                                                            });
                                                        })
                                                        .catch(function(err) {
                                                            Logger.printLine("ThreadTimecode", `Failed to send final timecode messages for thread ${lastThreadEdited.id}`, "error", err)
                                                        });
                                                })
                                                .catch(err => {
                                                    Logger.printLine("ThreadManager", "Failed to update the last thread", "error", err);
                                                })
                                        } else {
                                            Logger.printLine("ThreadManager", "Failed to get data for last thread in history", "error", err);
                                        }
                                    } else if (e.cycletime) {
                                        db.safe(`UPDATE discord_autothread SET lastthread = ?, expire = NOW() + INTERVAL ${e.cycletime} HOUR WHERE id = ?`, [newThread.id, e.id], (err, updatedLastThread) => {
                                            if (err) {
                                                Logger.printLine("ThreadManager", "Failed to update the last thread in history", "error", err);
                                            } else {
                                                Logger.printLine("ThreadManager", `Provisioned new Thread (${newThread.id})`, "info");
                                            }
                                        });
                                    }
                                    if (e.update_table && e.update_field && e.update_where) {
                                        db.safe(`UPDATE ${e.update_table} SET ${e.update_field} = ? WHERE ${e.update_where}`, [newThread.id], (err, updatedCMSData) => {
                                            if (err) {
                                                Logger.printLine("ThreadManager", `Failed to update ${e.update_table}'s ${e.update_field} with new thread`, "error", err);
                                            } else {
                                                Logger.printLine("ThreadManager", `Updated threads registration for ${e.update_table} to ${newThread.id} from ${e.lastthread}`, "info");
                                            }
                                        })
                                    }
                                })
                                .catch(err => {
                                    Logger.printLine("ThreadManager", "Failed to create new automatic thread", "error", err);
                                    console.log(err)
                                })
                        })
                        .catch(err => {
                            Logger.printLine("ThreadManager", "Failed to create starter message for new thread", "error", err);
                        })
                })
            }
        })
    }
    function addTimecodeMessage(text) {
        db.safe(`SELECT * FROM discord_autothread WHERE addtc = 1 OR tcparent = 1`, [], (err, threadlist) => {
            if (err) {
                SendMessage("SQL Error occurred when retrieving the auto thrads table", "err", 'main', "SQL", err)
            } else {
                let channels = [];
                for (let e of threadlist) {
                    if (e.lastthread && e.addtc === 1) {
                        channels.push(e.lastthread);
                    }
                    if (e.tcparent === 1) {
                        channels.push(e.channelid);
                    }
                }
                for (let e of channels) {
                    discordClient.createMessage(e, `🕔 ${(text) ? text + ' ': ''}Timecode: ${moment().format("HH:mm MMMM Do")}`)
                        .then(sentTC => {
                            discordClient.pinMessage(sentTC.channel.id, sentTC.id)
                                .catch(function (err) {
                                    Logger.printLine("ThreadTimecode", `Failed to pin last message`, 'error', err)
                                })
                            Logger.printLine("ThreadTimecode", `Added timecode to ${e}`, 'info')
                        })
                        .catch(function(err) {
                            Logger.printLine("ThreadTimecode", `Failed to send timecode messages for thread ${e}`, "error", err)
                        })
                }
            }
        })
    }
    function checkThreadsExpirations() {
        if (systemglobal.Discord_Thread_Unarchive_CMS_Channels && systemglobal.Discord_Thread_Unarchive_CMS_Channels.length > 0) {
            systemglobal.Discord_Thread_Unarchive_CMS_Channels.forEach(async c => {
                const archives = await discordClient.getArchivedThreads(c, 'public', { limit: 100 } )
                archives.threads.forEach(e => {
                    threadUpdate(e);
                })
            })
        }
    }
    function threadUpdate(channel) {
        const maxDate = moment().subtract((systemglobal.Discord_Thread_Delete_After_Days) ? systemglobal.Discord_Thread_Delete_After_Days : 30, 'days').valueOf()
        if (systemglobal.Discord_Thread_Unarchive_CMS_Channels && systemglobal.Discord_Thread_Unarchive_CMS_Channels.length > 0) {
            if (systemglobal.Discord_Thread_Unarchive_CMS_Channels.indexOf(channel.parentID) !== -1 && channel.threadMetadata.archived && !channel.threadMetadata.locked) {
                const createdDate = convertIDtoUnix(channel.id);
                if (createdDate <= maxDate) {
                    discordClient.deleteChannel(channel.id, "Auto-Delete Thread")
                        .then(() => Logger.printLine(`ThreadManager`, `Deleted expired Thread : ${channel.name}`, `info`))
                        .catch(e => Logger.printLine(`ThreadManager`, `Unable to delete expired thread : ${channel.message}`, `error`, e))
                } else if (!(
                    systemglobal.Discord_Thread_Unarchive_CMS_Exclude &&
                    systemglobal.Discord_Thread_Unarchive_CMS_Exclude.length > 0 &&
                    systemglobal.Discord_Thread_Unarchive_CMS_Exclude.filter(f => (channel.name.includes(f))).length > 0 )) {
                    discordClient.editChannel(channel.id, {
                        archived: false
                    }, "Auto-Unarchived")
                        .catch(e => Logger.printLine(`ThreadManager`, `Unable to unarchive thread : ${e.message}`, `error`, e))
                }
            }
        }
    }

    // Discord Events - Message
    async function messageCreate(msg, options) {
        await activeTasks.set(`NEW_MSG_${msg.id}`, { started: Date.now().valueOf() });
        if (msg.author && msg.channel.guild) {
            const serverdata = discordservers.filter(e => e.serverid === msg.guildID).pop()
            switch (msg.type) {
                case 6 :
                    Logger.printLine("Discord", `Deleted System Message ${msg.id}`, "debug")
                    try {
                        await discordClient.deleteMessage(msg.channel.id, msg.id, "System Message")
                    } catch (er) {
                        Logger.printLine("Discord", "Unable to delete system message", "warn", er)
                    }
                    break;
                default :
                    // Save to Database IF NOT crated by self
                    if (msg.author.id !== selfstatic.id || (options && (options.forceAdd || options.isMoved))) {
                        if (discordChannels.has(msg.channel.id)) {
                            const chDbval = discordChannels.get(msg.channel.id)
                            // Notify Channel
                            let sqlObject = {
                                source: 0,
                                id: msg.id,
                                server: msg.guildID,
                                channel: msg.channel.id,
                                user: (options && options.userID) ? options.userID : msg.author.id,
                                content_full: msg.content,
                                hash: (options && options.hash) ? options.hash : undefined,
                            };
                            // Extract FileID, Name, and Size
                            if (options && options.fileData) {
                                if (options.fileData.name)
                                    sqlObject.real_filename = options.fileData.name.trim().replace(/[/\\?%*:|"<> ]/g, '_').trim();
                                if (options.fileData.uuid)
                                    sqlObject.fileid = options.fileData.uuid.trim();
                                if (options.fileData.size)
                                    sqlObject.filesize = parseFloat(options.fileData.size.toString())
                                if (options.fileData.total)
                                    sqlObject.paritycount = parseInt(options.fileData.total.toString())
                            } else if (msg.content.includes('🏷 Name:')) {
                                const input = msg.content.split("**\n*")[0].replace("**🧩 File : ", '')
                                if (msg.content.includes("MB)")) {
                                    sqlObject.filesize = msg.content.split('MB)')[0].split(' (').pop().trim()
                                }
                                const splitName = msg.content.split("🏷 Name:").pop().split('\n')[0].split(" (")
                                sqlObject.fileid = input.trim().replace(/\n|\r/g, '')
                                if (splitName.length > 2) {
                                    let real_filename = ''
                                    splitName.forEach(function (part, index) {
                                        if (index === splitName.length - 2) {
                                            real_filename += part.trim()
                                        } else if (index !== splitName.length - 1) {
                                            real_filename += part.trim() + ' ('
                                        }
                                        if (index === splitName.length - 1) {
                                            real_filename = real_filename.trim()
                                        }
                                    })
                                    sqlObject.real_filename = real_filename.trim().replace(/[/\\?%*:|"<> ]/g, '_');;
                                } else {
                                    sqlObject.real_filename = splitName[0].trim().replace(/[/\\?%*:|"<> ]/g, '_').trim();
                                }
                            }
                            // Extract Embedded Data
                            let embDate = []
                            if (sqlObject.content_full) {
                                const embedded_data_extracter = sqlObject.content_full.split('\n')
                                    .filter(e => e.startsWith('_') && e.includes(':'))
                                    .map(e => {
                                        const _emData = e.split(':')
                                        if (_emData.length > 0) {
                                            return [
                                                _emData[0].trim(),
                                                _emData.splice(1).join(':').trim()
                                            ]
                                        }
                                        return ['','']
                                    })
                                embDate = embedded_data_extracter.filter(e => e[0] === '_date')
                                sqlObject.content_full = sqlObject.content_full.split('\n').filter(e => !(e.startsWith('_') && e.includes(':'))).join('\n')
                            }
                            // Add Timestamp
                            try {
                                let timestamp = null
                                if (embDate.length !== 0) {
                                    timestamp = new Date(embDate.pop()[1])
                                } else {
                                    timestamp = (options && options.timestamp) ? options.timestamp : new Date(msg.timestamp)
                                }
                                const ts_date = moment(timestamp).format('YYYY-MM-DD HH:mm:ss')
                                if (!(ts_date.includes('Invalid')))
                                    sqlObject.date = `${ts_date}`
                            } catch (err) {
                                Logger.printLine("Discord", `Failed to set Date Time value for database row!`, "debug", err);
                            }
                            // Get Attachments Details
                            if (msg.attachments.length === 1 || msg.attachments.length > 1 && ((options && options.preview) || msg.attachments.filter(e => e.filename.toLowerCase().includes('-t9-preview')).length > 0)) {
                                const urlParts = msg.attachments[0].url.split(`https://cdn.discordapp.com/attachments/`)
                                if (urlParts.length === 2) {
                                    sqlObject.attachment_hash = (urlParts[1].startsWith(`${msg.channel.id}/`)) ? urlParts[1].split('/')[1] : urlParts[1];
                                    sqlObject.attachment_name = urlParts[1].split('/')[2]
                                } else {
                                    sqlObject.attachment_hash = msg.attachments[0].url
                                    sqlObject.attachment_name = msg.attachments[0].filename
                                }
                                if (!sqlObject.filesize) {
                                    if (msg.attachments[0].size && msg.attachments[0].size > 0) {
                                        sqlObject.filesize = (msg.attachments[0].size / 1024000).toFixed(2)
                                    } else {
                                        await new Promise((resolve, reject) => {
                                            remoteSize(msg.attachments[0].url, async (err, size) => {
                                                if (!err || (size !== undefined && size > 0)) {
                                                    sqlObject.filesize = (size / 1024000).toFixed(2);
                                                    resolve(true)
                                                } else {
                                                    resolve(false)
                                                }
                                            })
                                        })
                                    }
                                }
                                if (options && options.size) {
                                    sqlObject.sizeH = options.size[0];
                                    sqlObject.sizeW = options.size[1];
                                    sqlObject.sizeR = options.size[2];
                                } else if (msg.attachments && msg.attachments.length > 0 && msg.attachments[0].width !== undefined && msg.attachments[0].width > 0) {
                                    sqlObject.sizeH = msg.attachments[0].height;
                                    sqlObject.sizeW = msg.attachments[0].width;
                                    sqlObject.sizeR = (msg.attachments[0].height / msg.attachments[0].width);
                                }
                                if (options && options.preview) {
                                    sqlObject.cache_proxy = msg.attachments[options.preview].proxy_url.split('/attachments').pop()
                                } else if (msg.attachments.length > 1 && msg.attachments.filter(e => e.filename.toLowerCase().includes('-t9-preview-video')).length > 0) {
                                    sqlObject.cache_proxy = msg.attachments.filter(e => e.filename.toLowerCase().includes('-t9-preview-video')).pop().proxy_url.split('/attachments').pop();
                                } else if (msg.attachments.length > 0 && accepted_cache_types.indexOf(msg.attachments.pop().filename.toLowerCase().split('.')[0]) !== -1 ) {
                                    mqClient.sendData(MQWorker3, {
                                        fromClient : `return.Discord.${systemglobal.SystemName}`,
                                        messageReturn: false,
                                        messageID: msg.id,
                                        messageChannelID : msg.channel,
                                        messageServerID : msg.server,
                                        messageType: 'command',
                                        messageAction: 'CacheImage',
                                    }, function (ok) { })
                                }
                            }
                            else if (msg.attachments.length > 1) {
                                sqlObject.attachment_name = 'multi'
                                let _fileextra = []
                                for (let index in msg.attachments) {
                                    let _filesize = null
                                    await new Promise((resolve, reject) => {
                                        remoteSize(msg.attachments[0].url, async (err, size) => {
                                            if (!err || (size !== undefined && size > 0)) {
                                                _filesize = (size / 1024000).toPrecision(2)
                                                resolve(true)
                                            } else {
                                                resolve(false)
                                            }
                                        })
                                    })
                                    _fileextra.push([msg.attachments[index].filename, msg.attachments[index].url, msg.attachments[index].proxy_url, _filesize])
                                }
                                sqlObject.attachment_extra = JSON.stringify(_fileextra).toString()
                            }
                            // Add Adverage Color
                            if (options && options.color) {
                                sqlObject.colorR = options.color.value[0];
                                sqlObject.colorG = options.color.value[1];
                                sqlObject.colorB = options.color.value[2];
                                sqlObject.dark_color = options.color.isDark;
                            }
                            /*sqlObject.attachment_type = ((r,n) => {
                                const _n = ((r) ? r : n).split('.').pop().toLowerCase()
                                if (_n.startsWith('jp') || _n === 'jfif') // JPEG
                                    return 1
                                else if (_n === 'png') // PNG
                                    return 2
                                else if (_n === 'tiff') // TIFF
                                    return 3
                                else if (_n === 'bmp') // Bitmap
                                    return 4
                                else if (_n === 'webp') // WebP
                                    return 5
                                else if (_n === 'heif') // HEIF
                                    return 6
                                else if (_n.startsWith('gif')) // GIF
                                    return 10
                                else if (_n === 'psd' || _n === 'psb') // Photoshop
                                    return 50
                                else if (_n === 'mp4' || _n === 'mpeg4' || _n === 'mov' || _n === 'm4v' || _n === 'webm') // Possible Web Video
                                    return 20
                                else if (_n === 'ts' || _n === 'mkv' || _n === 'm2ts' || _n === 'mts') // Non-Web Video
                                    return 21
                                else if (_n === 'mp3' || _n === 'm4a' || _n === 'ogg' || _n === 'oga' || _n === 'mogg' || _n === 'opus' || _n === 'wav') // Web Audio
                                    return 40
                                else if (_n === 'flac' || _n === 'aiff' || _n === 'alac' || _n === 'wma') // Non-Web Audio
                                    return 41
                                else if (_n.startsWith('unity') || _n === 'material' || _n === 'shader' || _n === 'vrca') // Unity Format
                                    return 61
                                else if (_n === 'fbx' || _n === 'dae' || _n === 'obj' || _n.startsWith('c4')) // 3D Format
                                    return 62
                                else if (_n === 'zip' || _n === 'tar' || _n === 'rar' || _n.startsWith('7z') || _n.startsWith('bz')) // Archive
                                    return 80
                                else if (_n === 'iso' || _n === 'bin' || _n === 'cd' || _n === 'img') // Archive Disk
                                    return 81
                                return 0;
                            })(sqlObject.real_filename, sqlObject.attachment_name)*/
                            // Write to database
                            const addedMessage = await db.query(`INSERT IGNORE INTO kanmi_records SET ?`, [sqlObject]);
                            if (addedMessage.error) {
                                SendMessage("SQL Error occurred when saving to the message cache", "err", 'main', "SQL", addedMessage.error)
                                console.error(addedMessage.error)
                            } else {
                                if (chDbval.autofetch === 1 && sqlObject.fileid) {
                                    try {
                                        Logger.printLine("SF-Capture", `Auto Fetching ${sqlObject.fileid}`, "debug");
                                        setTimeout(() => {
                                            jfsGetSF(sqlObject.fileid, { userID: 'none' });
                                        }, 30000);
                                    } catch (err) {
                                        SendMessage("Error occurred when attempting to automatically download Spanned File", "warn", 'main', "AutoCache", err)
                                    }
                                }
                                if (sqlObject.attachment_hash && sqlObject.attachment_name.toString() !== 'multi' && !sqlObject.colorR) {
                                    cacheColor(msg.id, `https://cdn.discordapp.com/attachments${sqlObject.channel}/${sqlObject.attachment_hash}/${sqlObject.attachment_name}`)
                                }

                                if (chDbval.notify !== null) {
                                    try {
                                        let channelName = (chDbval.nice_name !== null) ? chDbval.nice_name : msg.channel.name;
                                        //systemglobal.base_url
                                        const guildInfo = discordClient.guilds.get(msg.guildID)
                                        let embedText = sqlObject.content_full
                                        if (sqlObject.fileid) {
                                            embedText = embedText.split('\n').splice(3).join('\n')
                                        }
                                        let embed = {
                                            "color": 16746515,
                                            "timestamp": (sqlObject.date) ? sqlObject.date : (new Date(msg.timestamp)).toISOString(),
                                            "footer": {
                                                "text": guildInfo.name,
                                                "icon_url": guildInfo.iconURL
                                            },
                                            "description": (embedText.length > 2) ? embedText : undefined,
                                            "title": `New Content added to ${channelName}!`
                                        }
                                        if (sqlObject.user !== discordClient) {
                                            const memberAccount = await db.query(`SELECT * FROM discord_users WHERE id = ? LIMIT 1`, [sqlObject.user])
                                            if (memberAccount.error) {

                                            } else if (memberAccount.rows.length > 0) {
                                                embed["author"] = {
                                                    "name": (memberAccount.rows[0].nice_name) ? memberAccount.rows[0].nice_name : memberAccount.rows[0].username,
                                                    "icon_url": (memberAccount.rows[0].avatar) ? `https://cdn.discordapp.com/avatars/${memberAccount.rows[0].id}/${memberAccount.rows[0].avatar}.png` : "https://cdn.discordapp.com/embed/avatars/1.png"
                                                }
                                            }
                                        }
                                        if (sqlObject.real_filename) {
                                            embed["title"] = sqlObject.real_filename
                                        } else if (embedText.length <= 2) {
                                            embed["title"] = sqlObject.attachment_name
                                        }
                                        if ((sqlObject.attachment_hash || sqlObject.cache_proxy) &&
                                            ['jpg','png','gif','jfif','jpeg'].indexOf(((sqlObject.cache_proxy) ? sqlObject.cache_proxy : sqlObject.attachment_name).split('.').pop().toLowerCase()) !== -1) {
                                            embed[(sqlObject.fileid) ? "thumbnail" : "image"] = {
                                                "url": (sqlObject.cache_proxy) ? `${(!sqlObject.cache_proxy.startsWith('http') ? 'https://cdn.discordapp.com/attachments' : '')}${sqlObject.cache_proxy}` : `https://cdn.discordapp.com/attachments/` + ((sqlObject.attachment_hash.includes('/')) ? sqlObject.attachment_hash : `${sqlObject.channel}/${sqlObject.attachment_hash}/${sqlObject.attachment_name}`)
                                            }
                                        }
                                        if (systemglobal.base_url)
                                            embed["url"] = `${systemglobal.base_url}${(embed.thumbnail || embed.image) ? 'gallery' : 'cards'}?channel=${msg.channel.id}&search=id:${msg.id}&nsfw=true`
                                        await Promise.all(chDbval.notify.split(' ').map(async ch => {
                                            try {
                                                await discordClient.createMessage(ch, { embed });
                                            } catch (err) {
                                                Logger.printLine("Discord", `Failed to send notification message ${msg.id}`, "error", err)
                                            }
                                        }))
                                    } catch (err) {
                                        Logger.printLine("Discord", `Failed to send notification message ${msg.id}`, "error", err)
                                        console.error(err)
                                    }
                                }
                            }
                        }
                        // Add Reactions for Channels that have Auto Emotes enabled
                        if (!(options && options.forceAdd)) {
                            let reactions = [];
                            const clear_btn = (await db.query(`SELECT clearbtn FROM discord_autoclean WHERE clearbtn = 1 AND channelid = ?`, [msg.channel.id])).rows.length > 0
                            const clear_trd = (await db.query(`SELECT pinbutton FROM discord_autothread WHERE pinbutton = 1 AND lastthread = ?`, [msg.channel.id])).rows.length > 0
                            if ( clear_btn || clear_trd ) { reactions.push('Clear'); }
                            const managementButtons = ['Pin', 'Archive', 'MoveMessage', 'SendTweet'];
                            reactions.push(...(await db.query(`SELECT emoji_name FROM discord_reactions_autoadd WHERE channelid = ?`, [msg.channel.id])).rows.map(e => e.emoji_name))
                            const reaction_buttons = await db.query(`SELECT reaction_emoji, reaction_custom FROM discord_reactions WHERE serverid = ?`, [msg.guildID]);
                            await reaction_buttons.rows.filter(e =>
                                reactions.indexOf(e.reaction_name) !== -1 && ((options && options.isMoved && !e.automove_channelid && e.readd === 1) || !(options && options.isMoved)) &&
                                ((!systemglobal.Discord_FSMgr_Enable && managementButtons.indexOf(e.reaction_name) !== -1) || managementButtons.indexOf(e.reaction_name) === -1)
                            ).map(e => (e.reaction_custom) ? e.reaction_custom : e.reaction_emoji).forEach(e => {
                                discordClient.addMessageReaction(msg.channel.id, msg.id, e)
                                    .catch((er) => {
                                        SendMessage(`Failed to add "${e}" emotes to message! Retrying... #1`, "warn", msg.guildID, "AutoAdd", er)
                                        discordClient.addMessageReaction(msg.channel.id, msg.id, e)
                                            .catch((er) => {
                                                SendMessage(`Failed to add "${e}" emotes to message! Retrying... #2`, "warn", msg.guildID, "AutoAdd", er)
                                                discordClient.addMessageReaction(msg.channel.id, msg.id, e)
                                                    .catch((er) => {
                                                        SendMessage(`Failed to add "${e}" emotes to message! Aborted!`, "warn", msg.guildID, "AutoAdd", er)
                                                    });
                                            });
                                    });
                            })

                            if (msg.author.bot !== true || (systemglobal.Discord_Overided_Bots && systemglobal.Discord_Overided_Bots.length > 0 && systemglobal.Discord_Overided_Bots.indexOf(msg.author.id) !== -1) || (systemglobal.Discord_Websockets_As_Users && systemglobal.Discord_Websockets_As_Users === true)) {
                                if (TwitterActivityChannels.has(msg.channel.id)) { // IF ( From the Twitter Activity Channel )
                                    // Considered to be a Reply to a Tweet
                                    if (msg.messageReference && msg.messageReference.messageID) {
                                        discordClient.getMessage(msg.messageReference.channelID, msg.messageReference.messageID)
                                            .then(function (refMsg) {
                                                const FullMessage = refMsg.content + '\n<@!> ' + msg.content
                                                sendTwitterAction(FullMessage, 'SendTweet', "Reply", msg.attachments, msg.channel.id, msg.guildID, refMsg.embeds);
                                            })
                                            .catch(function (err) {
                                                Logger.printLine("GetReference", `Failed to get reference message`, 'error', err)
                                            })
                                    } else {
                                        sendTwitterAction(msg.content, 'SendTweet', "send", msg.attachments, msg.channel.id, msg.guildID);
                                    }
                                } else if (msg.channel.id === serverdata.chid_download) {
                                    setTimeout(() => {
                                        downloadRemoteFile(msg, serverdata);
                                    }, 5000)
                                } else if (msg.channel.id !== serverdata.chid_system) {
                                    addStandardReactions(msg)
                                }
                            }
                        }
                        if (options && options.logLine) {
                            Logger.printLine("Discord", options.logLine, "debug", {
                                messageID: msg.id,
                                channelID: msg.channel.id,
                                channelName: msg.channel.name,
                                memberID: msg.author.id,
                                memberNick: msg.author.nick,
                                guildID: msg.guildID,
                                guildName: msg.channel.guild.name,
                                messageContent: msg.content,
                                messageAttachments: msg.attachments,
                                messageEmbeds: msg.embeds
                            })
                        } else {
                            const username = (msg.author.nick) ? msg.author.nick : msg.author.username;
                            const isThread = (msg.channel.type === 11 || msg.channel.type === 12);
                            Logger.printLine("Discord", `New Message: ${msg.id}@"${msg.channel.name}"${(isThread) ? " (Thread)" : ""} from "${username}"@"${msg.channel.guild.name}"`, "debug", {
                                messageID: msg.id,
                                channelID: msg.channel.id,
                                channelName: msg.channel.name,
                                memberID: msg.author.id,
                                memberNick: msg.author.nick,
                                guildID: msg.guildID,
                                guildName: msg.channel.guild.name,
                                messageContent: msg.content,
                                messageAttachments: msg.attachments,
                                messageEmbeds: msg.embeds
                            });
                        }
                    }
                    if (msg.author.id === selfstatic.id && !(options && options.forceAdd)) { // IF ( Message is self created )
                        setTimeout(function () {
                            try {
                                if (msg.channel.id === serverdata.chid_download && msg.content.includes("REQUEST")) {
                                    downloadRemoteFile(msg, serverdata);
                                }
                            } catch (e) {
                                console.error(e)
                            }
                        }, 5000)
                    }
                    break;
            }
        }
        activeTasks.delete(`NEW_MSG_${msg.id}`)
    }
    async function messageUpdate(msg, refrance) {
        await activeTasks.set(`EDIT_MSG_${msg.id}`, { started: Date.now().valueOf() });
        if (discordChannels.has(msg.channel.id)) {
            let sqlObject = {
                source: 0,
                server: msg.guildID,
                channel: msg.channel.id,
                content_full: msg.content,
            };
            if (refrance) {
                sqlObject.id = msg.id;
            }
            if (msg.content) {
                sqlObject.content_full = sqlObject.content_full.split('\n').filter(e => !(e.startsWith('_') && e.includes(':'))).join('\n')
            }
            if (msg.content && msg.content.includes('🏷 Name:')) {
                const input = msg.content.split("**\n*")[0].replace("**🧩 File : ", '')
                if (msg.content.includes("MB)")) {
                    sqlObject.filesize = msg.content.split('MB)')[0].split(' (').pop().trim()
                }
                const splitName = msg.content.split("🏷 Name:").pop().split('\n')[0].split(" (")
                sqlObject.fileid = input.trim().replace(/\n|\r/g, '')
                if (splitName.length > 2) {
                    let real_filename = ''
                    splitName.forEach(function (part, index) {
                        if (index === splitName.length - 2) {
                            real_filename += part.trim()
                        } else if (index !== splitName.length - 1) {
                            real_filename += part.trim() + ' ('
                        }
                        if (index === splitName.length - 1) {
                            real_filename = real_filename.trim()
                        }
                    })
                    sqlObject.real_filename = real_filename.trim().replace(/[/\\?%*:|"<> ]/g, '_');;
                } else {
                    sqlObject.real_filename = splitName[0].trim().replace(/[/\\?%*:|"<> ]/g, '_').trim();
                }
            }
            if (msg.attachments && (msg.attachments.length === 1 || (msg.attachments.length > 1 && msg.attachments.filter(e => e.filename.toLowerCase().includes('-t9-preview')).length > 0))) {
                const urlParts = msg.attachments[0].url.split(`https://cdn.discordapp.com/attachments/`)
                if (urlParts.length === 2) {
                    sqlObject.attachment_hash = (urlParts[1].startsWith(`${msg.channel.id}/`)) ? urlParts[1].split('/')[1] : urlParts[1];
                    sqlObject.attachment_name = urlParts[1].split('/')[2]
                } else {
                    sqlObject.attachment_hash = msg.attachments[0].url
                    sqlObject.attachment_name = msg.attachments[0].filename
                }
                sqlObject.attachment_extra = null

                if (!(refrance && refrance.no_update_dimentions) && msg.attachments && msg.attachments.length > 0 && msg.attachments[0].width !== undefined && msg.attachments[0].width > 0) {
                    sqlObject.sizeW = msg.attachments[0].width;
                    sqlObject.sizeH = msg.attachments[0].height;
                    sqlObject.sizeR = (msg.attachments[0].height / msg.attachments[0].width);
                }

                if (msg.attachments.length > 1 && msg.attachments.pop().filename.toLowerCase().includes('-t9-preview-video')) {
                    sqlObject.cache_proxy = msg.attachments.pop().proxy_url.split('/attachments').pop();
                }
            } else if (msg.attachments && msg.attachments.length > 1) {
                sqlObject.attachment_name = null
                sqlObject.attachment_hash = null
                let _fileextra = []
                for (let index in msg.attachments) {
                    let _filesize = null
                    await new Promise((resolve, reject) => {
                        remoteSize(msg.attachments[0].url, async (err, size) => {
                            if (!err || (size !== undefined && size > 0)) {
                                _filesize = (size / 1024000).toPrecision(2)
                                resolve(true)
                            } else {
                                resolve(false)
                            }
                        })
                    })
                    _fileextra.push([msg.attachments[index].filename, msg.attachments[index].url, msg.attachments[index].proxy_url, _filesize])
                }
                sqlObject.attachment_extra = JSON.stringify(_fileextra).toString()
            }
            if ((await db.query(`SELECT eid FROM kanmi_records WHERE id = ?`, [(refrance) ? refrance.id : msg.id])).rows.length > 0) {
                const addedMessage = await db.query(`UPDATE kanmi_records SET ? WHERE id = ?`, [sqlObject, (refrance) ? refrance.id : msg.id]);
                if (addedMessage.error) {
                    SendMessage("SQL Error occurred when saving to the message cache", "err", 'main', "SQL", addedMessage.error)
                    console.error(addedMessage.error)
                }
            } else {
                await messageCreate(msg, {
                    forceAdd: true,
                    ...refrance
                })
            }
            if (refrance && refrance.channel && refrance.id) {
                setTimeout(() => {
                    discordClient.deleteMessage(refrance.channel, refrance.id, "Message was moved")
                        .catch((er) => {
                        })
                }, (refrance && refrance.delay) ? 30000 : 1000)
            }
            if (refrance && refrance.action && (refrance.action === 'jfsMove' || refrance.action === 'jfsRotate')) {
                if (sqlObject.fileid && discordChannels.get(msg.channel.id).autofetch === 1) {
                    try {
                        Logger.printLine("SF-Capture", `Auto Fetching ${sqlObject.fileid}`, "debug");
                        setTimeout(() => {
                            jfsGetSF(sqlObject.fileid, {userID: 'none'});
                        }, 30000);
                    } catch (err) {
                        SendMessage("Error occurred when attempting to automatically download Spanned File", "warn", 'main', "AutoCache", err)
                    }
                }
            }
        }
        activeTasks.delete(`EDIT_MSG_${msg.id}`)
    }
    async function messageDelete(msg, bulk, deleteMsg) {
        if (!bulk) {
            Logger.printLine("Discord", `Message Deleted: ${msg.id}@${msg.channel.id}`, "debug");
            await activeTasks.set(`DEL_MSG_${msg.id}`, { started: Date.now().valueOf() });
        }
        if (msg.channel.id) {
            const serverdata = await db.query(`SELECT discord_servers.chid_filecache, kanmi_channels.classification FROM kanmi_channels, discord_servers WHERE kanmi_channels.channelid = ? AND discord_servers.serverid = kanmi_channels.serverid AND kanmi_channels.source = 0`, [msg.channel.id])
            const polyfillitem = await db.query(`SELECT cache FROM discord_cache WHERE id = ?`, [msg.id]);
            if (serverdata.error) {
                SendMessage("SQL Error occurred when retrieving the guild data", "err", 'main', "SQL", serverdata.error)
            } else {
                if (polyfillitem.rows.length > 0) {
                    try  {
                        await discordClient.deleteMessage(serverdata.rows[0].chid_filecache, polyfillitem.rows[0].cache)
                        const removeItem = await db.query(`DELETE FROM discord_cache WHERE id = ?`, [msg.id])
                        if (removeItem.error) {
                            SendMessage("SQL Error occurred when removing the discord message from the polyfill table", "err", 'main', "SQL", removeItem.error)
                        } else {
                            Logger.printLine("Discord", `Polyfill Deleted: ${msg.id}:${polyfillitem.rows[0].cache}`, "debug");
                        }
                    } catch (er) {
                        console.log(er)
                        SendMessage("There was a error removing the discord message polyfill cache image", "err", msg.guild.id, "PolyfillManager", er)
                    }
                }
                if (serverdata.rows.length > 0 && (serverdata.rows[0].classification === null || (serverdata.rows[0].classification !== 'system' && serverdata.rows[0].classification !== 'timelime'))) {
                    const removeItem = await db.query(`DELETE FROM kanmi_records WHERE id = ? AND source = 0`, [msg.id])
                    if (removeItem.error) {
                        SendMessage("SQL Error occurred when deleting the message from the cache", "err", 'main', "SQL", removeItem.error);
                    }
                }
            }
        }
        if (deleteMsg) {
            try {
                await discordClient.deleteMessage(msg.channel.id, msg.id, "Delete Request")
            } catch (err) {

            }
        }
        if (!bulk)
            activeTasks.delete(`DEL_MSG_${msg.id}`);
        await db.query(`DELETE FROM twitter_tweets WHERE messageid = ?`, [msg.id])
    }
    async function messageDeleteBulk(msg_array) {
        const dateNow = new Date().valueOf();
        await activeTasks.set(`BULK_DEL_${dateNow}`, { started: Date.now().valueOf() });
        Logger.printLine("Discord", `Message Bulk Delete: ${msg_array.length} Removed`, "debug");
        await Promise.all(msg_array.map(async e => await messageDelete(e, true)));
        activeTasks.delete(`BULK_DEL_${dateNow}`);
    }
    function messageRecache(channelid, guildid, startpoint, limiter, forceBypass) {
        let channels = channelid.reduce((promiseChain2, channelItem) => {
            return promiseChain2.then(() => new Promise(async (chresolve) => {
                const chStart = Date.now().valueOf()
                await activeTasks.set(`REPAIR_${channelItem.channelid}`, { started: chStart });
                let messageCount = 0;
                const response = await db.query(`SELECT * FROM kanmi_channels WHERE parent != 'isparent' AND classification != 'system' AND classification != 'timeline' AND channelid = ? AND source = 0`, [channelItem.channelid])
                if (response.error) {
                    chresolve(true);
                    activeTasks.delete(`REPAIR_${channelItem.channelid}`);
                    SendMessage("SQL Error occurred when retrieving the channel list", "err", 'main', "SQL", response.error)
                } else {
                    let requests = response.rows.reduce((promiseChain, item) => {
                        return promiseChain.then(() => new Promise(async (resolve) => {
                            SendMessage(`Started Filesystem Repair for folder "${item.short_name}" ...`, "info", guildid, "RepairFileSystem")
                            const find_response = await db.query(`SELECT * FROM kanmi_records WHERE channel = ? AND source = 0`, [item.channelid]);
                            if (find_response.error) {
                                SendMessage("SQL Error occurred when searching for items in database for repair", "err", 'main', "SQL", find_response.error)
                                resolve()
                            } else {
                                // Parse the Messages
                                function parseMessageArray(messages, completedPage){
                                    let parserequests = messages.reduce((promiseChain, message) => {
                                        return promiseChain.then(() => new Promise(async (resolveMessage) => {
                                            const found_message = await find_response.rows.filter(e => e.id === message.id);
                                            if (found_message.length === 0) {
                                                await messageCreate(message, { forceAdd: true});
                                            } else if (found_message.length === 1) {
                                                await messageUpdate(message);
                                            }
                                            resolveMessage();
                                        }))
                                    }, Promise.resolve());
                                    parserequests.then(() => {
                                        completedPage();
                                    })
                                }
                                // Get Messages from Discord
                                function getMessages(lastmessage, shouldresolve) {
                                    discordClient.getMessages(item.channelid, 5000, lastmessage)
                                        .then(function (messages) {
                                            parseMessageArray(messages, (ok) => {
                                                console.log(messages.length)
                                                if (messages.length === 5000 && !(limiter && limiter >= messageCount)) {
                                                    messageCount += messages.length
                                                    activeTasks.set(`REPAIR_${channelItem.channelid}`,  { started: chStart, details: messageCount });
                                                    SendMessage(`Searching for 5000 messages before ${messages[0].id} in "${item.short_name}" ...`, "info", guildid, "RepairFileSystem")
                                                    lastmessage = (messages.map(e => parseInt(e.id)).sort()[0]).toString();
                                                    getMessages(lastmessage, shouldresolve)
                                                } else {
                                                    if (shouldresolve) {
                                                        resolve()
                                                    }
                                                    SendMessage(`Completed verification of "${item.channelid}", Other tasks are possibly still running`, "info", guildid, "RepairFileSystem")
                                                }
                                            });
                                        })
                                        .catch(function (err) {
                                            SendMessage(`Error getting messages from discord (Before): ${err.message} for "${item.channelid}", retrying in 60 seconds....`, "error", guildid, "RepairFileSystem")
                                            setTimeout(function () {
                                                getMessages(lastmessage, shouldresolve);
                                            },60000);
                                        })
                                }

                                let startBefore = 0
                                if (startpoint) {
                                    startBefore = startpoint
                                }
                                if (channelid.length === 1) {
                                    getMessages(startBefore, true)
                                } else if (forceBypass === true || find_response.rows.length < 10000) {
                                    getMessages(startBefore, true)
                                } else {
                                    SendMessage(`Skipped repairing <#${channelItem.channelid}> because there are more then 10000 items!`, "err", 'main', "RepairFileSystem")
                                    resolve()
                                }
                            }
                        }))
                    }, Promise.resolve());
                    requests.then(() => {
                        chresolve(true);
                        activeTasks.delete(`REPAIR_${channelItem.channelid}`);
                        SendMessage(`Completed processing Filesystem Repair, Other tasks are possibly still running use "jfs status" to check`, "info", guildid, "RepairFileSystem")
                    })
                }
            }))
        }, Promise.resolve());
        channels.then(() => {
            if (channelid.length > 1) {
                SendMessage(`Completed full Filesystem Repair for all channels (excluding channels with more then 1000 items)`, "message", 'main', "RepairFileSystem")
            }
        })
    }
    async function spannedPartsRecache(startpoint, limiter) {
        await Promise.all((await db.query(`SELECT chid_filedata, serverid, short_name FROM discord_servers WHERE chid_filedata IS NOT null ORDER BY position`)).rows.map(async guild => {
            const chStart = Date.now().valueOf()
            await activeTasks.set(`PARITY_REPAIR_${(guild.short_name) ? guild.short_name : guild.serverid}`, { started: chStart });
            let messageCount = 0;

            SendMessage(`Started Filesystem Parity Repair for server ${discordClient.guilds.get(guild.serverid).name} ...`, "info", guild.serverid, "RepairFileSystem")
            const find_response = await db.query(`SELECT * FROM discord_multipart_files WHERE serverid = ?`, [guild.serverid]);
            if (find_response.error) {
                SendMessage("SQL Error occurred when searching for items in database for repair", "error", 'main', "SQL", find_response.error)
            } else {
                let lastmessage = 0
                if (startpoint) {
                    lastmessage = startpoint
                }
                let failCount = 0;
                while (true) {
                    try {
                        const messages = await discordClient.getMessages(guild.chid_filedata, 5000, lastmessage)
                        failCount = 0;
                        await Promise.all(messages.map(async message => {
                            const found_message = find_response.rows.filter(e => e.messageid === message.id);
                            if (message.attachments.length > 0) {
                                if (found_message.length === 1) {
                                    if (found_message[0].url !== message.attachments[0].url) {
                                        const addPart = await db.query(`UPDATE discord_multipart_files SET url = ?, valid = 1 WHERE messageid = ?`, [message.attachments[0].url, message.id])
                                        if (addPart.error) {
                                            SendMessage(`Failed to update part in database for ${found_message[0].fileid}`, "error", 'main', "PartsInspector", addPart.error)
                                        } else {
                                            SendMessage(`Updated part for ${found_message[0].fileid} with ${message.id}: New URL`, "info", 'main', "PartsInspector")
                                        }
                                    }
                                } else if (message.content.includes('🧩 ID: ')) {
                                    const fileid = message.content.split('🧩 ID: ').pop().split('\n')[0].trim()
                                    const count = message.content.split('📦 Part: ').pop().split('/').pop().trim()
                                    const addPart = await db.query(`REPLACE INTO discord_multipart_files SET ?`, [{
                                        messageid: message.id,
                                        channelid: message.channel.id,
                                        serverid: message.guildID,
                                        url: message.attachments[0].url,
                                        fileid,
                                        valid: 1
                                    }])
                                    await db.query(`UPDATE kanmi_records SET paritycount = ? WHERE fileid = ?`, [count, fileid])
                                    if (addPart.error) {
                                        SendMessage(`Failed to add part to database for ${fileid}`, "error", 'main', "PartsInspector", addPart.error)
                                    } else {
                                        SendMessage(`Found part for ${fileid} with ${message.id}`, "info", 'main', "PartsInspector", message.content)
                                    }
                                } else {
                                    SendMessage(`Unable to proccess message ${message.id}, No readable data was gathered`, "error", 'main', "PartsInspector", message.content)
                                }
                            } else {
                                SendMessage(`Unable to proccess message ${message.id}, No data was attached to the message`, "error", 'main', "PartsInspector")
                            }
                        }))
                        if (messages.length === 5000 && !(limiter && limiter >= messageCount)) {
                            messageCount += messages.length
                            activeTasks.set(`PARITY_REPAIR_${(guild.short_name) ? guild.short_name : guild.serverid}`,  { started: chStart, details: messageCount });
                            SendMessage(`Searching for 5000 messages before ${lastmessage} in parity channel ...`, "info", guild.serverid, "RepairFileSystem")
                            lastmessage = (messages.map(e => parseInt(e.id)).sort().pop()).toString();
                        } else {
                            SendMessage(`Completed verification of ${discordClient.guilds.get(guild.serverid).name} parity channel, Other tasks are possibly still running`, "info", guild.serverid, "RepairFileSystem")
                            activeTasks.delete(`PARITY_REPAIR_${(guild.short_name) ? guild.short_name : guild.serverid}`);
                            break;
                        }
                    } catch (err) {
                        if (failCount >= 10)
                            break;
                        failCount++
                        SendMessage(`Error getting messages from discord (Before): ${err.message} for "${discordClient.guilds.get(guild.serverid).name}", retrying....`, "error", guild.serverid, "RepairFileSystem")
                        activeTasks.delete(`PARITY_REPAIR_${(guild.short_name) ? guild.short_name : guild.serverid}`);
                        console.error(err)
                    }
                }
            }
        }))
        SendMessage(`Completed repair of filesystem parity records in the database and discord, check Info and Errors for details!`, "message", 'main', "RepairFileSystem")
    }
    function messageCheckCache() {
        // Parse the Messages

        function parseMessageArray(messages){
            let processed = 0
            function printProcess() {
                if (processed < messages.length) {
                    SendMessage(`Database update proccess  ${((processed/messages.length) * 100).toFixed(2)}% (${processed}/${messages.length})`, "info", 'main', "RepairFileSystem");
                    setTimeout(printProcess, 1800000);
                }
            }
            setTimeout(printProcess, 60000)
            SendMessage(`Updating ${messages.length} messages in the database to fill missing data...`, "info", 'main', "RepairFileSystem")
            let parserequests = messages.reduce((promiseChain, sqlMessage) => {
                return promiseChain.then(() => new Promise((resolveMessage) => {
                    discordClient.getMessage(sqlMessage.channel, sqlMessage.id)
                        .then((message) => {
                            if (message.attachments && message.attachments.length === 1 && message.attachments[0].height !== undefined) {
                                const sizeW = message.attachments[0].width;
                                const sizeH = message.attachments[0].height;
                                const sizeR = (message.attachments[0].height / message.attachments[0].width);

                                db.safe(`UPDATE kanmi_records SET sizeH = ?, sizeW = ?, sizeR = ? WHERE id = ?`, [sizeH, sizeW, sizeR, message.id], (err) => {
                                    if (err) {
                                        SendMessage(`SQL Error occurred when attempting to repair out of sync message ${message.id}`, "error", 'main', "SQL", err)
                                        processed++
                                        resolveMessage();
                                    } else {
                                        processed++
                                        resolveMessage();
                                    }
                                })
                            } else {
                                processed++
                                resolveMessage();
                            }
                        })
                }))
            }, Promise.resolve());
            parserequests.then(() => {
                SendMessage(`Completed updating ${messages.length} records in the database!`, "message", 'main', "RepairFileSystem")
            })
        }

        db.safe(`SELECT * FROM kanmi_records WHERE (sizeH IS NULL OR sizeW IS NULL OR sizeR IS NULL) AND attachment_hash IS NOT NULL AND (attachment_name LIKE '%.jpeg' OR attachment_name LIKE '%.jpg' OR attachment_name LIKE '%.png' OR attachment_name LIKE '%.gif' OR attachment_name LIKE '%.mp4' OR attachment_name LIKE '%.web%_' OR attachment_name LIKE '%.mov') AND source = 0`, [], function (err, response_messages) {
            if (err) {
                SendMessage("SQL Error occurred when searching for item in database for repair", "error", 'main', "SQL", err)
            } else {
                parseMessageArray(response_messages)
            }
        })
    }
    // Discord Events - Actions
    function messageReactionAdd(msg, emoji, user) {
        const userID = (user.id) ? user.id : user
        const isBot = (user) ? discordClient.users.get(userID).is_bot : true
        if ((!isBot || (systemglobal.Discord_Allow_Reactions_From_Bots && systemglobal.Discord_Allow_Reactions_From_Bots.length > 0 && systemglobal.Discord_Allow_Reactions_From_Bots.indexOf(userID) !== -1)) && parseInt(userID.toString()) !== parseInt(selfstatic.id.toString()) && isAuthorizedUser('notBot', userID, null, msg.channel.id)) {
            Logger.printLine("Discord", `Reaction Added: ${emoji.name} - ${msg.guildID}`, "debug", emoji)
            db.safe(`SELECT * FROM discord_reactions WHERE reaction_emoji = ? AND serverid = ?`, [emoji.name, msg.guildID], function (err, discordreact) {
                if (err) {
                    SendMessage("SQL Error occurred when retrieving the reaction table", "err", 'main', "SQL",err)
                } else {
                    if (discordreact[0] !== undefined) {
                        discordClient.getMessage(msg.channel.id, msg.id)
                            .then(async (fullmsg) => {
                                if (isAuthorizedUser(discordreact[0].reaction_name, userID, fullmsg.guildID, fullmsg.channel.id) || isAuthorizedUser('interact', userID, fullmsg.guildID, fullmsg.channel.id)) {
                                    if (discordreact[0].automove_channelid === null) {
                                        let _rname = discordreact[0].reaction_name
                                        if (discordreact[0].reaction_name.includes('DownloadTo')) {
                                            _rname = 'Download';
                                        }
                                        switch (_rname) {
                                            case 'Pin':
                                                addFavorite(msg.channel.id, msg.id, fullmsg.guildID)
                                                break;
                                            case 'Like':
                                                if (fullmsg.content.includes('://pixiv.net/') || (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && fullmsg.embeds[0].title.includes('🎆 '))) {
                                                    sendPixivAction(fullmsg.embeds[0], 'Like', "add");
                                                } else if (fullmsg.content.includes('://twitter.com') || (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && (fullmsg.embeds[0].title.includes('📨 Tweet') || fullmsg.embeds[0].title.includes('✳ Retweet')))) {
                                                    sendTwitterAction(fullmsg.content, 'Like', "add", fullmsg.attachments, msg.channel.id, fullmsg.guildID, fullmsg.embeds);
                                                }
                                                break;
                                            case 'Retweet':
                                                sendTwitterAction(fullmsg.content, 'Retweet', "add", fullmsg.attachments, msg.channel.id, fullmsg.guildID, fullmsg.embeds);
                                                break;
                                            case 'LikeRT':
                                                sendTwitterAction(fullmsg.content, "LikeRT", "add", fullmsg.attachments, msg.channel.id, fullmsg.guildID, fullmsg.embeds);
                                                break;
                                            case 'AddUser':
                                                if (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && (fullmsg.embeds[0].title.includes('📨 Tweet') || fullmsg.embeds[0].title.includes('✳ Retweet'))) {
                                                    const usernameToAdd = fullmsg.embeds[0].author.name.split(" (@").pop().slice(0, -1).toLowerCase()
                                                    sendTwitterAction(usernameToAdd, "listManager", "adduser", "", msg.channel.id, fullmsg.guildID, fullmsg.embeds)
                                                } else if (fullmsg.content.includes('RT @')) {
                                                    const usernameToAdd = fullmsg.content.split('RT @').pop().split(': ')[0]
                                                    sendTwitterAction(usernameToAdd, "listManager", "adduser", "", msg.channel.id, fullmsg.guildID)
                                                } else if (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && fullmsg.embeds[0].title.includes('🎆 ')) {
                                                    const userID = fullmsg.embeds[0].author.name.split(' - ')[1]
                                                    sendPixivAction(userID, "Follow", 'add')
                                                } else {
                                                    SendMessage("Action was done on a tweet that was not a retwet", "error", fullmsg.guildID, "TwitterAdd")
                                                }
                                                break;
                                            case 'Download':
                                                let channelSend = undefined;
                                                if (discordreact[0].download_channelid) {
                                                    channelSend = discordreact[0].download_channelid
                                                } else if ((fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && fullmsg.embeds[0].title.includes('🎆 ')) || discordServers.get(fullmsg.guildID).chid_download === fullmsg.channel.id) {
                                                    if (PixivSaveChannel.has(fullmsg.embeds[0].color)) {
                                                        channelSend = PixivSaveChannel.get(fullmsg.embeds[0].color);
                                                    } else if ((fullmsg.channel.type === 11 || fullmsg.channel.type === 12) && fullmsg.channel.parentID) {
                                                        const parent = await discordClient.getChannel(fullmsg.channel.parentID)
                                                        channelSend = (parent.nsfw === true) ? pixivaccount[0].save_channelid_nsfw : pixivaccount[0].save_channelid
                                                    } else {
                                                        channelSend = (fullmsg.channel.nsfw === true) ? pixivaccount[0].save_channelid_nsfw : pixivaccount[0].save_channelid
                                                    }
                                                }
                                                downloadMessageFile(fullmsg, channelSend, true)
                                                break;
                                            case 'SendTweet':
                                                sendTwitterAction(fullmsg.content, discordreact[0].reaction_name, "add", fullmsg.attachments, msg.channel.id, fullmsg.guildID);
                                                break;
                                            case 'ReplyTweet':
                                                discordClient.createMessage(twitteraccount[0].activitychannelid, {
                                                    content: fullmsg.content
                                                })
                                                    .catch((er) => {
                                                        SendMessage("Failed to mirror the requested tweet!", "err", fullmsg.guildID, "Discord", er)
                                                    });
                                                break;
                                            case 'ReqFile' :
                                                const input = fullmsg.content.split("**\n*")[0].replace("**🧩 File : ", '')
                                                jfsGetSF(input.trim().replace(/\n|\r/g, ''), {
                                                    userID: (userID) ? userID : undefined
                                                })
                                                break;
                                            case 'RemoveFile' :
                                                if (fullmsg.content.includes("🧩 File : ")) {
                                                    if (fullmsg.channel.id === discordServers.get(fullmsg.guildID).chid_download) {
                                                        jfsRemoveSF(fullmsg.channel.id, fullmsg.id, fullmsg.guildID)
                                                    } else {
                                                        parseRemoteAction({
                                                            fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                                                            messageReturn: false,
                                                            messageType: 'stext',
                                                            messageChannelID: discordServers.get(fullmsg.guildID).chid_system,
                                                            messageText: `Are you sure you want to delete ` + fullmsg.content.split('*🏷 Name:')[1].split(' MB)*')[0] + ` MB) :\nhttps://discord.com/channels/${fullmsg.guildID}/${fullmsg.channel.id}/${fullmsg.id}/ :`,
                                                            addButtons: ['Check']
                                                        }, 'priority', function (cb) {
                                                        })
                                                    }
                                                } else {
                                                    discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id)
                                                        .catch((er) => {
                                                            SendMessage("There was a error removing the message", "err", fullmsg.guildID, "CleanPost", er)
                                                        })
                                                }
                                                break;
                                            case 'DeleteThread':
                                                if (fullmsg.channel.type === 11 || fullmsg.channel.type === 12) {
                                                    discordClient.deleteChannel(fullmsg.channel.id)
                                                        .catch((er) => {
                                                            SendMessage("There was a error removing the channel", "err", fullmsg.guildID, "DeleteThread", er)
                                                        });
                                                } else {
                                                    SendMessage(`${fullmsg.channel.id} is not a thread channel`, "warn", fullmsg.guildID, "DeleteThread")
                                                }
                                                break;
                                            case 'Archive' :
                                                jfsArchive(fullmsg, serverdata[0])
                                                break;
                                            case 'MoveMessage' :
                                                if (collectorEnable.get(fullmsg.guildID)) {
                                                    const ItemID = `${fullmsg.guildID}-${Date.now().toString()}-${fullmsg.id}`
                                                    messsageCollector.setItem(ItemID, {
                                                        itemKey: ItemID,
                                                        messageID: fullmsg.id,
                                                        channelID: fullmsg.channel.id,
                                                        guildID: fullmsg.guildID,
                                                    })
                                                        .then(() => {
                                                            Logger.printLine("AddMessageCollector", `Message ${fullmsg.id} added to Collector`, "debug")
                                                        })
                                                        .catch(err => {
                                                            Logger.printLine("AddMessageCollector", `Failed to add Message ${fullmsg.id} to Collector`, "err")
                                                        })
                                                } else {
                                                    SendMessage('`' + `juzo jfs mvf <#${msg.channel.id}> ${msg.id} #` + '`', "system", fullmsg.guildID, "Move")
                                                    if (fullmsg.content.includes("🏷 Name:")) {
                                                        let fileName = ''
                                                        const splitName = fullmsg.content.split("🏷 Name:").pop().trim().split('\n')[0].split(" (")
                                                        if (splitName.length > 2) {
                                                            splitName.forEach(function (part, index) {
                                                                if (index === splitName.length - 2) {
                                                                    fileName += part
                                                                } else if (index !== splitName.length - 1) {
                                                                    fileName += part + ' ('
                                                                }
                                                            })
                                                        } else {
                                                            fileName = splitName[0]
                                                        }
                                                        SendMessage('`' + `juzo jfs rnf <#${msg.channel.id}> ${msg.id} ${fileName}` + '`', "system", fullmsg.guildID, "Move")
                                                    }
                                                }
                                                break;
                                            case 'ExpandSearch' :
                                                sendPixivAction(fullmsg.embeds[0], discordreact[0].reaction_name, "add", undefined, true)
                                                break;
                                            case 'Clear' :
                                                if (fullmsg.channel.type === 11 || fullmsg.channel.type === 12) {
                                                    try {
                                                        discordClient.pinMessage(fullmsg.channel.id, fullmsg.id)
                                                    } catch (err) {
                                                        Logger.printLine("ClearUp", `Unable to pin message ${fullmsg.channel.id}`, "error", err);
                                                    }
                                                } else {
                                                    if (clearTimers.has(fullmsg.channel.id)) {
                                                        const _t = clearTimers.get(fullmsg.channel.id)
                                                        clearTimeout(_t);
                                                        clearTimers.delete(fullmsg.channel.id);
                                                        clearTimers.delete(fullmsg.channel.id);
                                                        Logger.printLine("CleanTimer", `Canceled Clean Timer for ${fullmsg.channel.id}`, "debug");
                                                    }
                                                    const _timer = setTimeout(function () {
                                                        deleteAbove(fullmsg.channel.id, fullmsg.id);
                                                    }, 15000);
                                                    clearTimers.set(fullmsg.channel.id, _timer);
                                                    Logger.printLine("CleanTimer", `Started Clean Timer for ${fullmsg.channel.id}`, "debug");
                                                }
                                                break;
                                            case 'Check' :
                                                if (fullmsg.content.includes('://youtube.com') || fullmsg.content.includes('://yt.be') || fullmsg.content.startsWith('**⏰ ')) {
                                                    discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id)
                                                        .catch((er) => {
                                                            SendMessage("There was a error removing the message", "err", fullmsg.guildID, "CleanPost", er)
                                                        })
                                                }
                                                if (fullmsg.content.includes("Are you sure you want to delete ")) {
                                                    if (fullmsg.channel.id === discordServers.get(fullmsg.guildID).chid_system.toString()) {
                                                        const messageWanted = fullmsg.content.split("https://discord.com/channels/").pop().split('/')
                                                        jfsRemoveSF(messageWanted[1].toString(), messageWanted[2].toString().split(':')[0], messageWanted[0].toString());
                                                    }
                                                } else if (Timers.has(`alarmExpires-${fullmsg.id}`)) {
                                                    await clearTimeout(Timers.get(`alarmExpires-${fullmsg.id}`).expirationTimer);
                                                    Timers.delete(`alarmExpires-${fullmsg.id}`)
                                                }
                                                break;
                                            case 'RefreshStatus' :
                                                generateStatus(true, fullmsg.guildID);
                                                break;
                                            case 'AlarmSnooze':
                                                if (Timers.has(`alarmExpires-${fullmsg.id}`)) {
                                                    const _curAlm = Timers.get(`alarmExpires-${fullmsg.id}`)
                                                    try {
                                                        await discordClient.deleteMessage(fullmsg.channel.id, fullmsg.id)
                                                        await clearTimeout(_curAlm.expirationTimer);
                                                        Timers.delete(`alarmExpires-${fullmsg.id}`)
                                                    } catch (err) {
                                                        Logger.printLine("AlarmClock", `Failed to delete alarm notification for alarm clock #${_curAlm.id}`, 'error', err);
                                                    }
                                                    Timers.set(`alarmSnoozed-${_curAlm.id}`, {
                                                        text: _curAlm.text,
                                                        snoozeTimer: setTimeout(() => {
                                                            triggerAlarm(_curAlm.id)
                                                        }, (_curAlm.snooze && _curAlm.snooze >= 1) ? _curAlm.snooze * 60 * 1000 : 15 * 60 * 1000)
                                                    })
                                                }
                                                break;
                                            default :
                                                SendMessage("No Matching Route for " + discordreact[0].reaction_name, "warn", fullmsg.guildID, "Discord")
                                                break;
                                        }
                                    } else {
                                        jfsMove(fullmsg, discordreact[0].automove_channelid, function (cb) {
                                            if (cb != false) {
                                                SendMessage(`Message moved from <#${fullmsg.channel.id}> to <#${discordreact[0].automove_channelid}>`, "info", fullmsg.guildID, "Move")
                                            } else {
                                                SendMessage("There was an error archiving the message", "err", fullmsg.guildID, "Move")
                                            }
                                        })
                                    }
                                }
                            })
                            .catch((er) => {
                                Logger.printLine("Discord", `Unable to get message - ${er.message}`, "warn", er)
                            })
                    } else {
                        fs.writeFile(path.join(systemglobal.TempFolder, '/emoji.json'), JSON.stringify(emoji), err => {
                            if (err) {
                                console.error(err)
                            }
                        })
                        Logger.printLine("Discord", "Message was dropped. No Emote was matched", "warn", emoji)
                    }
                }
            });
        }
    }
    function messageReactionRemove(msg, emoji, user) {
        const userID = (user.id) ? user.id : user
        const isBot = discordClient.users.get(userID).is_bot
        if ((!isBot || systemglobal.Discord_Allow_Reactions_From_Bots) && parseInt(userID.toString()) !== parseInt(selfstatic.id.toString()) && isAuthorizedUser('notBot', userID, null, msg.channel.id) ) {
            Logger.printLine("Discord", `Reaction Removed: ${emoji.name}`, "debug", emoji)
            db.safe(`SELECT reaction_name FROM discord_reactions WHERE reaction_emoji = ? AND serverid = ?`, [emoji.name, msg.guild], function (err, discordreact) {
                if (err) {
                    SendMessage("SQL Error occurred when retrieving the reaction table", "err", 'main', "SQL", err)
                } else {
                    if ( discordreact[0] !== undefined ) {
                        discordClient.getMessage(msg.channel.id, msg.id)
                            .then(function(fullmsg) {
                                if (isAuthorizedUser('interact', userID, fullmsg.guildID, fullmsg.channel.id)) {
                                    switch (discordreact[0].reaction_name) {
                                        case 'Pin':
                                            removeFavorite(msg.channel.id, msg.id, fullmsg.guildID)
                                            break;
                                        case 'Like':
                                            if (fullmsg.content.includes('://pixiv.net/') || (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && fullmsg.embeds[0].title.includes('🎆 '))) {
                                                sendPixivAction(fullmsg.embeds[0], 'Like', "remove")
                                            } else if (fullmsg.content.includes('://twitter.com') || (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && (fullmsg.embeds[0].title.includes('📨 Tweet') ||fullmsg.embeds[0].title.includes('✳ Retweet')) )) {
                                                sendTwitterAction(fullmsg.content, 'Like', "remove", fullmsg.attachments, msg.channel.id, fullmsg.guildID);
                                            }
                                            break;
                                        case 'Retweet':
                                            sendTwitterAction(fullmsg.content, 'Retweet', "remove", fullmsg.attachments, msg.channel.id);
                                            break;
                                        case 'LikeRT':
                                            sendTwitterAction(fullmsg.content, "LikeRT", "remove" ,fullmsg.attachments, msg.channel.id);
                                            break;
                                        case 'AddUser':
                                            if (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && (fullmsg.embeds[0].title.includes('📨 Tweet') ||fullmsg.embeds[0].title.includes('✳ Retweet')) ) {
                                                const usernameToAdd = fullmsg.embeds[0].author.name.split(" (@").pop().slice(0, -1).toLowerCase()
                                                sendTwitterAction(usernameToAdd, "listManager", "removeuser", "", msg.channel.id, fullmsg.guildID, fullmsg.embeds)
                                            } else if (fullmsg.content.includes('RT @')) {
                                                const usernameToAdd = fullmsg.content.split('RT @').pop().split(': ')[0]
                                                sendTwitterAction(usernameToAdd, "listManager", "removeuser", "", msg.channel.id, fullmsg.guildID)
                                            } else if (fullmsg.content.includes('://pixiv.net/') || (fullmsg.embeds.length > 0 && fullmsg.embeds[0].title && fullmsg.embeds[0].title.includes('🎆 '))) {
                                                const userID = fullmsg.embeds[0].author.name.split(' - ')[1]
                                                sendPixivAction(userID, "Follow", 'remove')
                                            } else {
                                                SendMessage("Action was done on a tweet that was not a retwet", "error", fullmsg.guildID, "TwitterAdd")
                                            }
                                            break;
                                        case 'Clear':
                                            if (fullmsg.channel.type === 11 || fullmsg.channel.type === 12) {
                                                try {
                                                    discordClient.unpinMessage(fullmsg.channel.id, fullmsg.id)
                                                } catch (err) {
                                                    Logger.printLine("ClearUp", `Unable to remove pin for message ${fullmsg.channel.id}`, "error", err);
                                                }
                                            } else {
                                                if (clearTimers.has(fullmsg.channel.id)) {
                                                    const _t = clearTimers.get(fullmsg.channel.id);
                                                    clearTimeout(_t);
                                                    clearTimers.delete(fullmsg.channel.id);
                                                    Logger.printLine("CleanTimer", `Canceled Clean Timer for ${fullmsg.channel.id}`, "debug");
                                                }
                                            }
                                            break;
                                        case 'MoveMessage':
                                            if (collectorEnable.get(fullmsg.guildID)) {
                                                messsageCollector.valuesWithKeyMatch(fullmsg.id)
                                                    .then(function(result){
                                                        messsageCollector.removeItem(result[0].itemKey)
                                                            .then(() => {Logger.printLine("RemoveMessageCollector", `Message ${fullmsg.id} removed from Collector`, "debug")})
                                                            .catch(err => {Logger.printLine("RemoveMessageCollector", `Failed to removed Message ${fullmsg.id} to Collector`, "err")})
                                                    })
                                            }
                                            break;
                                        default :
                                            Logger.printLine("Discord", `Message was dropped, No Matching Route for ${discordreact[0].reaction_name}`, "warn", emoji)
                                            break;
                                    }
                                }
                            })
                            .catch((er) => {
                                Logger.printLine("Discord", `Unable to get message - ${er.message}`, "warn", er)
                            })
                    } else {
                        Logger.printLine("Discord", "Message was dropped. No Emote was matched", "warn")
                    }
                }
            });
        }
    }
    function messageReactionRemoveAll(msg) {

    }
    // Discord Events - Channel
    function channelCreate(channel) {
        if (channel && channel.type === 0) {
            db.safe(`SELECT channelid, classification, role, role_write, role_manage, autofetch FROM kanmi_channels WHERE ( channelid = ? AND parent = 'isparent' ) AND source = 0 LIMIT 1`, [channel.parentID], function (err, result) {
                if (!(err) && result && result.length === 1 && result[0].classification !== null) {
                    sendChannel(channel, result[0].channelid, result[0].classification.split(' ')[0], result[0].role, result[0].role_write, result[0].role_manage, result[0].autofetch)
                } else {
                    sendChannel(channel, channel.parentID, null, null, null, null, 1)
                }
            })
        } else if (channel.type === 4) {
            sendChannel(channel, 'isparent', null, null, null, null, 1)
        }
        function sendChannel(channel, parent, classification, role, write, manage, fetch) {
            let nsfw = 0
            let lastmessage = ''
            if (parent === 'isparent' || (channel !== undefined && channel.nsfw === 0)) {
                nsfw = 0
            } else if (channel.nsfw === true) {
                nsfw = 1
            } else {
                nsfw = 0
            }
            if (parent === 'isparent') {
                lastmessage = '0'
            } else {
                lastmessage = channel.lastMessageID
            }
            let topic = null
            if (channel.topic) {
                topic = channel.topic;
            }
            db.safe(`INSERT IGNORE INTO kanmi_channels SET source = 0, channelid = ?, serverid = ?, position = ?, name = ?, short_name = ?, parent = ?, classification = ?, nsfw = ?, role = ?, role_write = ?, role_manage = ?, description = ?, autofetch = ?`, [channel.id, channel.guild.id, channel.position, channel.name, channel.name.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '').trim(), parent, classification, nsfw, role, write, manage, topic, fetch], function (err, result) {
                if (err) {
                    SendMessage("SQL Error occurred when writing the channel to the database", "err", 'main', "SQL", err)
                }
            })
        }
    }
    function channelDelete(channel) {
        db.safe(`DELETE FROM kanmi_channels WHERE channelid = ? AND source = 0`, [channel.id], function (err, result) {
            if (err) {
                SendMessage("SQL Error occurred when erasing the channel to the database", "err", 'main', "SQL", err)
            }
        })
        db.safe(`SELECT id FROM kanmi_records WHERE channel  = ? AND source = 0`, [channel.id], function (err, result) {
            if (err) {
                SendMessage("SQL Error occurred when gettings messages from channel to be deleted", "err", 'main', "SQL", err)
            } else if (result && result.length > 0) {
                Logger.printLine('MessageDB', `Deleting messages for channel ${channel.id}...`, 'debug')
                result.forEach((message) => {
                    db.safe(`DELETE FROM kanmi_records WHERE id = ? AND source = 0`, [message.id], function (err, result) {
                        if (err) {
                            SendMessage("SQL Error occurred when deleting messages from channel to be deleted", "err", 'main', "SQL", err)
                        }
                    })
                })
            }
        })
    }
    function channelUpdate(channel) {
        if (channel && channel.type === 0) {
            if (channel.parentID) {
                db.safe(`SELECT role, role_write, role_manage FROM kanmi_channels WHERE ( channelid = ? AND role IS NULL ) AND source = 0 LIMIT 1`, [channel.id], function (err, result) {
                    if (!(err) && result && result.length === 1) {
                        db.safe(`SELECT channelid, role, role_write, role_manage FROM kanmi_channels WHERE ( channelid = ? AND parent = 'isparent' ) AND source = 0 LIMIT 1`, [channel.parentID], function (err, result) {
                            if (!(err) && result && result.length === 1 && result[0].classification !== null) {
                                sendChannel(channel, channel.parentID, channel.id, result[0].role, result[0].role_write, result[0].role_manage)
                            } else {
                                sendChannel(channel, channel.parentID, channel.id,  null, null, null)
                            }
                        })
                    } else {
                        sendChannel(channel, channel.parentID, channel.id, null, null, null)
                    }
                })
            } else {
                sendChannel(channel, channel.parentID, channel.id, null, null, null)
            }

        } else if (channel.type === 4) {
            sendChannel(channel, 'isparent', channel.id, null, null, null)
        }
        function sendChannel(channel, parent, channelid, role, write, manage) {
            let nsfw = 0
            let query = ''
            let values = []
            if (parent === 'isparent' || (channel !== undefined && channel.nsfw === 0)) {
                nsfw = 0
            } else if (channel.nsfw === true) {
                nsfw = 1
            } else {
                nsfw = 0
            }
            let topic = null
            if (channel.topic) {
                topic = channel.topic
            }
            if (role !== null && role.length > 0 && role[0] !== null) {
                query = `UPDATE kanmi_channels SET position = ?, name = ?, short_name = ?, parent = ?, nsfw = ?, role = ?, role_write = ?, role_manage = ?, description = ? WHERE channelid = ? AND source = 0`
                values = [channel.position, channel.name, channel.name.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '').trim(), parent, nsfw, role, write, manage, topic, channelid]
            } else {
                query = `UPDATE kanmi_channels SET position = ?, name = ?, short_name = ?, parent = ?, nsfw = ?, description = ? WHERE channelid = ? AND source = 0`
                values = [channel.position, channel.name, channel.name.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '').trim(), parent, nsfw, topic, channelid]
            }

            db.safe(query, values, function (err, result) {
                if (err) {
                    SendMessage("SQL Error occurred when updating the channel in the database", "err", 'main', "SQL", err)
                }
            })
        }
    }
    // Discord Events - Guild
    function guildEmojiUpdate(guild, emojiArray) {
        db.safe(`SELECT * FROM discord_reactions WHERE serverid = ?`, [guild.id], (err, discordreact) => {
            const emojis = emojiArray.filter(e => discordreact.filter(f => f.serverid === guild.id && f.reaction_custom === `${e.name}${(e.require_colons) ? ':' + e.id : ''}` || f.reaction_name === e.name).length === 0).map(e => `${e.name}${(e.require_colons) ? ':' + e.id : ''}`)
            let length = 0;
            let printList = [];
            let _printList = [];
            emojis.forEach((e, i) => {
                if (length + e.length + 2 <= 1900) {
                    _printList.push(e);
                    length += e.length + 2
                } else {
                    printList.push(_printList.join("\n"));
                    _printList = [];
                    length = 0;
                }
            })
            if (_printList.length > 0) {
                printList.push(_printList.join("\n"));
                _printList = [];
            }
            if (printList.length > 0) {
                printList.forEach((e, i) => {
                    if (i === 0) {
                        SendMessage(`Unregistered Emojis`, "info", guild.id, "GuildUpdate", e);
                    } else {
                        SendMessage(`...`, "info", guild.id, "GuildUpdate", e);
                    }
                })
            }
        });
    }


    Logger.printLine("Discord", "Settings up Discord Client...", "debug")
    const discordClient = new eris.CommandClient(systemglobal.Discord_Key, {
        compress: true,
        restMode: true,
        intents: [
            'guilds',
            'guildMembers',
            'guildBans',
            'guildEmojis',
            'guildIntegrations',
            'guildWebhooks',
            'guildInvites',
            'guildVoiceStates',
            'guildPresences',
            'guildMessages',
            'guildMessageReactions'
        ],
    }, {
        name: "Kanmi Framework with JuneFS/JuzoFS",
        description: (systemglobal.DiscordDescription) ? systemglobal.DiscordDescription : "Multi-Purpose Discord Framework and Filesystem",
        owner: (systemglobal.DiscordOwner) ?  systemglobal.DiscordOwner : "Yukimi Kazari",
        prefix: (systemglobal.DiscordPrefix) ? systemglobal.DiscordPrefix + " " : "juzo ",
        ignoreSelf: true,
        restMode: true,
    });

    // Discord Events - Listeners
    discordClient.on("ready", async () => {
        Logger.printLine("Discord", "Connected successfully to Discord!", "debug")
        discordClient.getSelf()
            .then(function(data) {
                selfstatic = data
                Logger.printLine("Discord", `Using Account: ${selfstatic.username} (${selfstatic.id})`, "debug")
                const gatewayURL = new URL(discordClient.gatewayURL);
                Logger.printLine("Discord", `Gateway: ${gatewayURL.host} using v${gatewayURL.searchParams.getAll('v').pop()}`, "debug")
            })
            .catch((er) => {
                Logger.printLine("Discord", "Error getting self identification, this is a major issue", "emergency", er)
                console.log(`${er.message}`.bgRed)
            });
        // Reset states to last values
        resetStates();
        if (init === 0) {
            if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
                setTimeout(() => {
                    request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                        if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                            console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                        }
                    })
                }, 5000)
                setTimeout(sendWatchdogPing, 60000);
            }
            discordClient.editStatus( "dnd",{
                name: 'Initializing System',
                type: 0
            })
            discordClient.getRESTGuilds()
                .then(async (guilds) => {
                    guilds.forEach(function (guild) {
                        discordClient.getRESTGuildChannels(guild.id.toString())
                            .then((channels) => {
                                channels.forEach(channel => {
                                    channelUpdate(channel)
                                })
                            })
                            .catch(function (e) {
                                SendMessage("Unable to get discord channel list", "error", 'main', "RefreshUser", e);
                                console.log(e);
                            })
                    })
                })
                .catch(function (e) {
                    SendMessage("Unable to get discord server list", "error", 'main', "RefreshUser", e);
                    console.log(e);
                })
            Logger.printLine("Discord", "Registering Commands", "debug")
            registerCommands();
            await reloadLocalCache();
            setInterval(reloadLocalCache, (systemglobal.Discord_Timer_Refresh) ? systemglobal.Discord_Timer_Refresh : 300000)
            await syncStatusValues();
            setInterval(syncStatusValues, 90000)
            resetInitStates();
            Logger.printLine("Discord", "Registering Scheduled Tasks", "debug")
            refreshCounts();
            setInterval(refreshCounts, (systemglobal.Discord_Timer_Counts) ? systemglobal.Discord_Timer_Counts : 900000)
            setTimeout(revalidateFiles, 60000)

            cron.schedule((systemglobal.Discord_Cron_Thread_Rollover) ? systemglobal.Discord_Cron_Thread_Rollover : '55 23 * * *', () => {
                cycleThreads(false);
            });
            cron.schedule('3 * * * *', () => {
                cycleThreads(true);
            });
            cron.schedule((systemglobal.Discord_Cron_Thread_Peak) ? systemglobal.Discord_Cron_Thread_Peak : '50 2 * * *', () => {
                addTimecodeMessage("Peak");
            });
            cron.schedule((systemglobal.Discord_Cron_Thread_Offpeak) ? systemglobal.Discord_Cron_Thread_Offpeak : '0 12 * * *', () => {
                addTimecodeMessage("Off Peak");
            });
            cycleThreads(true);
            init = 1
            setTimeout(start, 5000);
            setInterval(() => {
                const ap = Object.entries(discordClient.requestHandler.ratelimits).filter(e => e[1].remaining === 0 && e[1].processing !== false && e[0] !== '/users/@me/guilds')
                if (ap && ap.length === 0 && activeProccess === true) {
                    discordClient.editStatus( "idle",{
                        name: 'requests',
                        type: 2
                    });
                    activeProccess = false;
                } else if (activeProccess === true) {
                    discordClient.editStatus( "online", {
                        name: `${ap.length} requests`,
                        type: 0
                    });
                }
            }, 30000);
        }
    });
    discordClient.on("error", (err) => {
        Logger.printLine("Discord", `Discord Shard Error: ${err.message}\nReconnecting to Discord...`, "error", err)
        discordClient.connect()
    });

    discordClient.on("messageReactionAdd", (msg, emoji, user) => messageReactionAdd(msg, emoji, user));
    discordClient.on("messageReactionRemove", (msg, emoji, user) => messageReactionRemove(msg, emoji, (user.id) ? user.id : user));
    discordClient.on("messageReactionRemoveAll", (msg) => messageReactionRemoveAll(msg));

    discordClient.on("messageCreate", (msg) => messageCreate(msg));
    discordClient.on('messageUpdate', (msg) => messageUpdate(msg));
    discordClient.on("messageDelete", (msg) => { messageDelete(msg) });
    discordClient.on("messageDeleteBulk", (msg_array) => messageDeleteBulk(msg_array));

    discordClient.on("channelCreate", (channel) => channelCreate(channel));
    discordClient.on("channelDelete", (channel) => channelDelete(channel));
    discordClient.on("channelUpdate", (channel) => channelUpdate(channel));
    discordClient.on("threadUpdate", (channel) => threadUpdate(channel));

    discordClient.on("guildEmojisUpdate", (guild, emojiArray) => guildEmojiUpdate(guild, emojiArray));

    await discordClient.connect().catch((er) => { Logger.printLine("Discord", "Failed to connect to Discord", "emergency", er) });

    tx2.action('halt', async (reply) => {
        shutdownSystem((ok) => {
            reply({ answer : ok })
        })
    })
    tx2.action('overide-lock', async (reply) => {
        forceShutdown = true;
        reply({ answer : forceShutdown });
    })

    process.on('SIGINT', function() {
        shutdownSystem((ok) => {
            process.exit(0)
        })
    })
    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err)
        console.log(err)
        setInterval(() => {
            const activeProccessing = Object.entries(discordClient.requestHandler.ratelimits).filter(e => e[1].remaining === 0 && e[1].processing !== false && e[0] !== '/users/@me/guilds').length
            if (activeProccessing && activeProccessing > 0) {
                Logger.printLine("uncaughtException", `Reboot blocked, Processing ${activeProccessing} Actions`, "critical", err)
            } else {
                process.exit(1)
            }
        }, 5000);
    });
})();
