// noinspection ES6MissingAwait

/*    ___                  __                        _______ __
     /   | _________ _____/ /__  ____ ___  __  __   / ____(_) /___  __
    / /| |/ ___/ __ `/ __  / _ \/ __ `__ \/ / / /  / /   / / __/ / / /
   / ___ / /__/ /_/ / /_/ /  __/ / / / / / /_/ /  / /___/ / /_/ /_/ /
  /_/  |_\___/\__,_/\__,_/\___/_/ /_/ /_/\__, /   \____/_/\__/\__, /
                                        /____/               /____/
Developed at Academy City Research
"Developing a better automated future"
======================================================================================
Kanmi Project - Pixiv I/O System
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
    const facilityName = 'Pixiv-Worker';

    const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
    const fs = require('fs');
    const sharp = require('sharp');
    const sizeOf = require('image-size');
    const colors = require('colors');
    const moment = require('moment');
    const amqp = require('amqplib/callback_api');
    let amqpConn = null;
    const PixivApi = require('pixiv-api-client');
    const request = require('request').defaults({ encoding: null });
    const cron = require('node-cron');
    const minimist = require("minimist");
    let args = minimist(process.argv.slice(2));

    const { getIDfromText } = require('./utils/tools');
    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    Logger.printLine("Init", "Pixiv Actor/Processor", "debug")

    if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
        systemglobal.MQServer = process.env.MQ_HOST.trim()
    if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
        systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
    if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
        systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'pixiv' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.PixivUser])
        if (_systemparams.error) { Logger.printLine("SQL", "Error getting system parameter records!", "emergency", _systemparams.error); return false }
        const systemparams_sql = _systemparams.rows.reverse();

        if (systemparams_sql.length > 0) {
            const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
            if (_home_guild.length > 0 && _home_guild[0].param_value) {
                systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
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
            const _pixiv_config = systemparams_sql.filter(e => e.param_key === 'pixiv');
            if (_pixiv_config.length > 0 && _pixiv_config[0].param_data) {
                if (_pixiv_config[0].param_data.disable_history)
                    systemglobal.Pixiv_No_History = _pixiv_config[0].param_data.disable_history;
                if (_pixiv_config[0].param_data.cron_recomm_release)
                    systemglobal.Pixiv_Cron_Recommended = _pixiv_config[0].param_data.cron_recomm_release;
                if (_pixiv_config[0].param_data.add_time_to_posts)
                    systemglobal.Pixiv_Append_Time = _pixiv_config[0].param_data.add_time_to_posts;
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
            const _mq_pixiv_in = systemparams_sql.filter(e => e.param_key === 'mq.pixiv.in');
            if (_mq_pixiv_in.length > 0 && _mq_pixiv_in[0].param_value)
                systemglobal.Pixiv_In = _mq_pixiv_in[0].param_value;
        }
    }
    await loadDatabaseCache();
    console.log(systemglobal)
    if (args.whost) {
        systemglobal.Watchdog_Host = args.whost
    }
    if (args.wid) {
        systemglobal.Watchdog_ID = args.wid
    }

    const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`

    Logger.printLine("Pixiv", "Settings up Pixiv client", "debug")
    const pixivClient = new PixivApi();
    let auth = undefined

    const MQWorker1 = systemglobal.Pixiv_In

    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug")
    try {
        if (!fs.existsSync(systemglobal.TempFolder)) {
            fs.mkdirSync(systemglobal.TempFolder);
        }
    } catch (e) {
        console.error('Failed to create the temp folder, not a issue if your using docker');
        console.error(e);
    }

// Kanmi MQ Backend
    function startWorker() {
        amqpConn.createChannel(function(err, ch) {
            if (closeOnErr(err)) return;
            ch.on("error", function(err) {
                Logger.printLine("KanmiMQ", "Channel 1 Error", "error", err)
            });
            ch.on("close", function() {
                Logger.printLine("KanmiMQ", "Channel 1 Closed", "critical")
                start();
            });
            ch.prefetch(10);
            ch.assertQueue(MQWorker1, { durable: true }, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.consume(MQWorker1, processMsg, { noAck: false });
                Logger.printLine("KanmiMQ", "Channel 1 Worker Ready", "info")
            });
            ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
                if (closeOnErr(err)) return;
                ch.bindQueue(MQWorker1, "kanmi.exchange", MQWorker1, [], function(err, _ok) {
                    if (closeOnErr(err)) return;
                    Logger.printLine("KanmiMQ", "Channel 1 Worker Bound to Exchange", "debug")
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
    function work(msg, cb) {
        const MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
        doAction(MessageContents, cb);
    }
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
                return setTimeout(start, 1000);
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
    async function whenConnected() {
        startWorker();
        if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
        }
        await refreshToken((ok) => {
            if (ok) {
                Logger.printLine("TokenSystem", `Connected successfully to Pixiv as ${auth.user.name} (${auth.user.id})`, "debug")

                sleep(500).then(() => {
                    if (process.send && typeof process.send === 'function') {
                        process.send('ready');
                    }
                    Logger.printLine("Init", "Pixiv Client is ready!", "info")
                    if (auth) {
                        getNewIllust();
                        postRecommPost();
                        cron.schedule('*/5 * * * *', () => {
                            getNewIllust();
                        });
                        if (systemglobal.Pixiv_Cron_Recommended && cron.validate(systemglobal.Pixiv_Cron_Recommended.toString())) {
                            cron.schedule(systemglobal.Pixiv_Cron_Recommended.toString(), () => {
                                postRecommPost();
                            });
                        } else {
                            cron.schedule('*/10 * * * *', () => {
                                postRecommPost();
                            });
                        }
                    }
                })
            } else {
                Logger.printLine("Init", "Failed to login to pixiv! Halted Proccesses", "emergency")
                auth = false;
            }
        });
    }

