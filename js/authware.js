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

(async () => {
    let systemglobal = require('../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Discord-AuthWare';

    const eris = require('eris');
    const crypto = require("crypto");
    const request = require('request').defaults({ encoding: null });
    const moment = require('moment');
    const minimist = require("minimist");
    let args = minimist(process.argv.slice(2));
    let tfa = require('2fa');

    let authorizedUsers = new Map();
    let sudoUsers = new Map();
    let botUsers = new Map();
    let discordServers = new Map();
    let registeredServers = new Map();

    let discordperms;
    let discordservers;
    let discordreactionsroles;
    let reactionmessages
    let staticChID = {};
    let pendingRequests = new Map();

    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);
    const { removeItemAll } = require('./utils/tools');

    let init = 0

    Logger.printLine("Init", "Discord AuthWare", "info")

    // Load Enviorment Varibles
    if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
        systemglobal.MQServer = process.env.MQ_HOST.trim()
    if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
        systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
    if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
        systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

    // Shutaura SQL Cache
    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'authware' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.AuthwareUser])
        if (_systemparams.error) { Logger.printLine("SQL", "Error getting system parameter records!", "emergency", _systemparams.error); return false }
        const systemparams_sql = _systemparams.rows.reverse();

        if (systemparams_sql.length > 0) {
            const _discord_account = systemparams_sql.filter(e => e.param_key === 'authware.login');
            if (_discord_account.length > 0 && _discord_account[0].param_value) {
                systemglobal.Authware_Key = _discord_account[0].param_value
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
            const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
            if (_home_guild.length > 0 && _home_guild[0].param_value) {
                systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
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
            const _discord_refresh_cache = systemparams_sql.filter(e => e.param_key === 'discord.timers');
            if (_discord_refresh_cache.length > 0 && _discord_refresh_cache[0].param_data) {
                if (_discord_refresh_cache[0].param_data.refresh_sql_cache) {
                    const _rtimer = parseInt(__discord_refresh_cache[0].param_data.refresh_sql_cache.toString());
                    if (!isNaN(_rtimer) && _rtimer >= 5) {
                        systemglobal.Discord_Timer_SQLCache = _rtimer * 60000;
                    }
                }
            }
        }

        Logger.printLine("SQL", "Getting Discord Servers", "debug")
        const _discordservers = await db.query(`SELECT * FROM discord_servers`)
        if (_discordservers.error) { Logger.printLine("SQL", "Error getting discord servers records!", "emergency", _discordservers.error); return false }
        discordservers = _discordservers.rows;

        Logger.printLine("SQL", "Getting Discord Permissions", "debug")
        const _discordperms = await db.query(`SELECT * FROM discord_permissons WHERE name = 'sysbot' OR name = 'system_admin' OR name = 'system_interact'`)
        if (_discordperms.error) { Logger.printLine("SQL", "Error getting discord permissons records!", "emergency", _discordperms.error); return false }
        discordperms = _discordperms.rows;

        Logger.printLine("SQL", "Getting Discord Reaction Map", "debug")
        const _discordreactionsroles = await db.query(`SELECT * FROM discord_permissons_reactions`)
        if (_discordreactionsroles.error) { Logger.printLine("SQL", "Error getting discord permissons records!", "emergency", _discordreactionsroles.error); return false }
        discordreactionsroles = _discordreactionsroles.rows;
        reactionmessages = discordreactionsroles.map(e => e.message)

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
    await loadDatabaseCache();
    if (args.whost) {
        systemglobal.Watchdog_Host = args.whost
    }
    if (args.wid) {
        systemglobal.Watchdog_ID = args.wid
    }
    console.log(systemglobal)

    Logger.printLine("Discord", "Settings up Discord bot", "debug")
    const discordClient = new eris.CommandClient(systemglobal.Authware_Key, {
        compress: true,
        restMode: true,
        intents: [
            'guilds',
            'guildMembers',
            'guildBans',
            'guildIntegrations',
            'guildInvites',
            'guildPresences',
            'guildMessages',
            'guildMessageReactions',
        ],
    }, {
        name: "AuthWare",
        description: (systemglobal.DiscordDescription) ? systemglobal.DiscordDescription : "Authentication Framework for Sequenzia enabled servers",
        owner: (systemglobal.DiscordOwner) ? systemglobal.DiscordOwner : "Unset",
        prefix: (systemglobal.DiscordPrefix) ? systemglobal.DiscordPrefix + " " : "!authware ",
        restMode: true,
    });

    function isAuthorizedUser(permission, userid, guildid, channelid) {
        let action = false;
        let systemchannelid = '';
        if (staticChID[guildid] && staticChID[guildid].System)
            systemchannelid = staticChID[guildid].System

        //console.log(`${permission} ${userid} ${guildid} ${channelid}`)

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
                        action = false;
                    }
                } else {
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
                sendto = staticChID.homeGuild.System
            } else if (channel === "info") {
                sendto = staticChID.homeGuild.AlrmInfo
            } else if (channel === "warn") {
                sendto = staticChID.homeGuild.AlrmWarn
            } else if (channel === "err") {
                sendto = staticChID.homeGuild.AlrmErr
            } else if (channel === "crit") {
                sendto = staticChID.homeGuild.AlrmCrit
            } else if (channel === "message") {
                sendto = staticChID.homeGuild.AlrmNotif
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
            db.safe(`SELECT * FROM discord_servers WHERE serverid = ?`, [guild], function (err, serverdata) {
                if (err) {

                } else {
                    if (channel === "system") {
                        sendto = serverdata[0].chid_system
                    } else if (channel === "info") {
                        sendto = serverdata[0].chid_msg_info
                    } else if (channel === "warn") {
                        sendto = serverdata[0].chid_msg_warn
                    } else if (channel === "err") {
                        sendto = serverdata[0].chid_msg_err
                    } else if (channel === "crit") {
                        sendto = serverdata[0].chid_msg_crit
                    } else if (channel === "message") {
                        sendto = serverdata[0].chid_msg_notif
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
            })
        }
    }
    function registerCommands() {
        discordClient.registerCommand("sudo", async function (msg,args) {
            if (isAuthorizedUser('elevateAllowed', msg.member.id, msg.member.guild.id, msg.channel.id)) {
                const perms = await db.query(`SELECT role, server FROM discord_permissons WHERE name = 'syselevated'`);
                const users = await db.query(`SELECT 2fa_key FROM discord_users WHERE id = ? ORDER BY 2fa_key`, [msg.member.id]);

                if (perms.error) { return "SQL Error occurred when retrieving the user permissions data" }
                if (users.error) { return "SQL Error occurred when retrieving the user data" }

                function elevateUser(action) {
                    perms.rows.forEach((server) => {
                        discordClient.getRESTGuildMember(server.server, msg.member.id)
                            .then(function (member) {
                                switch (action) {
                                    case 'drop':
                                        const _userDroped = removeItemAll(member.roles, [server.role]);
                                        discordClient.editGuildMember(server.server, member.id, { roles: _userDroped, }, "User Elevation Dropped")
                                            //.then(function (result){ SendMessage(`🔒 Returned to User Mode in ${member.guild.name}`, msg.channel.id, msg.member.guild.id, "SystemMgr") })
                                            .catch((er) => { Logger.printLine("Discord", "Error when trying to edit user account information for elevation", "error", er) })
                                        break;
                                    case 'elevate':
                                        const _newUserRoles = member.roles.slice();
                                        let newmode = 'Unknown'
                                        if (msg.channel.id === staticChID.homeGuild.System) {
                                            _newUserRoles.push(server.role);
                                            newmode = 'Administrator'
                                        }
                                        discordClient.editGuildMember(server.server, member.id, { roles: _newUserRoles, }, "User Permissions Elevated")
                                            //.then(function (result){ SendMessage(`🔓 Entered ${newmode} Mode in ${member.guild.name}`, msg.channel.id, msg.member.guild.id, "SystemMgr") })
                                            .catch((er) => { Logger.printLine("Discord", "Error when trying to edit user account information for elevation", "error", er) })
                                        break;
                                    default:
                                        break;
                                }

                            })
                            .catch((er) => {
                                if (er.message && er.message !== '716194461306191914') {
                                    Logger.printLine("Discord", "Error when trying to get user account information for elevation", "error", er)
                                }
                            })
                    })
                    discordClient.deleteMessage(msg.channel.id, msg.id)
                        .catch((er) => {
                            Logger.printLine("Discord", "Error when trying to delete the elevation command", "error", er)
                        })
                }

                const twofakey = users.rows.filter(e => e['2fa_key'] !== null).map(e => e['2fa_key']);
                if (args.length > 0 && args[0].trim() === 'exit') {
                    elevateUser('drop');
                } else if (users.rows.length > 0 && twofakey.length > 0 && args.length > 0) {
                    const validTOTP = tfa.verifyTOTP(twofakey[0], args[0].trim(), {
                        beforeDrift: 2,
                        afterDrift: 2,
                        drift: 4,
                        step: 30
                    });
                    if (validTOTP) {
                        elevateUser('elevate');
                    } else {
                        discordClient.deleteMessage(msg.channel.id, msg.id)
                            .catch((er) => {
                                Logger.printLine("Discord", "Error when trying to delete the elevation command", "error", er)
                            })
                        return "❌ Unable to elevate user account, Invalid or Expired 2FA code"
                    }
                } else if (users.rows.length > 0 && twofakey.length === 0) {
                    elevateUser('elevate');
                } else if (users.rows.length > 0 && twofakey.length > 0 && args.length === 0) {
                    return "❌ Unable to elevate user account, Missing 2FA code";
                } else {
                    return "❌ Unable to elevate user account, User is not found";
                }
            } else {
                return "❌ You are not allowed to elevate your account, this incident will be reported"
            }
        }, {
            argsRequired: false,
            caseInsensitive: true,
            description: "Enter Elevated Permissions Mode",
            fullDescription: "Allows you to elevate you to elevate your system permissions to make changed to the server or channels\n" +
                "   **exit** - Leave Elevation Mode",
            usage: "[exit] [2FA Code, if enabled]",
            guildOnly: true
        })
        discordClient.registerCommand("2fa", async function (msg,args) {
            if (isAuthorizedUser('elevateAllowed', msg.member.id, msg.member.guild.id, msg.channel.id)) {
                const users = await db.query(`SELECT 2fa_key FROM discord_users WHERE id = ? ORDER BY 2fa_key`, [msg.member.id]);
                if (users.error) { return "SQL Error occurred when retrieving the user data" }

                const twofakey = users.rows.filter(e => e['2fa_key'] !== null).map(e => e['2fa_key']);
                switch (args[0]) {
                    case 'setup':
                        if (users.rows.length > 0 && twofakey.length === 0) {
                            tfa.generateKey(32, function(err, key) {
                                if (err) { SendMessage(`❌ Failed to generate a 2FA key - ${err.message}`, msg.channel.id, msg.member.guild.id, "SystemMgr"); }
                                tfa.generateGoogleQR('AuthWare', `${msg.member.username}#${msg.member.discriminator}`, key, function (err, qr) {
                                    if (err) { SendMessage(`❌ Failed to generate a 2FA QR Code image - ${err.message}`, msg.channel.id, msg.member.guild.id, "SystemMgr"); }
                                    discordClient.createMessage(msg.channel.id, '2FA Enabled for AuthWare, Delete this message after setup', {
                                        name: '2fa-login-key.png',
                                        file: Buffer.from(qr.replace('data:image/png;base64,', ''), 'base64')
                                    })
                                        .then(async completed => {
                                            const addkey = await db.query(`UPDATE discord_users SET 2fa_key = ? WHERE id = ?`,[key, msg.member.id]);
                                            if (addkey.error) { SendMessage("❌ Failed to save 2FA key to user account, disregard last message", msg.channel.id, msg.member.guild.id, "SystemMgr"); }
                                        })
                                        .catch(err => {
                                            console.error(err)
                                            return "❌ Failed to deliver 2FA codes, 2FA setup aborted"
                                        })
                                })
                            })
                        } else if (users.rows.length > 0 && twofakey.length > 0) {
                            return "❌ User has already setup 2FA"
                        } else {
                            return "❓ User does not exist in AuthWare"
                        }
                        break;
                    default:
                        break;
                }
            } else {
                return "❌ You are not allowed to elevate your account, this incident will be reported";
            }
        }, {
            argsRequired: true,
            caseInsensitive: true,
            description: "Setup 2FA Code Login for AuthWare",
            fullDescription: "Allows you to enable 2FA code to elevate user account via console, protects against client hijacking\n" +
                "   **setup** - Generates a 2FA key and QR code\n\n**To Disable you must clear the 2FA Key field in the database to prove that you have physical access**",
            usage: "[setup]",
            guildOnly: true
        })
    }
    async function updateLocalCache() {
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

            const _updateServer = await db.query('UPDATE discord_servers SET avatar = ?, name = ? WHERE serverid = ? AND authware_enabled = 1', [guild.icon, guild.name, guild.id])
            if (_updateServer.error) {
                SendMessage(`Error updating server info for ${guild.name}!`, "warning", 'main', "SQL", _updateServer.error)
            }
        }))
    }
    async function reactionAdded(msg, emoji, user) {
        const userID = (user.id) ? user.id : user
        if (userID !== discordClient.user.id) {
            if (reactionmessages.indexOf(msg.id) !== -1) {
                const data = discordreactionsroles.filter(e => e.message === msg.id && e.emoji === emoji.name).pop()
                if (data) {
                    try {
                        const member = await discordClient.getRESTGuildMember(msg.guildID, userID);
                        if (member.roles.indexOf(data.role) === -1) {
                            if (data.approval === 1) {
                                try {
                                    const reqMsg = await discordClient.createMessage(staticChID.homeGuild.AlrmNotif, `🛎 User ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name} is requesting permission "${(data.name) ? data.name : data.role}"`);
                                    if (reqMsg && reqMsg.id) {
                                        pendingRequests.set(reqMsg.id, {
                                            data,
                                            server: member.guild.id,
                                            user: userID
                                        })
                                        await discordClient.addMessageReaction(reqMsg.channel.id, reqMsg.id, '✅');
                                        await discordClient.addMessageReaction(reqMsg.channel.id, reqMsg.id, '❌');
                                    }
                                } catch (err) {
                                    Logger.printLine("UserRightsMgr", `Error when trying to send notification message for user rights to ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name}`, "error", err)
                                }
                            } else {
                                let _roles = member.roles.slice();
                                _roles.push(data.role);
                                discordClient.editGuildMember(member.guild.id, member.id, { roles: _roles, }, "User Granted Permission (Open Access)")
                                    .then(() => { SendMessage(`🔓 User ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name} was granted ${(data.name) ? data.name : data.role} permission`, "info", 'main', "UserRightsMgr") })
                                    .catch((er) => { Logger.printLine("UserRightsMgr", `Error when trying to grant user rights to ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name}`, "error", er) })
                            }
                        }
                    } catch (e) {
                        Logger.printLine("UserRightsMgr", `Error when trying to get user data for ${userID}`, "error", e)
                    }
                }
            } else if (pendingRequests.has(msg.id)) {
                const req = pendingRequests.get(msg.id);
                const data = req.data;
                if (emoji.name === '✅') {
                    const member = await discordClient.getRESTGuildMember(req.server, req.user);
                    if (member.roles.indexOf(data.role) === -1) {
                        let _roles = member.roles.slice();
                        _roles.push(data.role);
                        discordClient.editGuildMember(req.server, member.id, { roles: _roles, }, "User Granted Permission (Open Access)")
                            .then(async () => {
                                SendMessage(`🔓 User ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name} was granted ${(data.name) ? data.name : data.role} permission`, "info", 'main', "UserRightsMgr");
                                await discordClient.deleteMessage(msg.channel.id, msg.id, "Approved Request")
                                const userDirect = await discordClient.getRESTUser(member.id)
                                if (userDirect) {
                                    userDirect.getDMChannel().then(channel => {
                                        channel.createMessage(`Your request for ${(data.name) ? data.name : data.role} permission was granted!`)
                                            .catch((er) => {
                                                Logger.printLine("UserRightsMgr", `Not able to send direct message to ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name}`, "error", er)
                                            });
                                    });
                                }

                            })
                            .catch((er) => { Logger.printLine("UserRightsMgr", `Error when trying to grant user rights to ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name}`, "error", er) })
                    }
                } else if (emoji.name === '❌') {
                    await discordClient.deleteMessage(msg.channel.id, msg.id, "Declined Request")
                }
                pendingRequests.delete(msg.id)
            }
        }
    }
    async function reactionRemoved(msg, emoji, user) {
        const userID = (user.id) ? user.id : user
        if (userID !== discordClient.user.id) {
            if (reactionmessages.indexOf(msg.id) !== -1) {
                const data = discordreactionsroles.filter(e => e.message === msg.id && e.emoji === emoji.name).pop()
                if (data) {
                    const member = await discordClient.getRESTGuildMember(msg.guildID, userID);
                    if (member.roles.indexOf(data.role) !== -1) {
                        let _roles = removeItemAll(member.roles, [data.role]);
                        discordClient.editGuildMember(member.guild.id, member.id, {roles: _roles,}, "User Removed Permission (Open Access)")
                            .then(() => {
                                SendMessage(`🔓 User ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name} revoked ${(data.text) ? data.text : data.role} permission`, "info", 'main', "UserRightsMgr")
                            })
                            .catch((er) => {
                                Logger.printLine("UserRightsMgr", `Error when trying to grant user rights to ${(member.nick) ? member.nick : member.user.username} from ${member.guild.name}`, "error", er)
                            })
                    }
                }
            }
        }
    }

    // Discord Event Processor
    const stuTimerRegister = new Map();
    async function stuTimer(guild, member) {
        if (!stuTimerRegister.has('updateAccount-' + member.id + guild.id)) {
            stuTimerRegister.set('updateAccount-' + member.id + guild.id, setTimeout(async () => {
                await memberRoleGeneration(guild, member);
                clearTimeout(stuTimerRegister.get('updateAccount-' + member.id + guild.id))
                stuTimerRegister.delete('updateAccount-' + member.id + guild.id);
                Logger.printLine("stuAccountUpdate", `User ${member.id} account was updated`, "info")
            }, 15000))
        }
    }
    async function memberRoleGeneration(guild, member, dontUpdateAccount) {
        const serverPermissions = await db.query(`SELECT discord_permissons.* FROM discord_servers, discord_permissons WHERE discord_servers.authware_enabled = 1 AND discord_servers.serverid = ? AND discord_servers.serverid = discord_permissons.server`, [guild.id]);
        const userExits = await db.query(`SELECT * FROM discord_users WHERE discord_users.serveruserid = ?`, [member.user.id + guild.id]);
        if (serverPermissions && serverPermissions.rows.length > 0) {
            await db.query(`DELETE FROM discord_users_permissons WHERE userid = ? AND serverid = ?`, [member.user.id, guild.id]);

            const ignoredPermissions = ['sysbot']
            for (const role of serverPermissions.rows.filter(e => e.name && member.roles.indexOf(e.role) !== -1 && ignoredPermissions.indexOf(e.name) === -1)) {
                let type = null;
                let roleName = role.name.trim();
                let roleText = role.text.trim();
                let color = null;
                if (role.color !== null && role.color !== "0") {
                    color = "#" + Number(parseInt(role.color)).toString(16).padStart(2, '0')
                }
                if (role.name.includes('_read')) {
                    type = 1
                } else if (role.name.includes('_write')) {
                    type = 2
                } else if (role.name.includes('_manage')) {
                    type = 3
                } else if (role.name.includes('system_')) {
                    type = 4
                    roleName = role.name.replace('system_', '').trim();
                } else {
                    type = 0
                }
                await db.query(`INSERT INTO discord_users_permissons SET userid = ?, serverid = ?, color = ?, text = ?, role = ?, type = ?`, [member.user.id, guild.id, color, roleText, roleName, type]);
                if (roleName === 'user') {
                    await db.query(`INSERT INTO discord_users_permissons SET userid = ?, serverid = ?, color = ?, text = ?, role = ?, type = ?`, [member.user.id, guild.id, color, roleText, `${roleName}-${guild.id}`, type]);
                }
            }
        }
        const userRole = serverPermissions.rows.filter(e => e.name && e.name === 'system_user').map(e => e.role)
        const isUser = (member.roles.find(e => userRole.indexOf(e) !== -1))
        if (member.roles.length === 0 || !isUser) {
            if (userExits && userExits.rows.length > 0) {
                const deletedUsers = await db.query(`DELETE FROM discord_users WHERE serveruserid = ?`, [member.id + guild.id])
                if (deletedUsers && deletedUsers.rows.length > 0){
                    SendMessage(`User "${member.user.username}" rights have been revoked from the server`, "info", 'main', "Discord")
                }
            }
        } else {
            let username = (member.nick) ? member.nick : member.user.username;
            /*const banner = await new Promise(resolve => {
                request.get(`https://discord.com/api/v9/api/users/`, async (err, res) => {
                    if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                        console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                    }
                })
            })*/

            const user = await discordClient.getRESTUser(member.id)
            const updateUser = await db.query("INSERT INTO discord_users SET serveruserid = ?, id = ?, server = ?, username = ?, avatar = ?, banner = ?, color = ? ON DUPLICATE KEY UPDATE username = ?, avatar = ?, banner = ?, color = ?", [member.id + guild.id, member.id, guild.id, `${username}`, member.user.avatar, user.banner, user.accentColor, username, member.user.avatar, user.banner, user.accentColor])

            if (updateUser && updateUser.rows.length > 0) {
                memberTokenGeneration();
            }
        }
        if (!dontUpdateAccount)
            await sequenziaUserCacheGenerator(member.id);
    }
    async function memberRemoval(guild, member) {
        const userexsists = await db.query(`SELECT * FROM discord_users WHERE serveruserid = ?`,[member.user.id + guild.id])
        if (userexsists.rows.length > 0) {
            const userresults = await db.query(`DELETE FROM discord_users WHERE serveruserid = ?`, [member.user.id + guild.id])
            if (userresults.error) {
                SendMessage("SQL Error occurred when deleting a server user", "err", 'main', "SQL", userresults.error)
            } else {
                Logger.printLine('UserRightsMgr', `${member.user.username} was removed from the server`, 'info')
            }
        }
    }
    async function memberTokenGeneration() {
        const users = await db.query(`SELECT * FROM discord_users`)
        if (users.error) {
            SendMessage("SQL Error occurred when retrieving the users table", "err", 'main', "SQL", users.error)
        } else {
            await Promise.all(users.rows.map(async user => {
                let expires = new Date(user.token_expires)
                let now = new Date()
                let next_expires = moment(new Date()).add(20, 'days').format('YYYY-MM-DD HH:mm:ss');
                let token1 = crypto.randomBytes(512).toString("hex");
                let token2 = crypto.randomBytes(128).toString("hex");

                if (expires <= now) {
                    const updatedUser = await db.query('UPDATE discord_users SET token = ?, blind_token = ?, token_expires = ? WHERE id = ?', [token1, token2, next_expires, user.id])
                    if (updatedUser.error)
                        SendMessage("SQL Error occurred when updating user token", "err", 'main', "SQL", updatedUser.error)
                }
            }))
        }
    }
    async function guildRoleCreate(guild, role) {
        const addedRole = await db.query('INSERT INTO discord_permissons SET ? ON DUPLICATE KEY UPDATE ?', [{
            role: role.id,
            server: guild.id,
            color: role.color,
            text: role.name,
            name: null
        }, {
            color: role.color,
            text: role.name
        }])
        if (addedRole.error)
            SendMessage("SQL Error occurred when saving new role", "err", 'main', "SQL", addedRole.error)
    }
    async function guildRoleDelete(role) {
        const deletedRole = await db.query('DELETE FROM discord_permissons WHERE role = ?', [role.id])
        if (deletedRole.error)
            SendMessage("SQL Error occurred when deleting role", "err", 'main', "SQL", deletedRole.error)
    }

    let sequenziaAccountUpdateTimer = null;
    async function sequenziaUserCacheGenerator(thisUser) {
        if (sequenziaAccountUpdateTimer) {
            clearTimeout(sequenziaAccountUpdateTimer);
            sequenziaAccountUpdateTimer = null;
        }

        const authViewsqlFields = [
            'kanmi_channels.channelid',
            'kanmi_channels.cid AS channel_eid',
            'kanmi_channels.virtual_cid AS virtual_channel_eid',
            'discord_servers.serverid',
            'kanmi_channels.position',
            'discord_servers.short_name AS server_short_name',
            'discord_servers.avatar AS server_avatar',
            'kanmi_channels.name AS channel_name',
            'kanmi_channels.image_hash AS channel_image',
            'kanmi_channels.nice_title AS channel_title',
            'kanmi_channels.short_name AS channel_short_name',
            'kanmi_channels.nice_name AS channel_nice',
            'kanmi_channels.description AS channel_description',
            'kanmi_channels.nsfw AS channel_nsfw',
            'kanmi_channels.uri AS channel_uri',
            'kanmi_channels.role',
            'kanmi_channels.role_write',
            'kanmi_channels.role_manage',
            'kanmi_channels.classification',
            'kanmi_channels.media_group',
            'sequenzia_class.name AS class_name',
            'sequenzia_class.icon AS class_icon',
        ].join(', ');
        const authViewsqlTables = [
            'kanmi_channels',
            'discord_servers',
            'sequenzia_class'
        ].join(', ');
        const authViewsqlWhere = [
            "(kanmi_channels.parent IS NOT NULL AND kanmi_channels.parent != 'isparent' || kanmi_channels.parent IS NULL)",
            'kanmi_channels.classification = sequenzia_class.class',
            'kanmi_channels.serverid = discord_servers.serverid'
        ].join(' AND ');
        const sidebarViewsqlOrderBy = [
            'x.super_position',
            'x.class_position',
            `x.server_position`,
            `x.virtual_channel_eid`,
            `x.position`,
        ].join(', ');

        const allUsers = (await db.query(`SELECT x.* FROM (SELECT * FROM discord_users) x LEFT JOIN (SELECT discord_servers.position, discord_servers.authware_enabled, discord_servers.name, discord_servers.serverid FROM discord_servers) y ON x.server = y.serverid ORDER BY y.authware_enabled, y.position, x.id`)).rows
        const allUserIds = [...new Set(allUsers.map(e => e.id))];
        const extraLinks = (await db.query(`SELECT * FROM sequenzia_homelinks ORDER BY position`)).rows
        const allUserPermissions = (await db.query("SELECT DISTINCT role, type, userid, color, text, serverid FROM discord_users_permissons")).rows
        const allChannels = (await db.query("SELECT x.*, y.chid_download FROM ( SELECT DISTINCT kanmi_channels.channelid, kanmi_channels.serverid, kanmi_channels.role, kanmi_channels.role_write, kanmi_channels.role_manage FROM kanmi_channels, sequenzia_class WHERE kanmi_channels.role IS NOT NULL AND kanmi_channels.classification = sequenzia_class.class) x LEFT OUTER JOIN (SELECT chid_download, serverid FROM discord_servers) y ON (x.serverid = y.serverid AND x.channelid = y.chid_download)")).rows;
        const allDisabledChannels = (await db.query(`SELECT DISTINCT user, cid FROM sequenzia_hidden_channels`)).rows
        const allServers = (await db.query(`SELECT x.total_data, total_count, y.* FROM (SELECT SUM(filesize) AS total_data, COUNT(filesize) AS total_count, server FROM kanmi_records WHERE fileid is not null OR attachment_hash is not null GROUP BY server) x LEFT JOIN (SELECT DISTINCT * FROM discord_servers) y ON x.server = y.serverid  ORDER BY position`)).rows;


        let _server_list = allServers.map(e => {
            return {
                serverid: e.serverid,
                name: e.name,
                nice_name: e.nice_name,
                short_name: e.short_name,
                icon: `https://cdn.discordapp.com/icons/${e.serverid}/${e.avatar}.png?size=4096`,
                login: (e.authware_enabled),
                usage: e.total_data,
                count: e.total_count
            }
        });
        let homeLinks = extraLinks.map(link => {
            return {
                title: link.name,
                icon: (link.icon !== url) ? link.icon : undefined,
                url: link.url
            }
        })

        allUserIds.filter(f => !thisUser || (thisUser && f === thisUser)).map(async userId => {
            const sidebarViewsqlFields = [
                `kanmi_auth_${userId}.channelid`,
                `kanmi_auth_${userId}.channel_eid`,
                `kanmi_auth_${userId}.virtual_channel_eid`,
                'discord_servers.serverid',
                `kanmi_auth_${userId}.position`,
                'sequenzia_superclass.position AS super_position',
                'sequenzia_superclass.super',
                'sequenzia_superclass.name AS super_name',
                'sequenzia_superclass.icon AS super_icon',
                'sequenzia_superclass.uri AS super_uri',
                'sequenzia_class.uri AS class_uri',
                'sequenzia_class.position AS class_position',
                'sequenzia_class.class',
                'sequenzia_class.name AS class_name',
                'sequenzia_class.icon AS class_icon',
                `kanmi_auth_${userId}.channel_nsfw`,
                `kanmi_auth_${userId}.channel_name`,
                `kanmi_auth_${userId}.channel_image`,
                `kanmi_auth_${userId}.channel_title`,
                `kanmi_auth_${userId}.channel_short_name`,
                `kanmi_auth_${userId}.channel_nice`,
                `kanmi_auth_${userId}.channel_description`,
                `kanmi_auth_${userId}.channel_uri`,
                `discord_servers.position AS server_position`,
                'discord_servers.name AS server_name',
                'discord_servers.nice_name AS server_nice',
                'discord_servers.short_name AS server_short',
                'discord_servers.avatar AS server_avatar',
                `kanmi_auth_${userId}.role_write`,
                `kanmi_auth_${userId}.role_manage`,
            ].join(', ');
            const sidebarViewsqlTables = [
                'discord_servers',
                'sequenzia_superclass',
                'sequenzia_class',
                `kanmi_auth_${userId}`,
            ].join(', ');
            const sidebarViewsqlWhere = [
                `kanmi_auth_${userId}.classification IS NOT NULL`,
                `kanmi_auth_${userId}.classification = sequenzia_class.class`,
                `kanmi_auth_${userId}.serverid = discord_servers.serverid`,
                'sequenzia_class.class IS NOT NULL',
                'sequenzia_class.super = sequenzia_superclass.super',
            ].join(' AND ');

            const users = allUsers.filter(e => userId === e.id);
            const userPermissions = allDisabledChannels.filter(e => e.userid === userId);
            const disabledChannels = allUserPermissions.filter(e => e.user === userId);

            const readPermissionsRows = userPermissions.filter(e => e.type === 1);
            const writePermissionsRows = userPermissions.filter(e => e.type === 2);
            const managePermissionsRows = userPermissions.filter(e => e.type === 3);
            const specialPermissionsRows = userPermissions.filter(e => e.type === 4);

            const readPermissions = readPermissionsRows.map(e => e.role);
            const writePermissions = writePermissionsRows.map(e => e.role);
            const managePermissions = managePermissionsRows.map(e => e.role);
            const specialPermissions = specialPermissionsRows.map(e => e.role);

            let userAccount = {
                discord: {
                    user: {
                        userId,
                        server: _server_list.filter(e => e.serverid === users[0].server),
                        name: users[0].nice_name,
                        username: users[0].username,
                        avatar: users[0].avatar,
                        banner: users[0].banner,
                        known: true,
                        membership: {
                            text: 'Member'
                        },
                        auth_token: null,
                        token: users[0].token,
                        token_login: users[0].blind_token,
                        token_static: users[0].token_static,
                        token_rotation: users[0].token_expires
                    },
                    permissions: {
                        read: readPermissions,
                        write: writePermissions,
                        manage: managePermissions,
                        specialPermissions: specialPermissions
                    },
                    channels: {
                        read: [],
                        write: [],
                        manage: [],
                    },
                    servers: {
                        download: [],
                        list: _server_list
                    },
                    links: homeLinks
                },
                server_list: [],
                cache: {
                    channels_view: `kanmi_auth_${userId}`,
                    sidebar_view: `kanmi_sidebar_${userId}`
                },
                kongou_next_episode: {},
                disabled_channels: (disabledChannels) ? disabledChannels.map(e => e.cid) : [],
                blind_token_expires: users[0].token_expires,
            };

            if (webconfig.user_card_membership) {
                const _ms = await webconfig.user_card_membership.filter(m => (readPermissions.indexOf(m.role) !== -1 || writePermissions.indexOf(m.role) !== -1 || specialPermissions.indexOf(m.role) !== -1)).map(e => {
                    return {
                        text: (e.text) ? e.text : (readPermissions.indexOf(e.role) !== -1 && readPermissionsRows[readPermissions.indexOf(e.role)].text) ? readPermissionsRows[readPermissions.indexOf(e.role)].text : (writePermissions.indexOf(e.role) !== -1 && writePermissionsRows[writePermissions.indexOf(e.role)].text) ? writePermissionsRows[writePermissions.indexOf(e.role)].text : (specialPermissions.indexOf(e.role) !== -1 && specialPermissionsRows[specialPermissions.indexOf(e.role)].text) ? specialPermissionsRows[specialPermissions.indexOf(e.role)].text : undefined,
                        background: (e.background) ? e.background : (readPermissions.indexOf(e.role) !== -1 && readPermissionsRows[readPermissions.indexOf(e.role)].color) ? readPermissionsRows[readPermissions.indexOf(e.role)].color : (writePermissions.indexOf(e.role) !== -1 && writePermissionsRows[writePermissions.indexOf(e.role)].color) ? writePermissionsRows[writePermissions.indexOf(e.role)].color : (specialPermissions.indexOf(e.role) !== -1 && specialPermissionsRows[specialPermissions.indexOf(e.role)].color) ? specialPermissionsRows[specialPermissions.indexOf(e.role)].color : undefined,
                        ...e
                    }
                })
                if (_ms.length > 0) {
                    userAccount.discord.user.membership = {
                        ...userAccount.discord.user.membership,
                        ..._ms.pop()
                    }
                }
            }

            await allChannels.forEach(u => {
                if (readPermissions.indexOf(u.role) !== -1 || specialPermissions.indexOf(u.role) !== -1)
                    userAccount.discord.channels.read.push(u.channelid)
                if (writePermissions.indexOf(u.role_write) !== -1 || managePermissions.indexOf(u.role_write) !== -1 || specialPermissions.indexOf(u.role_write) !== -1) {
                    userAccount.discord.channels.write.push(u.channelid)
                    if (u.chid_download !== null) {
                        userAccount.discord.servers.download.push({
                            serverid: u.serverid,
                            channelid: u.chid_download
                        });
                    }
                }
                if (managePermissions.indexOf(u.role_manage) !== -1 || specialPermissions.indexOf(u.role_manage) !== -1)
                    userAccount.discord.channels.manage.push(u.channelid);
            })


            await db.query(`CREATE OR REPLACE VIEW kanmi_auth_${userId} AS SELECT x.*, y.virtual_channel_name, y.virtual_channel_description, y.virtual_channel_uri FROM (SELECT x.* FROM (SELECT DISTINCT role FROM discord_users_permissons WHERE userid = '${userId}') z LEFT JOIN (SELECT DISTINCT ${authViewsqlFields} FROM ${authViewsqlTables} WHERE (${authViewsqlWhere}) ) x ON (x.role = z.role)) x LEFT OUTER JOIN (SELECT virtual_cid AS virtual_channel_eid, name AS virtual_channel_name, description AS virtual_channel_description, uri AS virtual_channel_uri FROM kanmi_virtual_channels) y ON (x.virtual_channel_eid = y.virtual_channel_eid) ORDER BY x.position`)
            await db.query(`CREATE OR REPLACE VIEW kanmi_sidebar_${userId} AS SELECT x.*, y.virtual_channel_name, y.virtual_channel_uri, y.virtual_channel_description FROM (SELECT ${sidebarViewsqlFields} FROM ${sidebarViewsqlTables} WHERE ${sidebarViewsqlWhere}) x LEFT OUTER JOIN (SELECT virtual_cid AS virtual_channel_eid, name AS virtual_channel_name, uri AS virtual_channel_uri, description AS virtual_channel_description FROM kanmi_virtual_channels) y ON (x.virtual_channel_eid = y.virtual_channel_eid) ORDER BY ${sidebarViewsqlOrderBy}`);
            const tempLastEpisode = await db.query(`SELECT Max(y.eid) AS eid, MAX(y.show_id) AS show_id FROM (SELECT * FROM kanmi_system.kongou_watch_history WHERE user = '${userId}' ORDER BY date DESC LIMIT 1) x LEFT JOIN (SELECT * FROM kanmi_system.kongou_episodes) y ON (x.eid = y.eid);`)

            if (tempLastEpisode.rows.length > 0) {
                const nextEpisodeView = await db.query(`SELECT * FROM  (SELECT * FROM kanmi_system.kongou_episodes WHERE eid > ${tempLastEpisode.rows[0].eid} AND show_id = ${tempLastEpisode.rows[0].show_id} AND season_num > 0 ORDER BY season_num ASC, episode_num ASC LIMIT 1) x LEFT JOIN (SELECT * FROM kanmi_system.kongou_shows) y ON (x.show_id = y.show_id);`)
                console.log(nextEpisodeView.rows)
                userAccount.kongou_next_episode = nextEpisodeView.rows[0];
            }

            const serverResults = await db.query(`SELECT DISTINCT kanmi_sidebar_${userId}.serverid, kanmi_sidebar_${userId}.server_nice, kanmi_sidebar_${userId}.server_name, kanmi_sidebar_${userId}.server_short, discord_servers.position, discord_servers.authware_enabled FROM kanmi_sidebar_${userId}, discord_servers WHERE kanmi_sidebar_${userId}.serverid = discord_servers.serverid ORDER BY discord_servers.position`);
            userAccount.server_list = serverResults.rows.map((e) => ({
                id: e.serverid,
                name: (e.server_nice) ? e.server_nice : e.server_name,
                short_name: e.server_short.toUpperCase(),
                login: (e.authware_enabled)
            }));

            await db.query(`INSERT INTO  sequenzia_user_cache SET ? ON DUPLICATE KEY UPDATE ?`, [
                { userid: userId, data: JSON.stringify(userAccount) }, { data: JSON.stringify(userAccount) }
            ])
        });

        if (!thisUser) {
            sequenziaAccountUpdateTimer = setTimeout(sequenziaUserCacheGenerator, (thisUser) ? 900000 : 1500000);
        }
    }

    if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
        request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
            if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
            }
        })
        setInterval(() => {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/ping?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
        }, 60000)
    }

    // Discord Event Listeners
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
            Logger.printLine("Discord", "Registering Commands", "debug")
            registerCommands();
            memberTokenGeneration();
            init = 1
            setInterval(() => { updateLocalCache() }, 300000)
        }
        setInterval(memberTokenGeneration, 3600000);
        setTimeout(() => {
            discordClient.editStatus( "online", null);
            if (process.send && typeof process.send === 'function') {
                process.send('ready');
            }
        }, 60000);
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

            await Promise.all(Array.from(guild.roles.keys()).map(async (roleID) => {
                const role = guild.roles.get(roleID)
                await guildRoleCreate(guild, role);
            }))
            await Promise.all(Array.from(guild.members.keys()).map(async (memberID) => {
                const member = guild.members.get(memberID)
                await memberRoleGeneration(guild, member, true);
            }))
        }))
        await updateLocalCache();
        await sequenziaUserCacheGenerator();
    });
    discordClient.on("error", (err) => {
        Logger.printLine("Discord", "Shard Error, Rebooting...", "error", err);
        console.error(err);
        discordClient.connect();
    });

    discordClient.on("messageReactionAdd", (msg, emoji, user) => reactionAdded(msg, emoji, user));
    discordClient.on("messageReactionRemove", (msg, emoji, user) => reactionRemoved(msg, emoji, (user.id) ? user.id : user));

    discordClient.on("guildMemberAdd", async (guild, member) => { await stuTimer(guild, member) })
    discordClient.on("guildMemberUpdate", async (guild, member) => { await stuTimer(guild, member) })
    discordClient.on("guildMemberRemove", async (guild, member) => { await memberRemoval(guild, member) })

    discordClient.on('guildRoleUpdate', async (guild, role) => { await guildRoleCreate(guild, role) })
    discordClient.on('guildRoleDelete', async (role) => { await guildRoleDelete(role) })

    discordClient.connect().catch((er) => { Logger.printLine("Discord", "Failed to connect to Discord", "emergency", er) });

    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err)
        console.log(err)
        discordClient.editStatus( "dnd", {
            name: 'System Failure',
            type: 0
        })
        setTimeout(function() {
            process.exit(1)
        }, 3000)
    });
})()
