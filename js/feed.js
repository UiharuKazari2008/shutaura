/*    ___                  __                        _______ __
     /   | _________ _____/ /__  ____ ___  __  __   / ____(_) /___  __
    / /| |/ ___/ __ `/ __  / _ \/ __ `__ \/ / / /  / /   / / __/ / / /
   / ___ / /__/ /_/ / /_/ /  __/ / / / / / /_/ /  / /___/ / /_/ /_/ /
  /_/  |_\___/\__,_/\__,_/\___/_/ /_/ /_/\__, /   \____/_/\__/\__, /
                                        /____/               /____/
Developed at Academy City Research
"Developing a better automated future"
======================================================================================
Kanmi Project - RSS Feed Watcher and Parser
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
    const facilityName = 'Feed-Worker';

    const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
    const feed = require('feed-read');
    const podcastFeedParser = require("podcast-feed-parser")
    const dateFormat = require('dateformat');
    const fs = require('fs');
    const colors = require('colors');
    const moment = require('moment');
    const Flickr = require('flickr-sdk');
    const request = require("request");
    const minimist = require("minimist");
    const md5 = require("md5");
    let args = minimist(process.argv.slice(2));
    const RateLimiter = require('limiter').RateLimiter;
    const limiter1 = new RateLimiter(1, 10 * 1000);

    const { getVideofromURL } = require('./utils/tools');
    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    Logger.printLine("Init", "Feed Watcher", "debug");

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (account = ? OR account IS NULL) AND (application = 'feed' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName, systemglobal.RSSAccount])
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
            const _mq_fw_in = systemparams_sql.filter(e => e.param_key === 'mq.fileworker.in');
            if (_mq_fw_in.length > 0 && _mq_fw_in[0].param_value) {
                systemglobal.FileWorker_In = _mq_fw_in[0].param_value;
            }
            const _flickr_account = systemparams_sql.filter(e => e.param_key === 'flickr.login');
            if (_flickr_account.length > 0 && _flickr_account[0].param_value)
                systemglobal.Flickr_Key = _flickr_account[0].param_value
        }
    }
    if (args.whost) {
        systemglobal.Watchdog_Host = args.whost
    }
    if (args.wid) {
        systemglobal.Watchdog_ID = args.wid
    }
    await loadDatabaseCache();

    Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug")
    console.log(systemglobal)
    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    let flickr
    if (systemglobal.Flickr_Key) {
        flickr = new Flickr(systemglobal.Flickr_Key);
    }
    try {
        if (!fs.existsSync(systemglobal.TempFolder)) {
            fs.mkdirSync(systemglobal.TempFolder);
        }
    } catch (e) {
        console.error('Failed to create the temp folder, not a issue if your using docker');
        console.error(e);
    }

    // YouTube Notifications
    async function sendVideoToDiscord(channelid, article ) {
        const messageContents = `📼 **${article.author}:** ***${article.title}***\n` +
            `${article.link}\n` +
            `*${dateFormat(article.published, "dddd, mmmm dS, yyyy (h:MM)")}*`
        const reactions = ["WatchLaterYT", "Check", "Pin", "Download", "Archive", "MoveMessage"]
        mqClient.sendData( `${systemglobal.Discord_Out}.priority`, {
            fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
            messageReturn: false,
            messageType : 'stext',
            messageChannelID : channelid,
            messageText : messageContents,
            addButtons : reactions
        }, function (ok) {});
    }
    async function getNewVideos() {
        // YouTube List
        const youtubelist = await db.query(`SELECT * FROM youtube_watchlist WHERE yaccount = ?`, [systemglobal.YouTubeUser])
        if (youtubelist.error) {
            mqClient.sendMessage(`SQL Error when getting to the YouTube Watchlist records`, "err", "SQL", youtubelist.error)
        } else {
            await Promise.all(youtubelist.rows.map(async list => {
                limiter1.removeTokens(1, async () => {
                    feed(`http://www.youtube.com/feeds/videos.xml?channel_id=${list.yuser}`, async (err, articles) => {
                        if (err) {
                            Logger.printLine("YouTube", `Failed to get the YouTube Channel: ${list.yuser}, please manually correct this in the database!`, "warn", err)
                        } else {
                            const youttubehistory = await db.query(`SELECT videoid FROM youtube_history_videos WHERE yuser = ?`, [list.yuser])
                            if (youttubehistory.error) {
                                Logger.printLine("SQL", `SQL Error when getting to the YouTube history records for "${list.yuser}"`, "critical", youttubehistory.error)
                            } else {
                                let previousVideos = []
                                previousVideos.push(...youttubehistory.rows.map(e => e.videoid))
                                if ( articles.length === undefined ) {
                                    Logger.printLine("YouTube", `Failed to read the feed for the YouTube Channel: ${list.yuser}, please manually correct this in the database!`, "critical", err)
                                } else {
                                    if ((list.name === null || (list.name !== articles[0].author))&& articles.length > 0)
                                        await db.query('UPDATE youtube_watchlist SET name = ? WHERE yuser = ?', [articles[0].author, list.yuser])
                                    await Promise.all(articles.map(async article => {
                                        if (previousVideos.indexOf(getVideofromURL(article.link)) !== -1) {
                                            Logger.printLine("YouTube", `New video from "${article.author}" - "${article.title}"`, "info", article)
                                            sendVideoToDiscord(list.channelid, article)
                                            await db.query(`INSERT IGNORE INTO youtube_history_videos VALUES (?, ?, NOW())`, [getVideofromURL(article.link), list.yuser])
                                        }
                                    }))
                                }
                            }
                        }
                    })
                })
            }))
        }
    }

    // Podcast Downloader
    async function sendPodcastToDiscord(channelid, episode, meta, backlog, cb) {
        let description = ''
        if (episode.description)
            description = ['\n```', episode.description.substring(0,1500),  '```'].join('')
        const episodeName = [
            '**🔊 ', meta.title, '** - ',
            '***', episode.title, '***',
            description
        ].join('');
        const title = episode.title
            .replace('Danny Howard Presents...Nothing Else Matters Radio ', '')
            .replace(meta.title, '')
            .split(' ').join('_')
            .split('.').join('')
            .split('/').join('')
            .split("\\").join('')
            .split('#').join('')
            .split('__').join('')
            .split('_–_').join('')
        const episodeFilename = [
            meta.title, ' - ', title, '.', episode.enclosure.url.split('.').pop()
        ].join('')
        let MessageParameters = {
            messageChannelID: channelid,
            messageText: episodeName,
            itemFileName: episodeFilename.split('?')[0],
            itemFileURL: episode.enclosure.url,
            itemReferral: episode.link,
            backlogRequest: backlog
        }
        let episodeDate = moment(episode.pubDate).format('YYYY-MM-DD HH:mm:ss');
        if (episodeDate.includes('Invalid')) {
            console.error('Invalid episode date returned');
        } else {
            MessageParameters.itemDateTime = episodeDate;
        }
        let sendTo = systemglobal.FileWorker_In
        if (backlog) {
            sendTo += '.backlog'
        }
        mqClient.sendData(sendTo, MessageParameters, cb)
    }
    async function getPodcasts() {
        const rsslist = await db.query(`SELECT * FROM podcast_watchlist WHERE rssaccount = ?`, [systemglobal.RSSAccount])
        if (rsslist.error) {
            mqClient.sendMessage(`SQL Error when getting to the Podcast Watchlist records`, "err", "SQL", rsslist.error)
        } else {
            await Promise.all(rsslist.rows.map(async list => {
                let podcast = undefined
                try {
                    podcast = await podcastFeedParser.getPodcastFromURL(list.url)
                } catch (err) {
                    Logger.printLine("Podcast", `Failed to fetch Podcast "${list.url}"`, "error", err)
                }
                if (podcast && podcast.meta && podcast.meta.title && podcast.episodes.length > 0) {
                    let counter = 0
                    podcast.episodes.map((async (episode, index) => {
                        if (episode.enclosure && episode.enclosure.url && index <= 500) {
                            let thash = md5(episode.title);
                            const rsshistory = db.query(`SELECT * FROM podcast_history WHERE (url = ? OR thash = ?) AND feed = ?`, [episode.enclosure.url, thash, list.url])
                            if (rsshistory.error) {
                                Logger.printLine("SQL", `SQL Error when getting to the Podcast history records for "${podcast.meta.title}"`, "critical", rsshistory.error)
                            } else if (rsshistory.length === 0) {
                                let backlog = false;
                                if (counter > 3) {
                                    backlog = true
                                    Logger.printLine("Podcast", `New Podcast from "${podcast.meta.title}" - "${episode.title} (BACKLOGGED)"`, "info", episode)
                                } else {
                                    Logger.printLine("Podcast", `New Podcast from "${podcast.meta.title}" - "${episode.title}"`, "info", episode)
                                }
                                sendPodcastToDiscord(list.channelid, episode, podcast.meta, backlog, async (ok) => {
                                    if (!ok) {
                                        mqClient.sendMessage(`Failed to send Podcast Episode - "${podcast.meta.title}"`, "err", "SQL", err, episode)
                                    } else {
                                        await db.query(`INSERT IGNORE INTO podcast_history VALUES (?, ?, ?, NOW())`, [episode.enclosure.url, thash, list.url])
                                    }
                                })
                                counter++;
                            }
                        }
                    }))
                } else if (podcast && podcast.meta && podcast.meta.title) {
                    Logger.printLine("Podcast", `Failed to get the Podcast Episodes for "${podcast.meta.title}"`, "warn")
                } else {
                    Logger.printLine("Podcast", `Failed to get the Podcast Channel: ${list.url}, please manually correct this in the database!`, "warn")
                }
            }))
        }
    }

    // Flickr Downloader
    async function getFlickr() {
        Promise.all((await db.query(`SELECT * FROM flickr_watchlist WHERE flickr_account = ?`, [systemglobal.FlickrAccount])).rows.map(async list => {
            const imagehistory = await db.query(`SELECT * FROM flickr_history WHERE username = ?`, [list.username])
            let currentPage = 1;
            let maxPages = 2;
            let imagesToDownload = 0;
            async function getFlickrPage(page) {
                let itemsToGet = 10
                if (list.backlog === 1) {
                    itemsToGet = 500
                }
                try {
                    const res = await flickr.people.getPhotos({
                        user_id: list.username,
                        per_page: itemsToGet,
                        page: page
                    })
                    if (res.body.photos.photo.length > 0) {
                        maxPages = res.body.photos.pages
                        currentPage++
                        await Promise.all(res.body.photos.photo.map((image, index) => {
                            if (imagehistory.rows.filter(e => e.photo_id === image.id).length === 0) {
                                if (list.approval_ch === null) {
                                    flickr.photos.getInfo({
                                        photo_id: image.id
                                    }).then(async (ph) => {
                                        imagesToDownload++
                                        const photo = ph.body.photo
                                        // Init Message
                                        let MessageParameters = { messageChannelID: list.save_ch };
                                        // Set Body Header
                                        let messageBody = `${photo.title._content} (${list.username})`
                                        // Add Description
                                        if (photo.description.length > 1) {
                                            messageBody += '\n```' + photo.description + '```'
                                        }
                                        // Add Link to Post
                                        messageBody += '\n`' + `https://www.flickr.com/photos/${list.username}/${image.id}/` + '`'
                                        MessageParameters.messageText = messageBody
                                        MessageParameters.itemReferral = `https://www.flickr.com/photos/${list.username}/${image.id}/`
                                        // Get Image if Possible
                                        if (photo.dates.taken) {
                                            MessageParameters.itemDateTime = moment(photo.dates.taken).format('YYYY-MM-DD HH:mm:ss');
                                        } else if (photo.dates.posted) {
                                            MessageParameters.itemDateTime = moment(photo.dates.posted).format('YYYY-MM-DD HH:mm:ss');
                                        }

                                        // Get Download URL
                                        if (photo.originalsecret) {
                                            MessageParameters.itemFileURL = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.originalsecret}_o.${photo.originalformat}`
                                            MessageParameters.itemFileName = `${list.username}_${photo.id}_o.${photo.originalformat}`
                                        } else {
                                            await flickr.photos.getSizes({
                                                photo_id: image.id
                                            })
                                                .then((sizes) => {
                                                    MessageParameters.itemFileURL = sizes.body.sizes.size.pop().source
                                                    MessageParameters.itemFileName = `${list.username}_${photo.id}_o.${sizes.body.sizes.size.pop().source.split('.').pop()}`
                                                })
                                                .catch((err) => {
                                                    Logger.printLine("Flickr", `Failed to get sizes for image ${list.username}:${photo.id}`, "error", err)
                                                })
                                        }
                                        // If Download URL is there
                                        if (MessageParameters.itemFileURL) {
                                            let sendTo = systemglobal.FileWorker_In
                                            if (imagesToDownload > 10) {
                                                sendTo += '.backlog'
                                            }
                                            mqClient.sendData(sendTo, MessageParameters, async(ok) => {
                                                if (!ok) {
                                                    mqClient.sendMessage(`Failed to send Image - ${list.username}:${image.id}`, "err", "SQL", err, MessageParameters)
                                                } else {
                                                    Logger.printLine("Flickr", `New Image from ${list.username} - ${MessageParameters.itemReferral}`, "info")
                                                    await db.query(`INSERT IGNORE INTO flickr_history VALUES (?, ?, NOW())`, [image.id, list.username])
                                                }
                                            })
                                        } else {
                                            mqClient.sendMessage(`Failed to send Image ${list.username}:${image.id} because it has not downloadable URL's`, "err", "SQL", err, MessageParameters)
                                        }
                                    })
                                } else {
                                    let messageBody = `https://www.flickr.com/photos/${list.username}/${image.id}/`
                                    mqClient.sendData( `${systemglobal.Discord_Out}.priority`, {
                                        fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
                                        messageReturn: false,
                                        messageType : 'stext',
                                        messageChannelID : list.approval_ch,
                                        messageText : messageBody,
                                        addButtons : ["Download"]
                                    }, async (ok) => {
                                        if (!ok) {
                                            mqClient.sendMessage(`Failed to send Image - ${list.username}:${image.id}`, "err", "SQL", err)
                                        } else {
                                            Logger.printLine("Flickr", `New Image from ${list.username} - ${messageBody}`, "info")
                                            db.query(`INSERT IGNORE INTO flickr_history VALUES (?, ?, NOW())`, [image.id, list.username])
                                        }
                                    });
                                }
                            }
                            if (index + 1 === res.body.photos.photo.length) {
                                if (currentPage <= maxPages && imagesToDownload > 0 && list.backlog === 1) {
                                    setTimeout(getFlickrPage, 5000, currentPage)
                                } else {
                                    Logger.printLine("Flickr", `Reached the end of all pages for ${list.username}`, "info")
                                }
                            }
                        }))
                    } else {
                        Logger.printLine("Flickr", `Did not get any images back for ${list.username}`, "error");
                    }
                } catch (err) {
                    Logger.printLine("Flickr", `Error when getting pages for ${list.username}`, "error", err);
                    console.error(err);
                }
            }
            getFlickrPage(currentPage)
        }))
    }

    if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
        setInterval(() => {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/ping?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
        }, 60000)
        request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
            if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
            }
        })
    }

    sleep(2500).then(() => {
        Logger.printLine("Init", `RSS Client is Ready!"`, "info")
        setInterval(getNewVideos, 900000);
        setInterval(getPodcasts, 3600000);
        setInterval(getFlickr, 3600000);
        getNewVideos();
        getPodcasts();
        if (systemglobal.Flickr_Key) {
            getFlickr();
        }
        if (process.send && typeof process.send === 'function') {
            process.send('ready');
        }
    })
    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err)
        process.exit(1)
    });
})()