// Pixiv Tasks
    async function refreshToken(cb) {
        const refreshtoken = await db.query(`SELECT * FROM pixiv_accounts WHERE paccount = ?`, [systemglobal.PixivUser]);
        if (refreshtoken.error || refreshtoken.rows.length === 0) {
            mqClient.sendMessage(`Pixiv Refresh Token was not found in the database, please generate/add a new token!`, "crit", "TokenSystem", (refreshtoken.error) ? refreshtoken.error.sqlMessage : "");
            if (refreshtoken.error) {
                console.error(refreshtoken.error)
            }
            cb(false);
        } else {
            await pixivClient.refreshAccessToken(refreshtoken.rows[0].refreshtoken)
                .then((authResults) => {
                    auth = authResults;
                    Logger.printLine("TokenSystem", `Token successfully updated for account: ${auth.user.name} (${auth.user.id})`, "debug", auth);
                    setTimeout(() => {
                        refreshToken((cb) => {

                        })
                    },(authResults.expires_in - 60) * 1000)
                    cb(authResults);
                })
                .catch((err) => {
                    Logger.printLine("TokenSystem", "Failed to refresh token for pixiv!", "emergency", err);
                    mqClient.sendMessage(`Pixiv Refresh Token is no longer valid, please generate a new token now!`, "crit", "TokenSystem");
                    console.error(err);
                    setTimeout(refreshToken, 60000)
                    auth = false;
                    cb(false);
                })
        }

    }
    function resizeImage(fileBuffer) {
        return new Promise(callback => {
            // Get Image Dimentions
            const dimensions = sizeOf(fileBuffer);
            const scaleSize = 4000 // Lets Shoot for 2100?
            let resizeParam = {
                fit: sharp.fit.inside,
                withoutEnlargement: true
            }
            if (dimensions.width > dimensions.height) { // Landscape Resize
                resizeParam.width = scaleSize
            } else { // Portrait or Square Image
                resizeParam.height = scaleSize
            }
            sharp(fileBuffer)
                .resize(resizeParam)
                .toFormat('jpg')
                .withMetadata()
                .toBuffer({resolveWithObject: true})
                .then(({data, info}) => { callback(data.toString('base64')) })
                .catch((err) => {
                    Logger.printLine("PixivDownload", "Failed to resize the image - " + err.message, "error");
                    callback(null)
                });
        })
    }
    function getImagetoB64(imageURL) {
        return new Promise(async returnedImage => {
            request.get({
                url: imageURL,
                headers: {
                    Referer: 'http://www.pixiv.net/',
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
                }
            }, async (err, res, body) => {
                if (err) {
                    returnedImage(null)
                } else {
                    const imageBuffer = Buffer.from(body)
                    const fileSizeInMegabytes = imageBuffer.byteLength / 1000000.0;
                    if (fileSizeInMegabytes > 7.8) {
                        returnedImage(await resizeImage(imageBuffer))
                    } else {
                        returnedImage(imageBuffer.toString('base64'))
                    }
                }
            })
        })

    }
    async function parseItems(list, channel, level, message, duplicates) {
        return new Promise(async (completedPage) => {
            const sentTo = `${systemglobal.Discord_Out}${(level) ? '.' + level : ''}`
            const _pconfig = await db.query(`SELECT * FROM pixiv_accounts WHERE paccount = ?`, [systemglobal.PixivUser]);
            function sendEmbed(post, level, addUser, objectMode, last, download_channelid) {
                let messageObject = {
                    "type": "image",
                    "title": `🎆 ${post.finalText}`,
                    "description": (post.description) ? post.description : undefined,
                    "url": post.link,
                    "color": post.color,
                    "timestamp": post.postDate,
                    "image": {
                        "url": `attachment://${post.file.name}`
                    },
                    "author": {
                        "name": `${post.userName} (${post.userNameID}) - ${post.userID}`,
                        "icon_url": (post.file.avatar) ? "attachment://avatar.png" : undefined
                    }
                }
                let reactions = ["Like", "ExpandSearch"]
                if (post.channelID === download_channelid) {
                    reactions.push("RemoveFile")
                } else {
                    reactions.push("Download")
                }
                if (last) {
                    if (addUser) {
                        reactions.push("AddUser")
                    }
                    reactions.push("Archive", "MoveMessage")
                }

                if (post.file.avatar && objectMode && post.channelID) {
                    return {
                        fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                        messageType: 'smultifileext',
                        messageReturn: false,
                        messageChannelID: post.channelID,
                        messageText: (systemglobal.Pixiv_Append_Time) ? `${moment(Date.now()).format('HH:mm')}` : '',
                        messageLink: post.link,
                        messageObject: messageObject,
                        itemFileArray: [
                            {
                                fileName: post.file.name,
                                fileData: post.file.data
                            },
                            {
                                fileName: 'avatar.png',
                                fileData: post.file.avatar
                            }
                        ],
                        addButtons: reactions
                    }
                } else if (objectMode && post.channelID) {
                    return {
                        fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                        messageType: 'sfileext',
                        messageReturn: false,
                        messageChannelID: post.channelID,
                        messageText: (systemglobal.Pixiv_Append_Time) ? `${moment(Date.now()).format('HH:mm')}` : '',
                        messageLink: post.link,
                        messageObject: messageObject,
                        itemFileData: post.file.data,
                        itemFileName: post.file.name,
                        addButtons: reactions
                    }
                } else {
                    return {
                        fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                        messageType: 'sfile',
                        messageReturn: false,
                        messageChannelID: (post.channelID) ? post.channelID : post.saveID,
                        messageText: `**🎆 ${messageObject.author.name}** : ***${messageObject.title.replace('🎆 ', '')}${(messageObject.description) ? '\n' + messageObject.description : ''}***`,
                        messageLink: post.link,
                        itemFileData: post.file.data,
                        itemFileName: post.file.name,
                        addButtons: reactions
                    }
                }
            }
            function sendImage(post, addUser, last, download_channelid) {
                const messageText = `**🎆 ${post.userName} (${post.userNameID}) - ${post.userID}** : ***${post.finalText}***${(post.description) ? '\n' + post.description : ''}`;
                let reactions = ["Like", "ExpandSearch"]
                if (post.channelID === download_channelid) {
                    reactions.push("RemoveFile")
                } else {
                    reactions.push("Download")
                }
                if (last) {
                    if (addUser) {
                        reactions.push("AddUser")
                    }
                    reactions.push("Archive", "MoveMessage")
                }

                return {
                    fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
                    messageReturn: false,
                    messageChannelID: (post.channelID) ? post.channelID : post.saveID,
                    messageText: messageText,
                    messageLink: post.link,
                    itemFileData: post.file.data,
                    itemFileName: post.file.name,
                    addButtons: reactions
                }
            }

            if (_pconfig.error || _pconfig.rows.length === 0) {
                Logger.printLine("SQL", "Error getting pixiv accounts records!", "error", _pconfig.error)
                completedPage(false);
            } else {
                const staticChannels = {
                    feed: _pconfig.rows[0].feed_channelid,
                    feed_nsfw: (_pconfig.rows[0].feed_channelid_nsfw) ? _pconfig.rows[0].feed_channelid_nsfw :_pconfig.rows[0].feed_channelid,
                    recommended: (_pconfig.rows[0].recom_channelid) ? _pconfig.rows[0].recom_channelid : _pconfig.rows[0].feed_channelid,
                    recommended_nsfw: (_pconfig.rows[0].recom_channelid_nsfw) ? _pconfig.rows[0].recom_channelid_nsfw : (_pconfig.rows[0].recom_channelid) ? _pconfig.rows[0].recom_channelid : (_pconfig.rows[0].feed_channelid_nsfw) ? _pconfig.rows[0].feed_channelid_nsfw : _pconfig.rows[0].feed_channelid,
                    save: _pconfig.rows[0].save_channelid,
                    save_nsfw: (_pconfig.rows[0].save_channelid_nsfw) ? _pconfig.rows[0].save_channelid_nsfw :_pconfig.rows[0].save_channelid
                };
                let requests = list.reduce((promiseChain, item, i, a) => {
                    return promiseChain.then(() => new Promise(async (resolve) => {
                        let post = {
                            userID: item.user.id,
                            userName: item.user.name,
                            userNameID: item.user.account,
                            postID: item.id,
                            postTitle: item.title,
                            postNSFW: item.x_restrict,
                            postSanity: item.sanity_level,
                            postDate: item.create_date,
                            userIcon: item.user.profile_image_urls.medium,
                            link: `https://pixiv.net/en/artworks/${item.id}`,
                        }

                        const foundillu = (systemglobal.Pixiv_No_History && channel !== "new") ? (item.isBookmarked) ? { rows: [ true ] } : { rows: [] } : await db.query(`SELECT illu_id FROM pixiv_history_illu WHERE illu_id = ?`, [post.postID]);
                        const autoDownload = await db.query(`SELECT user_id, channelid FROM pixiv_autodownload WHERE user_id = ?`, [item.user.id]);
                        if (foundillu.error) {
                            mqClient.sendMessage(`SQL Error when getting to the illustration history records`, "err", foundillu.error)
                            resolve()
                        } else if (duplicates || foundillu.rows.length === 0) {
                            let followUser = (!item.user.is_followed);
                            if (autoDownload.rows.length > 0) {
                                if (autoDownload.rows[0].channelid) {
                                    post.channelID = autoDownload.rows[0].channelid
                                    post.saveID = autoDownload.rows[0].channelid
                                    post.color = 6010879;
                                } else if (post.postSanity === 6 || post.postNSFW === 1) {
                                    post.channelID = _pconfig.rows[0].save_channelid_nsfw
                                    post.saveID = _pconfig.rows[0].save_channelid_nsfw
                                    post.color = 16711724;
                                } else {
                                    post.channelID = _pconfig.rows[0].save_channelid
                                    post.saveID = _pconfig.rows[0].save_channelid
                                    post.color = 6010879;
                                }
                            } else if (channel === "new") {
                                if (post.postSanity === 6 || post.postNSFW === 1) {
                                    post.channelID = staticChannels.feed_nsfw
                                    post.saveID = staticChannels.save_nsfw
                                    post.color = 16711724;
                                } else {
                                    post.channelID = staticChannels.feed
                                    post.saveID = staticChannels.save
                                    post.color = 6010879;
                                }
                            } else if (channel === "recom" || channel === "recompost") {
                                if (channel === "recompost") {
                                    post.description = `✳️ Related to post ${message.messageText} (${message.postID}) by ${message.messageArtist}`
                                }
                                if (post.postSanity === 6 || post.postNSFW === 1) {
                                    if (channel === "recompost") {
                                        post.color = 16711787;
                                    } else {
                                        post.color = 16711724;
                                    }
                                    post.channelID = staticChannels.recommended_nsfw
                                    post.saveID = staticChannels.save_nsfw
                                } else {
                                    if (channel === "recompost") {
                                        post.color = 14156031;
                                    } else {
                                        post.color = 7264269;
                                    }
                                    post.channelID = staticChannels.recommended;
                                    post.saveID = staticChannels.save
                                }
                            } else if (channel === "download") {
                                if (post.postSanity === 6 || post.postNSFW === 1) {
                                    post.color = 16711724;
                                } else {
                                    post.color = 6010879;
                                }
                                post.channelID = _pconfig.rows[0].download_channelid
                                post.saveID = _pconfig.rows[0].download_channelid
                            } else {
                                if (post.postSanity === 6 || post.postNSFW === 1) {
                                    post.color = 16711724;
                                } else {
                                    post.color = 6010879;
                                }
                                post.channelID = channel
                                post.saveID = staticChannels.save
                            }

                            const avatar = await getImagetoB64(item.user.profile_image_urls.medium);
                            const images = ((() => {
                                if (item.meta_pages.length > 0)
                                    return item.meta_pages.map(e => e.image_urls.original)
                                return [item.meta_single_page.original_image_url]
                            })())
                            Logger.printLine("IlluParser", `Getting Illustration from ${post.userName} : ${post.postID} : ` + ((images.length > 1) ? `${images.length} Pages` : `Single Image Wanted`), "info")
                            let requests = images.reduce((promiseChain, url, index) => {
                                return promiseChain.then(() => new Promise(async (sentImage) => {
                                    const image = await getImagetoB64(url)
                                    if (image) {
                                        post.finalText = `${post.postTitle} [${post.postID}]` + ((images.length > 1) ? ` (${parseInt(index) + 1}/${images.length})` : '');
                                        post.file = {
                                            data: image,
                                            avatar: (avatar) ? avatar : undefined,
                                            name: getIDfromText(url),
                                        }

                                        let _mqMessage = {};
                                        if (autoDownload.rows.length > 0) {
                                            _mqMessage = await sendImage(post, followUser, (images.length === parseInt(index) + 1), _pconfig.rows[0].download_channelid);
                                        } else {
                                            _mqMessage = await sendEmbed(post, level, followUser, (channel !== "download"), (images.length === parseInt(index) + 1), _pconfig.rows[0].download_channelid);
                                        }
                                        mqClient.sendData(sentTo, _mqMessage, async(ok) => {
                                            if (!ok) {
                                                Logger.printLine("IlluSender", `Failed to send the illustrations to Discord`, "error")
                                            } else if (parseInt(index) + 1 === images.length && !duplicates && (!systemglobal.Pixiv_No_History || channel === "new")) {
                                                await db.query(`INSERT IGNORE INTO pixiv_history_illu VALUES (?, ?, NOW())`, [post.postID, post.userID])
                                            }
                                            sentImage(ok);
                                            _mqMessage = null;
                                            post.file = {};
                                        })
                                    } else {
                                        Logger.printLine("PixivDownload", `Failed to downloaded url ${url}! Skipped!`, "debug")
                                        sentImage(false);
                                    }
                                }));
                            }, Promise.resolve());
                            requests.then(async () => {
                                Logger.printLine("IlluParser", `Completed Parsing Illustrations`, 'debug');
                                resolve();
                            })
                        } else {
                            resolve()
                        }
                    }));
                }, Promise.resolve());
                requests.then(async () => {
                    Logger.printLine("IlluParser", `Completed Parsing Illustrations`, 'debug')
                    completedPage(false);
                })
            }
        })
    }
    async function saveRecomIllus(list) {
        // noinspection ES6MissingAwait
        await list.forEach(async e => {
            const previousItem = (systemglobal.Pixiv_No_History) ? (e.isBookmarked) ? { rows: [ true ] } : { rows: [] } : await db.query(`SELECT illu_id FROM pixiv_history_illu WHERE illu_id = ?`, [e.id])
            if (previousItem.rows.length === 0) {
                const addResponse = await db.query(`INSERT INTO pixiv_recomm_illu SET ? ON DUPLICATE KEY UPDATE data = ?`, [{
                    paccount: systemglobal.PixivUser,
                    id: e.id,
                    user: e.user.id,
                    data: JSON.stringify(e)
                }, JSON.stringify(e)]);
                if (addResponse.error) {
                    Logger.printLine("SaveRecommIllust", `Failed to add Illustration https://pixiv.net/en/artworks/${e.id} to storage`, "error")
                    console.error(addResponse.error)
                } else {
                    Logger.printLine("SaveRecommIllust", `Adding Illustration https://pixiv.net/en/artworks/${e.id} to storage`, "debug")
                }
            }

        })
    }
    async function postRecommPost() {
        const recommIllust = await db.query(`SELECT * FROM pixiv_recomm_illu WHERE paccount = ? LIMIT 1`, [systemglobal.PixivUser]);
        if (recommIllust.error) {
            Logger.printLine(`PostRecomIllt`, `Failed to get recommended illustration records`, `error`, recommIllust.error);
        } else if (recommIllust.rows.length > 0) {
            const previousItem = (systemglobal.Pixiv_No_History) ? { rows: [] } : await db.query(`SELECT illu_id FROM pixiv_history_illu WHERE illu_id = ?`, [recommIllust.rows[0].id])
            if (previousItem.rows.length !== 0) {
                Logger.printLine("PostRecomIllt", `Recommended Illustration ${recommIllust.rows[0].id} is in history, Try Again...`, "warn")
                postRecommPost();
            } else if (recommIllust.rows[0].data) {
                await parseItems([recommIllust.rows[0].data], "recom")
            } else {
                try {
                    const results = await pixivClient.illustDetail(recommIllust.rows[0].id);
                    if (results && results.illust) {
                        await parseItems([results.illust], "recom", "priority");
                    } else {
                        Logger.printLine("PostRecomIllt", `Returned no items for ${recommIllust.rows[0].id}, Canceled`, "debug")
                    }
                } catch (err) {
                    Logger.printLine("PostRecomIllt", `Failed to get illustration item data for ${recommIllust.rows[0].id} (Caught err), Canceled`, "error", err)
                }
            }
            await db.query(`DELETE FROM pixiv_recomm_illu WHERE paccount = ? AND id = ?`, [systemglobal.PixivUser, recommIllust.rows[0].id]);
        } else {
            Logger.printLine(`PostRecomIllt`, `No recommended illustration records, getting more...`, `warning`, recommIllust.error);
            await getNewRecomIllust();
        }
    }
    async function clearRecomIllus() {
        await db.query(`DELETE s1 FROM pixiv_history_illu s1, pixiv_recomm_illu s2 WHERE s1.illu_id = s2.id`);
        await db.query(`TRUNCATE pixiv_recomm_illu`);
        await getNewRecomIllust();
    }

    async function getNewIllust() {
        try {
            let results = await pixivClient.illustFollow();
            if (results && results.illusts && results.illusts.length > 0) {
                await parseItems(results.illusts.reverse(), "new", 'priority')
                let i = 1
                while (true) {
                    try {
                        if (!results.next_url || i === 4) {
                            Logger.printLine("getNewIllust", `Returned items for new illustrations (End of Pages)`, "debug")
                            break;
                        }
                        i++
                        results = await pixivClient.requestUrl(results.next_url)
                        await parseItems(results.illusts.reverse(), "new", 'priority')
                    } catch (err) {
                        Logger.printLine("PixivPaginator", "Error pulling more pages for new illustrations", "warn", err)
                        Logger.printLine("getNewIllust", `Returned ${list.length} items for new illustrations (Caught err)`, "debug")
                        await parseItems(results.illusts.reverse(), "new", 'priority')
                        results = null;
                        break;
                    }
                }
            } else {
                Logger.printLine("getNewIllust", `Returned no new illustrations items, Canceled`, "debug")
            }
        } catch (err) {
            Logger.printLine("getNewIllust", `Returned no new illustrations items (Caught err), Canceled`, "error", err)
        }
    }
    async function getRecommended(userID, channelID, count) {
        try {
            let results = await pixivClient.illustRelated(userID);
            if (results && results.illusts && results.illusts.length > 0) {
                let i = 1
                await parseItems(results.illusts.reverse(), (channelID) ? channelID : "download", 'backlog')
                while (true) {
                    try {
                        if (!results.next_url || i === ((count) ? count : 8)) {
                            Logger.printLine("getNewIllust", `Returned items for new illustrations (End of Pages)`, "debug")
                            break;
                        }
                        i++
                        results = await pixivClient.requestUrl(results.next_url)
                        await parseItems(results.illusts.reverse(), (channelID) ? channelID : "download", 'backlog')
                        await sleep(15000)
                    } catch (err) {
                        Logger.printLine("PixivPaginator", "Error pulling more pages for new illustrations", "warn", err)
                        Logger.printLine("getNewIllust", `Returned items for new illustrations (Caught err)`, "debug")
                        break;
                    }
                }
            } else {
                Logger.printLine("getNewIllust", `Returned no new illustrations items, Canceled`, "debug")
            }
        } catch (err) {
            Logger.printLine("getNewIllust", `Returned no new illustrations items (Caught err), Canceled`, "error", err)
        }
    }
    async function getNewRecomIllust() {
        try {
            let results = await pixivClient.illustRecommended();
            if (results && results.illusts && results.illusts.length > 0) {
                await saveRecomIllus(results.illusts.reverse())
                let i = 1
                while (true) {
                    try {
                        if (!results.next_url || i === 4) {
                            break;
                        }
                        i++
                        results = await pixivClient.requestUrl(results.next_url)
                        await saveRecomIllus(results.illusts.reverse());
                    } catch (err) {
                        Logger.printLine("getNewRecomIllust", `Stopped getting new recommended (Caught err)`, "debug")
                        break;
                    }
                }
            } else {
                Logger.printLine("getNewRecomIllust", `Returned no recommended items, Canceled`, "debug")
            }
        } catch (err) {
            Logger.printLine("getNewRecomIllust", `Returned no recommended items (Caught err), Canceled`, "error", err)
        }
    }
    async function getUserllustAll(userID, channelID, duplicates) {
        try {
            let results = await pixivClient.userIllusts(userID);
            if (results && results.illusts && results.illusts.length > 0) {
                await parseItems(results.illusts.reverse(), (channelID) ? channelID : "download", 'backlog', undefined, duplicates)
                while (true) {
                    try {
                        if (!results.next_url) {
                            Logger.printLine("getUserllustAll", `Completed all pages for ${userID} (End of Pages)`, "debug")
                            break;
                        }
                        results = await pixivClient.requestUrl(results.next_url)
                        await parseItems(results.illusts.reverse(), (channelID) ? channelID : "download", 'backlog', undefined, duplicates)
                        await sleep(15000)
                    } catch (err) {
                        Logger.printLine("getUserllustAll", `Completed all pages for ${userID} (Caught err)`, "debug")
                        Logger.printLine("PixivPaginator", "Error pulling more pages for new illustrations", "warn", err)
                        console.error(err)
                        break;
                    }
                }
            } else {
                Logger.printLine("getUserllustAll", `Returned no items for ${userID}, Canceled`, "debug")
            }
        } catch (err) {
            Logger.printLine("getUserllustAll", `Returned no items for ${userID} (Caught err), Canceled`, "error", err)
        }
    }
    async function getllust(userID, channelID, duplicates) {
        try {
            const results = await pixivClient.illustDetail(userID);
            if (results && results.illust) {
                await parseItems([results.illust], (channelID) ? channelID : "download", "priority", undefined, duplicates);
            } else {
                Logger.printLine("getllust", `Returned no items for ${userID}, Canceled`, "debug")
            }
        } catch (err) {
            Logger.printLine("getllust", `Returned no items for ${userID} (Caught err), Canceled`, "error", err)
        }
    }

    async function doAction(message, complete) {
        switch (message.messageIntent) {
            case "Like" :
                if (message.messageAction === "add") {
                    pixivClient.bookmarkIllust(message.postID)
                        .then(function () {
                            Logger.printLine("PixivAction", `Added post ${message.postID} to bookmarks`, "info", message)
                        })
                        .catch(function (err) {
                            mqClient.sendMessage(`Error adding post ${message.postID} to bookmarks`, "warn", "PixivAction", err)
                        })
                } else if (message.messageAction === "remove") {
                    pixivClient.unbookmarkIllust(message.postID)
                        .then(function () {
                            Logger.printLine("PixivAction", `Removed post ${message.postID} from bookmarks`, "info", message)
                        })
                        .catch(function (err) {
                            mqClient.sendMessage(`Error removing post ${message.postID} from bookmarks`, "warn", "PixivAction", err)
                        })
                }
                complete(true)
                break;
            case 'ExpandSearch' :
                if (message.messageAction === "add") {
                    Logger.printLine("ExpandSearch", `Remote Request to get related images: ${message.postID}`, "debug", message)
                    await getRecommended(message.postID, (message.messageChannelID) ? message.messageChannelID : "recompost", (message.messageChannelID) ? 15 : 2)
                }
                complete(true)
                break;
            case 'DownloadUser' :
                Logger.printLine("getUserllustAll", `Remote Request to get user: ${message.postID}`, "debug", message)
                await getUserllustAll(message.postID, message.messageChannelID, (message.allowDuplicates))
                complete(true)
                break;
            case 'DownloadPost' :
                Logger.printLine("getllust", `Remote Request to get post: ${message.postID}`, "debug", message)
                await getllust(message.postID, message.messageChannelID, (message.allowDuplicates))
                complete(true)
                break;
            case 'DownloadRecommended' :
                Logger.printLine("getllust", `Remote Request to get recommended to post: ${message.postID}`, "debug", message)
                await getRecommended(message.postID, message.messageChannelID, 5)
                complete(true)
                break;
            case 'GetRecommended' :
                Logger.printLine("ExpandSearch", `Remote Request to get new recommended images`, "debug", message)
                postRecommPost()
                complete(true)
                break;
            case 'ClearRecommended' :
                clearRecomIllus()
                complete(true)
                break;
            case 'Follow' :
                const userID = parseInt(message.postID)
                if (!isNaN(userID)) {
                    if (message.messageAction === "add") {
                        pixivClient.userDetail(userID)
                            .then(function (user) {
                                pixivClient.followUser(userID)
                                    .then(function () {
                                        mqClient.sendMessage(`✅ Now Following ${userID} : ${user.user.name} (${user.user.account})`, "info", "PixivAction")
                                        Logger.printLine("PixivAction", `Removed post ${userID} from bookmarks`, "info", message)
                                    })
                                    .catch(function (err) {
                                        mqClient.sendMessage(`❌ Error following user ${userID}`, "error", "PixivAction", err)
                                    })
                            })
                            .catch(function (err) {
                                mqClient.sendMessage(`❌ User ${userID} was not found`, "error", "PixivAction", err)
                            })
                    } else if (message.messageAction === "remove") {
                        pixivClient.userDetail(userID)
                            .then(function (user) {
                                pixivClient.unfollowUser(userID)
                                    .then(function () {
                                        mqClient.sendMessage(`✅ Now Following ${userID} : ${user.user.name} (${user.user.account})`, "info", "PixivAction")
                                        Logger.printLine("PixivAction", `Removed post ${userID} from bookmarks`, "info", message)
                                    })
                                    .catch(function (err) {
                                        mqClient.sendMessage(`❌ Error following user ${userID}`, "error", "PixivAction", err)
                                    })
                            })
                            .catch(function (err) {
                                mqClient.sendMessage(`❌ User ${userID} was not found`, "error", "PixivAction", err)
                            })

                    }
                } else {
                    mqClient.sendMessage(`❌ ${message.postID} is a not a valid number`, "error", "PixivAction", err)
                }
                complete(true)
                break;
            default :
                complete(true)
                break;
        }
    }
    start();

    if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
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
