/*    ___                  __                        _______ __
     /   | _________ _____/ /__  ____ ___  __  __   / ____(_) /___  __
    / /| |/ ___/ __ `/ __  / _ \/ __ `__ \/ / / /  / /   / / __/ / / /
   / ___ / /__/ /_/ / /_/ /  __/ / / / / / /_/ /  / /___/ / /_/ /_/ /
  /_/  |_\___/\__,_/\__,_/\___/_/ /_/ /_/\__, /   \____/_/\__/\__, /
                                        /____/               /____/
Developed at Academy City Research
"Developing a better automated future"
======================================================================================
Kanmi Project - Web Crawler System
Copyright 2020
======================================================================================
This code is publicly released and is restricted by its project license
====================================================================================== */

const systemglobal = require("../config.json");
(async () => {
    let systemglobal = require('../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'WebCrawer';

    const fs = require('fs');
    const cheerio = require('cheerio');
    const got = require('got');
    let request = require('request').defaults({ encoding: null, jar: true });
    const sharp = require('sharp');
    const sizeOf = require('image-size');
    const moment = require('moment');
    const podcastFeedParser = require("podcast-feed-parser")
    const RateLimiter = require('limiter').RateLimiter;
    const blogPageLimit = new RateLimiter(1, 90000);
    const backlogPageLimit = new RateLimiter(1, 90000);
    const postPageLimit = new RateLimiter(1, 5000);
    const postImageLimit = new RateLimiter(1, 500);
    const minimist = require("minimist");
    const Logger = require('./utils/logSystem')(facilityName);
    const db = require('./utils/shutauraSQL')(facilityName);

    let pullDeepMPZPage = 0;
    let args = minimist(process.argv.slice(2));
    let Timers = new Map();

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (application = 'webparser' OR application IS NULL) ORDER BY system_name, application`, [systemglobal.SystemName])
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
            const _mq_fw_in_disc = systemparams_sql.filter(e => e.param_key === 'feed.mq.fileworker.in');
            if (_mq_fw_in_disc.length > 0 && _mq_fw_in_disc[0].param_value) {
                systemglobal.FileWorker_In = _mq_fw_in_disc[0].param_value;
            } else if (_mq_fw_in.length > 0 && _mq_fw_in[0].param_value) {
                systemglobal.FileWorker_In = _mq_fw_in[0].param_value;
            }


            const _intervals = systemparams_sql.filter(e => e.param_key === 'webparser.timers');
            if (_intervals.length > 0 && _intervals[0].param_data) {
                if (_intervals[0].param_data.mixcloud)
                    systemglobal.Mixcloud_Interval = parseInt(_intervals[0].param_data.mixcloud.toString()) * 3600000;
                if (_intervals[0].param_data.myfigurecollection)
                    systemglobal.MFC_Interval = parseInt(_intervals[0].param_data.myfigurecollection.toString()) * 3600000
                if (_intervals[0].param_data.mpzero)
                    systemglobal.MPZero_Interval = parseInt(_intervals[0].param_data.mpzero.toString()) * 3600000
                if (_intervals[0].param_data.sankakucomplex)
                    systemglobal.SankakuComplex_Interval = parseInt(_intervals[0].param_data.sankakucomplex.toString()) * 3600000
            }
            // {"mpzero": 28800000, "mixcloud": 28800000, "sankakucomplex": 28800000, "myfigurecollection": 3600000}
            const _myfigurecollection = systemparams_sql.filter(e => e.param_key === 'webparser.myfigurecollection');
            if (_myfigurecollection.length > 0 && _myfigurecollection[0].param_data) {
                if (_myfigurecollection[0].param_data.channel)
                    systemglobal.MFC_Channel = _myfigurecollection[0].param_data.channel;
            }
            // {"channel": "886085760841834516"}
            const _sankakucomplex = systemparams_sql.filter(e => e.param_key === 'webparser.sankakucomplex');
            if (_sankakucomplex.length > 0 && _sankakucomplex[0].param_data) {
                if (_sankakucomplex[0].param_data.channel)
                    systemglobal.SankakuComplex_Pages = _sankakucomplex[0].param_data.pages;
            }
            // {"pages": [{"url": "https://www.sankakucomplex.com/tag/cosplay/", "channel": "806544860311846933"}]}
            const _mpzerocos = systemparams_sql.filter(e => e.param_key === 'webparser.mpzero');
            if (_mpzerocos.length > 0 && _mpzerocos[0].param_data) {
                if (_mpzerocos[0].param_data.channel)
                    systemglobal.MPZero_Channel = _mpzerocos[0].param_data.channel;
                if (_mpzerocos[0].param_data.deepcrawl)
                    systemglobal.MPZero_Deep_Crawl = (_mpzerocos[0].param_data.deepcrawl);
                if (_mpzerocos[0].param_data.backlog)
                    systemglobal.MPZero_Backlog = (_mpzerocos[0].param_data.backlog);
                if (_mpzerocos[0].param_data.pages)
                    systemglobal.MPZero_Pages = _mpzerocos[0].param_data.pages;
            }
            // {"pages": ["https://mpzerocos.exblog.jp/page/1/", "https://mpzerocos.exblog.jp/page/2/"], "backlog": false, "channel": "806544860311846933", "deepcrawl": false}
        }
    }
    await loadDatabaseCache();
    if (args.whost) {
        systemglobal.Watchdog_Host = args.whost
    }
    if (args.wid) {
        systemglobal.Watchdog_ID = args.wid
    }
    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    console.log(systemglobal)
    Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug")

    function getImagetoB64(imageURL, refer, returnedImage) {
        request.get({
            url: imageURL,
            headers: {
                Referer: refer,
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
                returnedImage(null)
            } else {
                const imageBuffer = Buffer.from(body)
                const fileSizeInMegabytes = imageBuffer.byteLength / 1000000.0;
                if (fileSizeInMegabytes > 7.8) {
                    resizeImage(imageBuffer, function (data) {
                        if (data !== false) {
                            returnedImage(data)
                        } else {
                            Logger.printLine("BlogDownload", "Failed to resize the image", "error")
                        }
                    })
                } else {
                    returnedImage(imageBuffer.toString('base64'))
                }
            }
        })
    }
    function resizeImage(fileBuffer, callback) {
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
            .catch((err) => { callback(false) });
    }

    function sendImagetoDiscord(post, backlog, passed) {
        let sentTo = `${systemglobal.Discord_Out}`
        if (backlog) {
            sentTo = `${systemglobal.Discord_Out}` + '.backlog'
        }
        mqClient.sendData( sentTo, {
            fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
            messageType : 'sfile',
            messageReturn: false,
            messageChannelID : post.channelID,
            messageText : post.text,
            itemFileData : post.file.data,
            itemFileName : post.file.name,
            itemDateTime: post.date,
            addButtons : ["Pin", "Archive", "MoveMessage"]
        }, function (ok) {
            if (ok) {
                passed(true)
            } else {
                passed(false)
                Logger.printLine("BlogImageSender", `Failed to send the image ${post.file.name} to Discord`, "error")
            }
        });
    }
    function sendFiguretoDiscord(post, passed) {
        const sentTo = `${systemglobal.Discord_Out}.priority`
        mqClient.sendData( sentTo, {
            fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
            messageType : 'stext',
            messageReturn: false,
            messageChannelID : post.channelID,
            messageText : post.text,
            addButtons : ["Pin", "Download", "Archive", "MoveMessage"]
        }, function (ok) {
            if (ok) {
                passed(true)
            } else {
                passed(false)
                Logger.printLine("BlogImageSender", `Failed to send the image ${post.file.name} to Discord`, "error")
            }
        });
    }
    async function sendMixToDiscord(channelid, track, download, backlog, cb) {
        const filename = track.name + '.' + download.split('.').pop().split('?')[0];
        let MessageParameters = {
            messageChannelID: channelid,
            messageText: `**🔊 ${track.name}**`,
            itemFileName: filename,
            itemFileURL: download,
            itemReferral: track.url,
            backlogRequest: backlog
        }
        let episodeDate = moment(track.date).format('YYYY-MM-DD HH:mm:ss');
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


    async function pullMPzero(pages, uploadChannelID, backlog, ondemand) {
        const history = await db.query(`SELECT * FROM web_visitedpages WHERE url LIKE '%mpzerocos%'`)
        await Promise.all(pages.map((pageURL) => {
            // ForEach Page of this Blog
            if (backlog) {
                backlogPageLimit.removeTokens(1, async () => {
                    await pullItem();
                });
            } else {
                blogPageLimit.removeTokens(1, async () => {
                    await pullItem();
                });
            }
            async function pullItem() {
                try {
                    const blogPage = await got(pageURL)
                    const $ = cheerio.load(blogPage.body); // Parse Response
                    let baseSelector = 'div[class=POST]' // Base Post Selector
                    const linkSelector = '.POST_BODY > span[class=more-post] > a' // Select Post Links
                    const infoFinder = $('div[class=POST] > .POST_HEAD > table > tbody > tr > td > a')[0].children[0].data.trim().toLowerCase()
                    if (infoFinder && infoFinder.includes('＊info')) {
                        baseSelector += ':gt(0)'
                        console.log('Page 1 Will ignore the Info Post');
                    }

                    // For Each Blog Post in this Page
                    await Promise.all($(baseSelector).find(linkSelector).each(async (thisPostIndex, thisPost) => {
                        const postURL = thisPost.attribs.href
                        if (!history.error && history.rows.filter(e => e.url === postURL).length === 0) {
                            postPageLimit.removeTokens(1, async () => {
                                try {
                                    const response = await got(postURL);
                                    const $1 = cheerio.load(response.body);
                                    const postTitle = $1('div[class=POST] > .POST_HEAD > table > tbody > tr > td')[0].children[0].data.trim()
                                    const postDate = postTitle.split('/')
                                    const year = postDate[0].substr(postDate[0].length - 4, 4)
                                    const month = postDate[1].substr(postDate[1].length - 2, 2)
                                    const day = postDate[2].substr(0, 2)
                                    const newDate = `${year}-${month}-${day}`
                                    await Promise.all($1('div[class=POST]').find('.POST_BODY > center > img').each(function (thisImageIndex, image) {
                                        postImageLimit.removeTokens(1, async function () {
                                            const imageSrc = image.attribs.src
                                            const imageName = imageSrc.split('/').pop()

                                            getImagetoB64(imageSrc, postURL, function (image) {
                                                if (image !== null) {
                                                    sendImagetoDiscord({
                                                        channelID: uploadChannelID,
                                                        text: postTitle,
                                                        date: newDate,
                                                        file: {
                                                            data: image,
                                                            name: imageName
                                                        }
                                                    }, backlog, function (ok) {
                                                        if (ok) {
                                                            Logger.printLine('MPZeroPull-PostImage', `Sent blog post image "${imageName}"`, 'debug');
                                                        } else {
                                                            Logger.printLine('MPZeroPull-PostImage', `Failed to send the Blog post image "${imageName}"`, 'error');
                                                        }
                                                    })
                                                } else {
                                                    Logger.printLine('MPZeroPull-PostImage', `Failed to pull the Blog post image "${imageName}"`, 'error');
                                                }
                                            })
                                        })
                                    }))
                                    await db.query(`INSERT IGNORE INTO web_visitedpages VALUES (?, NOW())`, [postURL])
                                } catch (err) {
                                    Logger.printLine('MPZeroPull-Post', `Failed to pull the Blog post page "${postURL}" - ${err.message}`, 'error');
                                    console.log(err);
                                }
                            });
                        }
                    }))
                } catch (err) {
                    Logger.printLine('MPZeroPull', `Failed to pull the Blog page - ${err.message}`, 'error', err);
                    console.log(err);
                }
            }
        }))
    }
    async function pullDeepMPZ(channel) {
        if (pullDeepMPZPage < 1000) {
            Logger.printLine('MPZero', `Starting at page ${pullDeepMPZPage}`, 'info');
            await pullMPzero([
                `https://mpzerocos.exblog.jp/page/${pullDeepMPZPage}/`,
                `https://mpzerocos.exblog.jp/page/${pullDeepMPZPage + 1}/`,
            ], channel, true, true);
            pullDeepMPZPage += 2;
            Logger.printLine('MPZero', `Saving next pages are ${pullDeepMPZPage}`, 'info');
            fs.writeFileSync('./mpz-backlog', pullDeepMPZPage.toString() , 'utf-8');
            Timers.set(`MPZDEEP${systemglobal.MPZero_Channel}`, setTimeout(() => {
                pullDeepMPZ(systemglobal.MPZero_Channel);
            }, 900000));
        } else {
            let timer = Timers.get(`MPZDEEP${systemglobal.MPZero_Channel}`);
            Logger.printLine('MPZero', `MAXIMUM PAGE LIMIT`, 'info');
            fs.writeFileSync('./mpz-backlog', "20000" , 'utf-8');
            if (timer) { clearInterval(timer); Timers.delete(`MPZDEEP${systemglobal.MPZero_Channel}`) }
        }
    }
    async function getFiguresOTD(c) {
        const currDate = new Date(Date.now())
        const day = new Date()
        day.setUTCDate(currDate.getUTCDate())
        day.setUTCMonth(currDate.getUTCMonth())
        day.setUTCFullYear(currDate.getUTCFullYear())
        day.setUTCHours(0)
        day.setUTCMinutes(0)
        day.setUTCSeconds(0)

        const dayOffset = (86400)
        const actualDay = (day.getTime() / 1000).toFixed(0) - dayOffset

        const history = await db.query(`SELECT * FROM web_visitedpages WHERE url LIKE '%myfigurecollection%'`)
        blogPageLimit.removeTokens(1, async () => {
            const pageURL = `https://myfigurecollection.net/pictures.php?tab=potd&s=${actualDay}`
            try {
                const pulledPage = await got(pageURL)
                const $ = cheerio.load(pulledPage.body); // Parse Response
                await Promise.all($('div[class="picture-icons medium"] > span[class="picture-icon tbx-tooltip"] > a').each((thisPostIndex, thisPost) => {
                    const figureURL = thisPost.attribs.href
                    if (!history.error && history.rows.filter(e => e.url === figureURL).length === 0) {
                        sendFiguretoDiscord({
                            channelID: c,
                            text: `${figureURL}`
                        }, async (ok) => {
                            if (ok) {
                                await db.query(`INSERT IGNORE INTO web_visitedpages VALUES (?, NOW())`, [figureURL])
                                Logger.printLine('MFCPODPull-PostImage', `Sent MFC POD post "${figureURL}"`, 'debug');
                            } else {
                                Logger.printLine('MFCPODPull-PostImage', `Failed to send the MFC POD post"${figureURL}"`, 'error');
                            }
                        })
                    }
                }))
            } catch (err) {
                Logger.printLine('MFCPODPull', `Failed to pull the MFC POD page - ${err.message}`, 'error', err);
                console.log(err);
            }
        })

    }
    async function getSankakuGallery(galleryURL, destionation) {
        try {
            const galleryFeed = await podcastFeedParser.getPodcastFromURL(`${galleryURL}feed/`)
            if (galleryFeed && galleryFeed.meta && galleryFeed.meta.title && galleryFeed.episodes.length > 0) {
                let counter = 0
                const history = await db.query(`SELECT * FROM web_visitedpages WHERE url LIKE '%sankakucomplex%'`)
                await Promise.all(galleryFeed.episodes.map(async (thisArticle, thisArticleIndex, articleArray) => {
                    if (thisArticle.link && thisArticleIndex <= 1000 && !history.error && history.filter(e => e.url === thisArticle.link).length === 0) {
                        let backlog = false;
                        if (counter > 3) {
                            backlog = true
                            Logger.printLine("SankakuGallery", `New Article from "${galleryFeed.meta.title}" - "${thisArticle.title} (BACKLOGGED)"`, "info", thisArticle)
                        } else {
                            Logger.printLine("SankakuGallery", `New Article from "${galleryFeed.meta.title}" - "${thisArticle.title}"`, "info", thisArticle)
                        }
                        try {
                            const pageResults = await got(thisArticle.link);
                            const $ = await cheerio.load(pageResults.body); // Parse Response
                            let images = []
                            await $('.entry-content > p > a:contains(wp-content)')
                                .each((thisPostIndex, thisPost) => {
                                    if (images.indexOf(thisPost.attribs.href) === -1) {
                                        images.push(thisPost.attribs.href)
                                    }
                                })
                            if (images.length > 0) {
                                await Promise.all(images.map(async (image) => {
                                    let title = `${galleryFeed.meta.title.split(' - ')[0]} - ${thisArticle.title}\n` + '`' + thisArticle.link + '`'
                                    let MessageParameters = {
                                        messageChannelID: destionation,
                                        messageText: title,
                                        itemFileName: image.split('/').pop(),
                                        itemFileURL: image,
                                        itemReferral: thisArticle.link,
                                        backlogRequest: backlog
                                    }
                                    let episodeDate = moment(thisArticle.pubDate).format('YYYY-MM-DD HH:mm:ss');
                                    if (episodeDate.includes('Invalid')) {
                                        console.error('Invalid episode date returned');
                                    } else {
                                        MessageParameters.itemDateTime = episodeDate;
                                    }
                                    let sendTo = systemglobal.FileWorker_In
                                    if (backlog) {
                                        sendTo += '.backlog'
                                    }

                                    mqClient.sendData(sendTo, MessageParameters, (ok) => {
                                        if (!ok) {
                                            mqClient.sendMessage(`Failed to send article - "${thisArticle.title}"`, "err", "SQL", err, thisArticle);
                                        }
                                    });
                                }));
                                await db.query(`INSERT IGNORE INTO web_visitedpages VALUES (?, NOW())`, [thisArticle.link]);
                            } else {
                                Logger.printLine('SankakuGallery', `No Images found for "${thisArticle.title}"`, 'error');
                            }
                        } catch (err) {
                            Logger.printLine('SankakuGallery', `Failed to pull the article - ${err.message}`, 'error', err);
                            console.log(err);
                        }
                        counter++;
                    }
                }))
            } else if (galleryFeed && galleryFeed.meta && galleryFeed.meta.title) {
                Logger.printLine("SankakuGallery", `Failed to get the any articles for "${galleryFeed.meta.title}"`, "warn")
            } else {
                Logger.printLine("SankakuGallery", `Failed to get the gallery: ${galleryURL}, please manually correct this!`, "warn")
            }
        } catch (err) {
            Logger.printLine("SankakuGallery", `Failed to fetch gallery "${galleryURL}"`, "error", err)
        }
    }
    async function getMixcloudPodcasts() {
        const mixclouduser = await db.query(`SELECT * FROM mixcloud_watchlist`)
        if (mixclouduser.error) {
            mqClient.sendMessage(`SQL Error when getting to the Podcast Watchlist records`, "err", "SQL", mixclouduser.error)
        } else if (mixclouduser.rows.length > 0) {
            const history = await db.query(`SELECT * FROM web_visitedpages WHERE url LIKE '%mixcloud%'`)
            await Promise.all(mixclouduser.rows.map(async user => {
                try {
                    const tracks = await getCloudcasts(user.username)
                    if (tracks.length === 0) {
                        Logger.printLine('Mixcloud-Get', `Failed to get any episodes from the Mixcloud API for ${user.username}`, 'error');
                    } else {
                        await Promise.all(tracks.filter(track => history.rows.filter(e => track.name && !(user.search && track.name.toLowerCase().includes(user.search.toLowerCase())) && !history.error && e.url === track.url).length === 0).map(async track => {
                            const response = await getTrackURL(track)
                            if (!response) {
                                Logger.printLine('Mixcloud-Pull', `Failed to get file to download for "${track.url}"`, 'error');
                            } else {
                                sendMixToDiscord(user.channelid, track, response, true, async (ok) => {
                                    if (ok) {
                                        await db.query(`INSERT IGNORE INTO web_visitedpages VALUES (?, NOW())`, [track.url])
                                        Logger.printLine('Mixcloud-Pull', `Sent Mixcloud Download "${track.url}"`, 'debug');
                                    } else {
                                        Logger.printLine('Mixcloud-Pull', `Failed to send mixcloud download "${track.url}"`, 'error');
                                    }
                                })
                            }
                        }))
                    }
                } catch (err) {
                    Logger.printLine('Mixcloud-Get', `Failed to get valid response from the Mixcloud API for ${user.username}: ${err}`, 'error');
                }
            }))
        }
    }
    async function getCloudcasts(username) {
        return new Promise((resolve, reject) => {
            request({
                url: `http://api.mixcloud.com/${username}/cloudcasts/`,
                headers: {
                    Origin: "https://www.mixcloud.com/",
                    Referer: `https://www.mixcloud.com/${username}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36 Edg/88.0.705.74'
                }
            }, (error, response, body) => {
                if (error) { return reject(error) }
                if (!body) { return resolve([]) }
                const jsonResponse = JSON.parse(body);
                if (!jsonResponse.data) { return resolve([]); }
                const items = jsonResponse.data.map((obj) => {
                    return {
                        url: obj.url,
                        name: obj.name,
                        date: obj.created_time,
                        slug: obj.slug,
                    }
                });

                resolve(items)
            })
        })
    }
    async function getTrackURL(track) {
        return new Promise((resolve, reject) => {
            request({
                url: 'https://mixclouddownloader.net/'
            }, (error, response, body) => {
                try {
                    if (error) {
                        return reject(error)
                    }
                    if (!body) {
                        return resolve(false)
                    }

                    const $ = cheerio.load(body)
                    const csrfToken = $("input[name=csrf_token]")[0].attribs.value
                    request.post({
                        url: `https://mixclouddownloader.net/download-track/`,
                        headers: {
                            Origin: 'https://mixclouddownloader.net',
                            Referer: 'https://mixclouddownloader.net/',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36 Edg/88.0.705.74'
                        },
                        form: {
                            csrf_token: csrfToken,
                            'mix-url': track.url
                        }
                    }, (error, response, body) => {
                        try {
                            if (error) {
                                return reject(error)
                            }
                            if (!body) {
                                return resolve(false)
                            }

                            const $1 = cheerio.load(body)
                            const downloadURL = $1("a:contains('Download link')")[0].attribs.href

                            if (downloadURL.length > 0) {
                                resolve(downloadURL)
                            } else {
                                resolve(null)
                            }
                        } catch (e) {
                            return reject(error)
                        }
                    })
                } catch (e) {
                    return reject(error)
                }
            })
        })
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
    setInterval(() => {
        if (process.send && typeof process.send === 'function') {
            process.send('ready');
        }
    }, 60000);

    // Mixcloud
    if (systemglobal.Mixcloud_Interval) {
        getMixcloudPodcasts();
        Timers.set(`MixCloud`, setInterval(() => {
            getMixcloudPodcasts();
        }, parseInt(systemglobal.Mixcloud_Interval.toString())));
        Logger.printLine('MixCloud', `MixCloud Enabled`, 'info');
    }
    // MyFigureCollection
    if (systemglobal.MFC_Interval && systemglobal.MFC_Channel) {
        getFiguresOTD(systemglobal.MFC_Channel);
        Timers.set(`MFC${systemglobal.MFC_Channel}`, setInterval(() => {
            getFiguresOTD(systemglobal.MFC_Channel);
        }, parseInt(systemglobal.MFC_Interval.toString())));
        Logger.printLine('MyFigureCollection', `MyFigureCollection Enabled`, 'info');
    }
    // MPZero Cosplay
    if (systemglobal.MPZero_Channel && systemglobal.MPZero_Interval) {
        if (systemglobal.MPZero_Deep_Crawl) {
            const pageNum = fs.readFileSync('./mpz-backlog', "utf-8");
            if (pageNum && !isNaN(parseInt(pageNum))) {
                pullDeepMPZPage = parseInt(pageNum);
                if (pullDeepMPZPage < 1001) {
                    pullDeepMPZ(systemglobal.MPZero_Channel);
                }
            } else {
                Logger.printLine('MPZero', `Failed to read page number`, 'error');
            }
        }
        if (systemglobal.MPZero_Pages && systemglobal.MPZero_Pages.length > 0) {
            pullMPzero(systemglobal.MPZero_Pages, systemglobal.MPZero_Channel, (systemglobal.MPZero_Backlog));
            Timers.set(`MPZ${systemglobal.MPZero_Channel}`, setInterval(() => {
                pullMPzero(systemglobal.MPZero_Pages, systemglobal.MPZero_Channel, (systemglobal.MPZero_Backlog), false);
            }, parseInt(systemglobal.MPZero_Interval.toString())));
            Logger.printLine('MPZero', `MPZero Enabled`, 'info');
        } else {
            Logger.printLine('MPZero', `No Page URLs were added, Ignoring`, 'error');
        }
    }
    // SankakuComplex
    if (systemglobal.SankakuComplex_Pages && systemglobal.SankakuComplex_Interval) {
        if (systemglobal.SankakuComplex_Pages.length > 0) {
            systemglobal.SankakuComplex_Pages.filter(e => e.url.includes("sankakucomplex.com/") && e.channel ).forEach((e,i) => {
                getSankakuGallery(e.url, e.channel);
                Timers.set(`SCG${e.channel}${i}`, setInterval(async() => {
                    await getSankakuGallery(e.url, e.channel);
                }, parseInt(systemglobal.SankakuComplex_Interval.toString())));
                Logger.printLine('SankakuGallery', `SankakuComplex Enabled: ${e.url}`, 'info');
            });
        } else {
            Logger.printLine('SankakuGallery', `No Page URLs were added, Ignoring`, 'error');
        }
    }
})()
