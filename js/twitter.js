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
Kanmi Project - Twitter I/O System
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
	const facilityName = 'Twitter-Worker';

	const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
	const twitter = require('twit');
	const amqp = require('amqplib/callback_api');
	const fs = require('fs');
	const colors = require('colors');
	const probe = require('probe-image-size');
	const sharp = require('sharp');
	const crypto = require('crypto');
	const moment = require('moment');
	const minimist = require('minimist');
	const cron = require('node-cron');
	let args = minimist(process.argv.slice(2));

	let amqpConn = null;
	const RateLimiter = require('limiter').RateLimiter;

	const request = require('request').defaults({ encoding: null });
	const textToPicture = require('text-to-picture-kazari');

	const { getIDfromText, getURLfromText } = require('./utils/tools');
	const path = require("path");
	const Logger = require('./utils/logSystem')(facilityName);
	const db = require('./utils/shutauraSQL')(facilityName);

	let discordaccount;
	let twitteraccount;

	let overflowControl = new Map();
	let activeTasks = new Map();
	let twitterAccounts = new Map();
	let twitterFlowTimers = new Map();
	let twitterFlowState = new Map();

	if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
		systemglobal.MQServer = process.env.MQ_HOST.trim()
	if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
		systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
	if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
		systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

	async function loadDatabaseCache() {
		Logger.printLine("SQL", "Getting System Parameters", "debug")
		const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (application = 'twitter' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName])
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
			const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
			if (_home_guild.length > 0 && _home_guild[0].param_value) {
				systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
			}
			const _mq_discord_out = systemparams_sql.filter(e => e.param_key === 'mq.discord.out');
			if (_mq_discord_out.length > 0 && _mq_discord_out[0].param_value) {
				systemglobal.Discord_Out = _mq_discord_out[0].param_value;
			}
			const _mq_seq_in = systemparams_sql.filter(e => e.param_key === 'mq.sequenzia.in');
			if (_mq_seq_in.length > 0 && _mq_seq_in[0].param_value) {
				systemglobal.Sequenzia_In = _mq_seq_in[0].param_value;
			}
			const _mq_fw_in = systemparams_sql.filter(e => e.param_key === 'mq.fileworker.in');
			if (_mq_fw_in.length > 0 && _mq_fw_in[0].param_value) {
				systemglobal.FileWorker_In = _mq_fw_in[0].param_value;
			}
			const _mq_twit_in = systemparams_sql.filter(e => e.param_key === 'mq.twitter.in');
			if (_mq_twit_in.length > 0 && _mq_twit_in[0].param_value) {
				systemglobal.Twitter_In = _mq_twit_in[0].param_value;
			}
			const _twitter_account = systemparams_sql.filter(e => e.param_key === 'twitter.account' && e.param_data && e.account);
			if (_twitter_account.length > 0)
				systemglobal.Twitter_Accounts = _twitter_account.map(e => {
					console.log(e.param_data)
					return {
						id: e.account,
						...e.param_data
					}
				})
			// {"access_token": "", "consumer_key": "", "access_secret": "", "consumer_secret": ""}
			const _limiter1 = systemparams_sql.filter(e => e.param_key === 'twitter.limiter.get_timeline');
			if (_limiter1.length > 0 && _limiter1[0].param_value)
				systemglobal.Twitter_Timeline_Pull = _limiter1[0].param_value
			const _limiter2 = systemparams_sql.filter(e => e.param_key === 'twitter.limiter.upload_media');
			if (_limiter2.length > 0 && _limiter2[0].param_value)
				systemglobal.Twitter_MediaUpload_Delay = _limiter2[0].param_value
			const _limiter3 = systemparams_sql.filter(e => e.param_key === 'twitter.limiter.get_mention');
			if (_limiter3.length > 0 && _limiter3[0].param_value)
				systemglobal.Twitter_Mention_Pull = _limiter3[0].param_value
		}

		Logger.printLine("SQL", "Getting Discord Accounts (Selective Fields)", "debug")
		const _discordservers = await db.query(`SELECT chid_system, chid_download FROM discord_servers WHERE serverid = ?`, [systemglobal.DiscordHomeGuild])
		if (_discordservers.error) { Logger.printLine("SQL", "Error getting discord servers records!", "emergency", _discordservers.error); return false }
		discordaccount = _discordservers.rows;

		Logger.printLine("SQL", "Getting Twitter Accounts", "debug")
		const _twitteraccount = await db.query(`SELECT * FROM twitter_accounts`)
		if (_twitteraccount.error) { Logger.printLine("SQL", "Error getting discord servers records!", "emergency", _twitteraccount.error); return false }
		twitteraccount = _twitteraccount.rows;
	}
	await loadDatabaseCache();
	if (args.whost) {
		systemglobal.Watchdog_Host = args.whost
	}
	if (args.wid) {
		systemglobal.Watchdog_ID = args.wid
	}
	const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

	Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug")

	const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`
	const MQWorker1 = `${systemglobal.Twitter_In}`
	// Twitter Timeline Checkins
	const limiter1 = new RateLimiter(1, (systemglobal.Twitter_Timeline_Pull) ? parseInt(systemglobal.Twitter_Timeline_Pull.toString()) * 1000 : 1000);
	const limiter5 = new RateLimiter(75, 15 * 60 * 1000);
	// RabbitMQ
	const limiter3 = new RateLimiter(10, 1000);
	// Twitter Media Upload
	const limiter2 = new RateLimiter(14, (systemglobal.Twitter_MediaUpload_Delay) ? parseInt(systemglobal.Twitter_MediaUpload_Delay.toString()) * 1000 : 90000);
	// Twitter Mention
	const limiter4 = new RateLimiter(1, (systemglobal.Twitter_Mention_Pull) ? parseInt(systemglobal.Twitter_Mention_Pull.toString()) * 1000 : 1000);
	let Twitter = null;

	await Promise.all(systemglobal.Twitter_Accounts.map(account => {
		if (account.id && account.consumer_key && account.consumer_secret && account.access_token && account.access_token_secret) {
			Logger.printLine("Twitter", "Settings up Twitter Client using account #" + account.id, "debug")
			if (account.flowcontrol)
				Logger.printLine("Twitter", `NOTE: Flow Control is enabled on account #${account.id}`, "debug")
			twitterAccounts.set(parseInt(account.id.toString()), {
				client: new twitter({
					consumer_key : account.consumer_key,
					consumer_secret : account.consumer_secret,
					access_token : account.access_token,
					access_token_secret : account.access_token_secret,
					strictSSL: true,
					env: (account.env) ? account.env : 'dev',
				}),
				config: twitteraccount.filter(e => e.taccount === parseInt(account.id.toString())).pop(),
				flowcontrol: (account.flowcontrol) ? account.flowcontrol : false
			})
		} else {
			Logger.printLine("Twitter", `Missing Twitter Bot Login Properties for account ${account.id}, Please verify that they exists in the configuration file or the global_parameters table`, "emergency");
		}
	}))

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
				Logger.printLine("KanmiMQ", "Channel 1 Closed", "critical" )
				start();
			});
			ch.prefetch(10);
			ch.assertQueue(MQWorker1, { durable: true }, function(err, _ok) {
				if (closeOnErr(err)) return;
				ch.consume(MQWorker1, processMsg, { noAck: false });
				Logger.printLine("KanmiMQ", "Channel 1 Worker Ready", "debug")
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
		try {
			const accountID = (MessageContents.accountID) ? MessageContents.accountID : 1;
			const twit = twitterAccounts.get(accountID)
			if (twit.flowcontrol && MessageContents.messageIntent && MessageContents.messageAction === "send" && MessageContents.messageIntent === 'SendTweet') {
				let EditedMessage = MessageContents;
				if (MessageContents.messageFileData) {
					function parseImage(imageSize, media, url, numOfMedia, resultImage) {
						if (imageSize.length / 1000000 > 5 ){
							Logger.printLine("TwitterMedia", `File is to large for Twitter, will resize it down`, "info", imageSize)
							const scaleSize = 2500 // Lets Shoot for 2100?
							let resizeParam = {
								fit: sharp.fit.inside,
								withoutEnlargement: true
							}
							if (imageSize.width > imageSize.height) { // Landscape Resize
								resizeParam.width = scaleSize
							} else { // Portrait or Square Image
								resizeParam.height = scaleSize
							}
							sharp(Buffer.from(media))
								.resize(resizeParam)
								.toFormat('jpg')
								.withMetadata()
								.toBuffer({resolveWithObject: true})
								.then(({data, info}) => {
									resultImage(data.toString('base64'));
								})
								.catch(err => {
									Logger.printLine("TwitterMedia", `File failed to resize media for sending Tweet! ${url}`, "error", err)
									resultImage(false);
								})
						} else {
							resultImage(media.toString('base64'));
						}
					}
					probe(MessageContents.messageFileData[0].url).then(imageSize => {
						request.get({
							url: MessageContents.messageFileData[0].url,
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
								Logger.printLine("TwitterMedia", `File failed to download media for storing Tweet! ${MessageContents.messageFileData[0].url}`, "error", err, res)
								cb(true);
							} else {
								parseImage(imageSize, body, MessageContents.messageFileData[0].url, 1, (resultImage) => {
									if (resultImage) {
										const hash = `MEDIA-${crypto.randomBytes(15).toString("hex")}`
										const filePath = path.join(process.cwd(),`/data/flow_storage_${accountID}`, '/' + hash)
										fs.writeFile(filePath, resultImage, err1 => {
											if (err1) {
												Logger.printLine("TwitterMedia", `File failed to save media for storing Tweet! ${MessageContents.messageFileData[0].url}`, "error", err1);
												cb(true);
											} else {
												EditedMessage.messageFileData = [ hash ];
												EditedMessage.messageFileType = 'hash';
												storeTweet(EditedMessage, cb);
											}
										})
									} else {
										Logger.printLine("TwitterMedia", `File generate media for storing Tweet! ${MessageContents.messageFileData[0].url}`, "error");
										cb(true);
									}
								})
							}
						})
					})
						.catch(err => {
							Logger.printLine("TwitterMedia", `File failed to resize media for storing Tweet! ${MessageContents.messageFileData[0].url}`, "error", err);
							cb(true);
						})
				}
			} else if (twit.flowcontrol && MessageContents.messageIntent && MessageContents.messageAction === "add" && (MessageContents.messageIntent === 'Like' || MessageContents.messageIntent === 'Retweet' || MessageContents.messageIntent === 'LikeRT')) {
				let id = undefined
				if (MessageContents.messageEmbeds && MessageContents.messageEmbeds.length > 0 && MessageContents.messageEmbeds[0].title && (MessageContents.messageEmbeds[0].title.includes('📨 Tweet') || MessageContents.messageEmbeds[0].title.includes('✳ Retweet'))) {
					id = MessageContents.messageEmbeds[0].url.split("/").pop();
				} else if (MessageContents.messageEmbeds && MessageContents.messageEmbeds.title && (MessageContents.messageEmbeds.title.includes('📨 Tweet') || MessageContents.messageEmbeds.title.includes('✳ Retweet'))) {
					id = MessageContents.messageEmbeds.url.split("/").pop();
				} else if (MessageContents.messageText.length > 0) {
					id = getIDfromText(MessageContents.messageText)
				}
				if (id) {
					db.safe(`SELECT * FROM twitter_tweet_queue WHERE taccount = ? AND id = ? LIMIT 1`, [accountID, id], async (err, tweetQueue) => {
						if (err) {
							Logger.printLine(`Collector`, `Failed to get tweet from collector due to an SQL error`, `error`, err);
							cb(true);
						} else if (tweetQueue && tweetQueue.length === 0) {
							limiter1.removeTokens(1, async function () {
								twit.client.get('statuses/show', {id: id}, function (err, tweets) {
									if (!err) {
										storeTweet(MessageContents, cb);
									} else {
										console.log(err);
										cb(true);
									}
								});
							})
						} else {
							console.log('Ignored, already added')
							cb(true);
						}
					})
				}
			} else if (twit.flowcontrol && MessageContents.messageIntent && MessageContents.messageAction === "remove" && (MessageContents.messageIntent === 'Like' || MessageContents.messageIntent === 'Retweet' || MessageContents.messageIntent === 'LikeRT')) {
				removeTweet(MessageContents, cb);
			} else {
				limiter3.removeTokens(1, function () {
					doAction(MessageContents, cb);
				});
			}
		} catch (e) {
			cb(true);
			Logger.printLine(`KanmiMQ`, `Uncaught Exception in message parser : ${e.message}`, `critical`, e);
			console.error(e)
		}
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
	function whenConnected() {
		startWorker();
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
			Array.from(twitterAccounts.entries()).forEach(e => {
				const id = e[0];
				const twit = e[1];

				Logger.printLine("Twitter", `Twitter Client #${id} is ready!`, "info")
				if (twit.config.activitychannelid === null) {
					Logger.printLine("Twitter", ` - Mentions for account are disabled`, "debug");
				}
				if (twit.flowcontrol) {
					if (!fs.existsSync(path.join(process.cwd(),`/data/flow_storage_${id}`)))
						fs.mkdirSync(path.join(process.cwd(),`/data/flow_storage_${id}`));

					twitterFlowState.set(id, 1)
					if (twit.flowcontrol.schedule && cron.validate(twit.flowcontrol.schedule)) {
						twitterFlowTimers.set(`flow_normal_${id}`, cron.schedule(twit.flowcontrol.schedule, () => {
							releaseTweet(id)
						}, {
							scheduled: true
						}));
						Logger.printLine("Twitter", ` - Flow Control schedule is "${twit.flowcontrol.schedule}"`, "debug")
						if (twit.flowcontrol.schedule_min && cron.validate(twit.flowcontrol.schedule_min)) {
							twitterFlowTimers.set(`flow_low_${id}`, cron.schedule(twit.flowcontrol.schedule_min, () => {
								releaseTweet(id)
							}, {
								scheduled: false
							}));
							Logger.printLine("Twitter", ` - Under Flow Control schedule is "${twit.flowcontrol.schedule_min}"`, "debug")
						}
						if (twit.flowcontrol.schedule_max && cron.validate(twit.flowcontrol.schedule_max)) {
							twitterFlowTimers.set(`flow_max_${id}`, cron.schedule(twit.flowcontrol.schedule_max, () => {
								releaseTweet(id)
							}, {
								scheduled: false
							}));
							Logger.printLine("Twitter", ` - Over Flow Control schedule is "${twit.flowcontrol.schedule_max}"`, "debug")
						}
					} else {
						cron.schedule('*/30 * * * *', () => {
							releaseTweet(id)
						});
						Logger.printLine("Twitter", " - Flow Control schedule is every 30 min, Using defaults", "error");
					}
				}
			})
			verifyQueue(); updateStats();
			cron.schedule('* * * * *', () => {

			});
			cron.schedule('*/5 * * * *', () => {
				updateStats();
				getTweets();
				getMentions();
				getLikes();
			});
			cron.schedule('4,34 * * * *', verifyQueue);
		})
		if (process.send && typeof process.send === 'function') {
			process.send('ready');
		}
	}

	// Twitter Functions
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
	function getImagetoB64(imageURL, referer, returnedImage) {
		request.get({
			url: imageURL,
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
				Logger.printLine("TweetDownload", "Failed to download the image", "error", err)
				console.error(err)
				returnedImage(null)
			} else {
				const imageBuffer = Buffer.from(body)
				const fileSizeInMegabytes = imageBuffer.byteLength / 1000000.0;
				if (fileSizeInMegabytes > 7.8) {
					resizeImage(imageBuffer, function (data) {
						if (data !== false) {
							returnedImage(data)
						} else {
							Logger.printLine("TweetDownload", "Failed to resize the image", "error")
							returnedImage(null);
						}
					})
				} else {
					returnedImage(imageBuffer.toString('base64'))
				}
			}
		})
	}
	function sendTweetToDiscordv2(obj) {
		return new Promise(cb => {
			const twit = twitterAccounts.get(obj.accountid);
			let textContents = obj.tweet.text.split('https://t.co/')[0].trim()
			if (textContents.includes('#'))
				textContents = textContents.replace(/#+([a-zA-Z0-9_]+)/ig, v => `[${v}](https://twitter.com/hashtag/${v.substring(1)})`)
			if (textContents.includes('@'))
				textContents = textContents.replace(/@+([a-zA-Z0-9_]+)/ig, v => `[${v}](https://twitter.com/${v.substring(1)})`)
			let messageObject = {
				"title": `📨 Tweet`,
				"description": textContents,
				"url": `https://twitter.com/${obj.tweet.user.screen_name}/status/${obj.tweet.id_str}`,
				"color": 4886750 + obj.list_num,
				"timestamp": new Date(Date.parse(obj.tweet.created_at.replace(/( \+)/, ' UTC$1'))).toISOString(),
				"image": {
					"url" : null
				},
				"author": {
					"name": `${obj.tweet.user.name} (@${obj.tweet.user.screen_name})`,
					"url": `https://twitter.com/${obj.tweet.user.screen_name}/`,
					"icon_url": obj.tweet.user.profile_image_url
				},
				"footer": {
					"icon_url": null,
					"text": "Twitter"
				}
			}
			let messageText = undefined
			let reactions = [];
			let rt_stat = false;
			let rt_user = '';
			if (obj.nsfw === 0 || obj.disablelike === 1) {
				if (!(obj.mergelike === 1)) {
					reactions.push("Like");
					reactions.push("Retweet");
				} else { reactions.push("LikeRT"); }
				if (obj.replyenabled === 1 && obj.channelid !== twit.config.activitychannelid) { reactions.push("ReplyTweet"); }
			}
			if (obj.tweet.retweeted_status) {
				messageText = `${moment(Date.now()).format('HH:mm')}`
				messageObject.title = `✳ Retweet`;
				messageObject.description = obj.tweet.retweeted_status.text.split('https://t.co/')[0].trim();
				messageObject.url = `https://twitter.com/${obj.tweet.retweeted_status.user.screen_name}/status/${obj.tweet.retweeted_status.id_str}`;
				messageObject.color = 11140940 + obj.list_num;
				messageObject.timestamp = new Date(Date.parse(obj.tweet.retweeted_status.created_at.replace(/( \+)/, ' UTC$1'))).toISOString();
				messageObject.author.name = `${obj.tweet.retweeted_status.user.name} (@${obj.tweet.retweeted_status.user.screen_name})`;
				messageObject.author.icon_url = obj.tweet.retweeted_status.user.profile_image_url;
				messageObject.footer.text = `from ${obj.tweet.user.name} (@${obj.tweet.user.screen_name})`
				messageObject.footer.icon_url = obj.tweet.user.profile_image_url

				rt_user = obj.tweet.retweeted_status.user.name;
				rt_stat = true;
			} else if (obj.fromname === "Mention") {
				messageObject.color = 16759360;
				messageObject.footer.text = `🆔:${obj.accountid}`
				messageObject.footer.icon = undefined
				if (twit.config.activity_userid)
					messageText = `<@${twit.config.activity_userid}>`;
			} else {
				messageText = `${moment(Date.now()).format('HH:mm')}`
				messageObject.footer.icon = undefined;
			}
			if (obj.tweet.entities.media)
				reactions.push("Download")
			if (rt_stat && obj.tweet.user.screen_name !== rt_user && (obj.listusers && obj.listusers.length > 0 && obj.listusers.filter(e => { return e.screen_name.toLowerCase() === rt_user.toLowerCase() }).length === 0 ))
				reactions.push("AddUser")
			if (obj.tweet.extended_entities && obj.tweet.extended_entities.media && obj.tweet.extended_entities.media.length > 0 && obj.tweet.extended_entities.media[0].type === 'photo') {
				let mediaObject = [];
				if (obj.tweet.extended_entities && obj.tweet.extended_entities.media) { mediaObject = obj.tweet.extended_entities.media; } else if (obj.tweet.entities.media) { mediaObject = obj.tweet.entities.media; }
				let messageArray = [];
				let requests = mediaObject.reduce((promiseChain, media, index, array) => {
					return promiseChain.then(() => new Promise((resolve) => {
						if (media.type === 'photo') {
							messageObject.video = undefined;
							const filename = `${obj.tweet.user.screen_name}-${obj.tweet.id_str}.${media.media_url.split('.').pop()}`
							getImagetoB64(`${media.media_url}:large`, null, (image) => {
								let _title = messageObject.title;
								if (array.length > 1 && index === array.length -1) {
									_title += ` (${index + 1} of ${array.length}) ↩️`;
								} else if (array.length > 1) {
									_title += ` (${index + 1} of ${array.length}) ⤵️`;
								}
								let _react = [];
								messageObject.description = obj.tweet.text.split('https://t.co/')[0].trim();
								if (index !== array.length -1 ) {
									//messageObject.description = undefined;
									_react = ['Download'];
								} else {
									_react = reactions;
								}
								if (image !== null) {
									Logger.printLine("TweetDownload", `Account ${obj.accountid}: Got ${media.media_url}:large`, "debug", { url: `${media.media_url}:large` })
									messageObject.image.url = `attachment://${filename}`
									db.safe(`SELECT * FROM twitter_autodownload WHERE LOWER(username) = ?`, [(obj.tweet.retweeted_status) ? obj.tweet.retweeted_status.user.screen_name.toLowerCase() : obj.tweet.user.screen_name.toLowerCase()], (err, autodownload) => {
										if (err) {
											Logger.printLine("SQL", `Error looking up autodownload for ${(obj.tweet.retweeted_status) ? obj.tweet.retweeted_status.user.screen_name.toLowerCase() : obj.tweet.user.screen_name.toLowerCase()}!`, "error", err);
										}
										if ((!err && autodownload && autodownload.length > 0) || (obj.bypasscds && obj.bypasscds === 1)) {
											db.safe(`SELECT channelid FROM twitter_user_redirect WHERE LOWER(twitter_username) = ?`, [(obj.tweet.retweeted_status) ? obj.tweet.retweeted_status.user.screen_name.toLowerCase() : obj.tweet.user.screen_name.toLowerCase()], function (err, channelreplacement) {
												if (err) {
													Logger.printLine("SQL", `SQL Error when getting to the Twitter Redirect records`, "error", err)
												}
												messageArray.push({
													fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
													messageType : 'sfile',
													messageReturn: false,
													messageChannelID : (!err && channelreplacement.length > 0) ? channelreplacement[0].channelid : obj.saveid,
													itemFileData: image,
													itemFileName: filename,
													messageText: `**🌁 Twitter Image** - ***${messageObject.author.name}***${(messageObject.description && messageObject.description.length > 0) ? '\n**' + messageObject.description + '**' : ''}`,
													tweetMetadata: {
														account: obj.accountid,
														list: obj.list_id,
														id: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.id_str)) ? obj.tweet.retweeted_status.id_str : obj.tweet.id_str,
														userId: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name,
													}
												})
												resolve();
											})
										} else if (obj.channelid !== null || obj.channelid !== 0) {
											messageArray.push({
												fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
												messageType : 'sfileext',
												messageReturn: false,
												messageChannelID : obj.channelid,
												itemFileData: image,
												itemFileName: filename,
												messageText: messageText,
												messageObject: {...messageObject, title: _title},
												addButtons : _react,
												tweetMetadata: {
													account: obj.accountid,
													list: obj.list_id,
													id: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.id_str)) ? obj.tweet.retweeted_status.id_str : obj.tweet.id_str,
													userId: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name,
												}
											});
											resolve();
										} else {
											resolve();
										}
									})
								} else if (obj.channelid !== null) {
									messageObject.image.url = `${media.media_url}:large`
									messageArray.push({
										fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
										messageType : 'sobj',
										messageReturn: false,
										messageChannelID : obj.channelid,
										messageText: messageText,
										messageObject: {...messageObject, title: _title},
										addButtons : _react,
										tweetMetadata: {
											account: obj.accountid,
											list: obj.list_id,
											id: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.id_str)) ? obj.tweet.retweeted_status.id_str : obj.tweet.id_str,
											userId: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name,
										}
									})
									resolve();
								}
							})
						} else {
							Logger.printLine("Twitter", `Account ${obj.accountid}: Unhandled Media Type "${media.type}" for Tweet in ${obj.fromname} from ${obj.tweet.user.screen_name} - RT: ${rt_stat}`, "error", {
								tweetList: obj.fromname,
								tweetUser: obj.tweet.user.screen_name,
								tweetID: obj.tweet.id_str,
								tweetText: obj.tweet.text,
								tweetType: "media",
								tweetAction: 'allow',
								tweetRT : rt_stat.toString(),
							})
							resolve();
						}
					}))
				}, Promise.resolve());
				requests.then(() => {
					Logger.printLine("Twitter", `Account ${obj.accountid}: New Media Tweet in ${obj.fromname} from ${obj.tweet.user.screen_name} - RT: ${rt_stat}`, "info", {
						tweetList: obj.fromname,
						tweetUser: obj.tweet.user.screen_name,
						tweetID: obj.tweet.id_str,
						tweetText: obj.tweet.text,
						tweetType: "media",
						tweetAction: 'allow',
						tweetRT : rt_stat.toString(),
					})
					cb(messageArray);
				})
			} else if (((obj.tweet.extended_entities && obj.tweet.extended_entities.media) || obj.tweet.entities.media) && (!obj.bypasscds || (obj.bypasscds && obj.bypasscds === 1 && obj.channelid !== null))) {
				let messageContents = `📨 __***${obj.tweet.user.name} (@${obj.tweet.user.screen_name})***__\n`  + "```" + obj.tweet.text + "```\n" +
					"https://twitter.com/" + obj.tweet.user.screen_name + "/status/" + obj.tweet.id_str;
				cb([{
					fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
					messageType : 'stext',
					messageReturn: false,
					messageChannelID : obj.channelid,
					messageText: messageContents + ' ' + messageText,
					addButtons : reactions,
					tweetMetadata: {
						account: obj.accountid,
						list: obj.list_id,
						id: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.id_str)) ? obj.tweet.retweeted_status.id_str : obj.tweet.id_str,
						userId: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name,
					}
				}]);
			} else if (!obj.bypasscds || (obj.bypasscds && obj.bypasscds === 1 && obj.channelid !== null)) {
				if (obj.txtallowed === 1) {
					Logger.printLine("Twitter", `Account ${obj.accountid}: New Text Tweet in ${obj.fromname} from ${obj.tweet.user.screen_name} - RT: ${rt_stat}`, "info", {
						tweetList: obj.fromname,
						tweetUser: obj.tweet.user.screen_name,
						tweetID: obj.tweet.id_str,
						tweetText: obj.tweet.text,
						tweetType: "text",
						tweetAction: 'allow',
						tweetRT : rt_stat.toString(),
					})
					messageObject.image = undefined;
					messageObject.video = undefined;
					cb([{
						fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
						messageType : 'sobj',
						messageReturn: false,
						messageChannelID : obj.channelid,
						messageText: messageText,
						messageObject: messageObject,
						addButtons : reactions,
						tweetMetadata: {
							account: obj.accountid,
							list: obj.list_id,
							id: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.id_str)) ? obj.tweet.retweeted_status.id_str : obj.tweet.id_str,
							userId: ((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name,
						}
					}]);
				} else {
					/*Logger.printLine("Twitter", `Blocked Text Tweet in ${obj.fromname} from ${obj.tweet.user.screen_name} - RT: ${rt_stat}`, "warn", {
                        tweetList: obj.fromname,
                        tweetUser: obj.tweet.user.screen_name,
                        tweetID: obj.tweet.id_str,
                        tweetText: obj.tweet.text,
                        tweetType: "text",
                        tweetAction: 'block',
                        tweetRT : rt_stat.toString(),
                    })*/
					cb([]);
				}
			} else {
				cb([]);
			}
		})
	}

	function updateStats() {
		Array.from(twitterAccounts.entries()).forEach(e => {
			const twitterUser = parseInt(e[0].toString())
			const twit = e[1]
			if (twit.flowcontrol) {
				db.safe(`SELECT * FROM twitter_tweet_queue WHERE taccount = ?`, [twitterUser],(err, tweetQueue) => {
					if (err) {
						Logger.printLine(`Collector`, `Failed to get tweet to collector via SQL`, `error`, err);
					} else if (tweetQueue) {
						const rtCollection = tweetQueue.filter(e => { return e.action === 3 }).length;
						const likeCollection = tweetQueue.filter(e => { return e.action === 2 }).length;
						const likeRtCollection = tweetQueue.filter(e => { return e.action === 1 }).length;
						const sendCollection = tweetQueue.filter(e => { return e.action === 4 }).length;
						const stats = rtCollection + ((sendCollection > likeRtCollection) ? sendCollection : likeRtCollection)

						Logger.printLine(`Collector`, `Account ${twitterUser}: Current Collector Stacks - Like: ${likeCollection} Retweet: ${rtCollection} LikeRT: ${likeRtCollection} Send: ${sendCollection}`, `info`);

						if (stats < ((twit.flowcontrol.volume.min) ? twit.flowcontrol.volume.min : 64) && twitterFlowTimers.has(`flow_low_${twitterUser}`)) {
							if (twitterFlowState.get(twitterUser) !== 0) {
								if (twitterFlowTimers.has(`flow_max_${twitterUser}`))
									twitterFlowTimers.get(`flow_max_${twitterUser}`).stop()
								twitterFlowTimers.get(`flow_normal_${twitterUser}`).stop()
								twitterFlowTimers.get(`flow_low_${twitterUser}`).start()
								overflowControl.set(twitterUser, 0)
								twitterFlowState.set(twitterUser, 0)
							}
						} else if (stats > ((twit.flowcontrol.volume.max) ? twit.flowcontrol.volume.max : 1500) && twitterFlowTimers.has(`flow_max_${twitterUser}`)) {
							if (twitterFlowState.get(twitterUser) !== 2) {
								if (twitterFlowTimers.has(`flow_low_${twitterUser}`))
									twitterFlowTimers.get(`flow_low_${twitterUser}`).stop()
								twitterFlowTimers.get(`flow_normal_${twitterUser}`).stop()
								twitterFlowTimers.get(`flow_max_${twitterUser}`).start()
								overflowControl.set(twitterUser, ((twit.flowcontrol.max_rate) ? twit.flowcontrol.max_rate : 1))
								twitterFlowState.set(twitterUser, 2)
							}
						} else if (stats > ((twit.flowcontrol.volume.max) ? twit.flowcontrol.volume.max : 1500)) {
							if (twitterFlowState.get(twitterUser) !== 2) {
								const _fcc = ((twit.flowcontrol.volume.max) ? twit.flowcontrol.volume.max : 1500) / ((twit.flowcontrol.max_divide) ? twit.flowcontrol.volume.max_divide : 500)
								if (_fcc < 1) {
									overflowControl.set(twitterUser, 0)
								} else {
									overflowControl.set(twitterUser, _fcc.toFixed(0))
								}
							}
						} else {
							if (twitterFlowState.get(twitterUser) !== 1) {
								if (twitterFlowTimers.has(`flow_max_${twitterUser}`))
									twitterFlowTimers.get(`flow_max_${twitterUser}`).stop()
								if (twitterFlowTimers.has(`flow_low_${twitterUser}`))
									twitterFlowTimers.get(`flow_low_${twitterUser}`).stop()
								twitterFlowTimers.get(`flow_normal_${twitterUser}`).start()
								overflowControl.set(twitterUser, 0)
								twitterFlowState.set(twitterUser, 1)
							}
						}

						if (twit.flowcontrol.status_name) {
							let messageText = ''
							let messageIcon = ''
							if (twit.config.short_name) {
								messageText += `${twit.config.short_name} `
							}

							if (stats <= ((twit.flowcontrol.volume.empty) ? twit.flowcontrol.volume.empty : 4)) {
								messageIcon = '🛑'
							} else if (stats <= ((twit.flowcontrol.volume.min) ? twit.flowcontrol.volume.min : 64)) {
								messageIcon = '⚠'
							} else if (stats <= ((twit.flowcontrol.volume.warning) ? twit.flowcontrol.volume.warning : 128)) {
								messageIcon = '🟢'
							} else if (stats >= ((twit.flowcontrol.volume.max) ? twit.flowcontrol.volume.max : 1500)) {
								messageIcon = '🌊'
							} else {
								messageIcon = '✅'
							}
							if (stats >= 1 ) {
								messageText += `${messageIcon} ${stats}`
							} else {
								messageText += `${messageIcon} Sleeping`
							}

							mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
								fromClient: `return.${facilityName}.${e[0]}.${systemglobal.SystemName}`,
								messageReturn: false,
								messageChannelID: '0',
								messageChannelName: twit.flowcontrol.status_name,
								messageType: 'status',
								messageData: {
									flowName: twit.config.name,
									flowIcon: twit.config.short_name,
									flowCountTotal: stats,
									flowCountSend: sendCollection,
									flowCountLikeRt: likeRtCollection,
									flowCountLike: likeCollection,
									flowCountRt: rtCollection,
									flowVolume: twit.flowcontrol.volume,
									flowMode: twitterFlowState.get(twitterUser),
									flowMinAlert: twit.flowcontrol.min_alert,
									flowMaxAlert: twit.flowcontrol.max_alert,
									statusText: messageText,
									statusIcon: messageIcon,
									accountShortName: twit.config.short_name,
									accountName: twit.config.name,
								},
								updateIndicators: true
							}, (ok) => { if (!ok) { console.error('Failed to send update to MQ') } })
						}
					}
				})
			}
		})
	}
	async function verifyQueue() {
		const _tweetQueue = await db.query(`SELECT * FROM twitter_tweet_queue ORDER BY RAND() LIMIT 100`)
		if (_tweetQueue.errors) {
			Logger.printLine(`Collector`, `Failed to get tweet from collector due to an SQL error`, `error`, _tweetQueue.errors);
		} else {
			Array.from(twitterAccounts.entries()).forEach(async e => {
				const twit = e[1];
				const twitterUser = parseInt(e[0].toString());
				const tweetQueue = _tweetQueue.rows.filter(e => e.taccount === twitterUser)

				if (tweetQueue.length > 0) {
					await Promise.all(tweetQueue.filter(e => e.action === 4).map(async (tweet) => {
						if (tweet.action === 4) {
							if ((fs.existsSync(path.join(process.cwd(),`/data/flow_storage_${twitterUser}`, '/' + tweet.id))) === false) {
								Logger.printLine(`Collector`, `Account ${twitterUser}: Removed dead tweet ${tweet.id} from the collector!`, `info`);
								await db.query(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ? AND action = ?`, [ twitterUser, tweet.id, tweet.action ])
							}
						} else {
							await limiter1.removeTokens(1, async function () {
								await twit.client.get('statuses/show', { id: tweet.id.toString() }, async (err, tweetData) => {
									if (err || !tweetData || (tweetData && ( tweetData.favorited || tweetData.retweeted ) ) ) {
										Logger.printLine(`Collector`, `Account ${twitterUser}: Removed dead tweet ${tweet.id} from the collector!`, `info`);
										await db.safe(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ? AND action = ?`, [ twitterUser, tweet.id.toString(), tweet.action ], (err, results) => {
											if (err) {
												Logger.printLine(`Collector`, `Failed to delete tweet from collector due to an SQL error`, `error`, err);
											}
										});
									}
								});
							})
						}
					}))
				}
			})
		}
	}
	function storeTweet(message, cb) {
		try {
			if (message && message.messageIntent) {
				let twitterUser = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
				let actionID = ((x) => {
					switch (x) {
						case "LikeRT":
							return 1
						case "Like":
							return 2
						case "Retweet":
							return 3
						case "SendTweet":
							return 4
						default:
							return null
					}
				})(message.messageIntent);
				let tweetID = ((x, y, z) => {
					if (z) {
						return null
					} else if (x && x.length > 0 && x[0].title && (x[0].title.includes('📨 Tweet') || x[0].title.includes('✳ Retweet'))) {
						return x[0].url.split("/").pop().toString()
					} else  if (x && x.title && (x.title.includes('📨 Tweet') || x.title.includes('✳ Retweet'))) {
						return x.url.split("/").pop().toString()
					} else if (y.length > 0) {
						return getIDfromText(y).toString()
					} else {
						return null
					}
				})(message.messageEmbeds, message.messageText, (message.messageIntent === 'SendTweet'));

				if (message.messageIntent === 'SendTweet') {
					const json = JSON.stringify(message);
					db.safe(`INSERT INTO twitter_tweet_queue SET taccount = ?, action = ?, id = ?, data = ?`, [twitterUser, actionID, message.messageFileData, json], (err, savedResult) => {
						if (err) {
							Logger.printLine(`Collector`, `Failed to save send tweet into collector due to an SQL error : ${err.sqlMessage}`, `error`, err);
							cb(true);
						} else if (savedResult && savedResult.affectedRows > 0) {
							Logger.printLine(`Collector`, `Account ${twitterUser}: Saved Send Tweet to collector as "${message.messageText}"`, `info`);
							cb(true);
						} else {
							Logger.printLine(`Collector`, `Account ${twitterUser}: Unable to save send Tweet to collector as "${tweetID}"`, `warning`);
							cb(true);
						}
					})
				} else if (tweetID && actionID) {
					db.safe(`INSERT INTO twitter_tweet_queue SET taccount = ?, action = ?, id = ?`, [twitterUser, actionID, tweetID], (err, savedResult) => {
						if (err) {
							Logger.printLine(`Collector`, `Failed to save tweet into collector due to an SQL error : ${err.sqlMessage}`, `error`, err);
							cb(true);
						} else if (savedResult && savedResult.affectedRows > 0) {
							Logger.printLine(`Collector`, `Account ${twitterUser}: Saved Tweet to collector as "${tweetID}"`, `info`);
							cb(true);
						} else {
							Logger.printLine(`Collector`, `Account ${twitterUser}: Unable to save Tweet to collector as "${tweetID}"`, `warning`);
							cb(true);
						}
					})
				} else {
					Logger.printLine(`Collector`, `Account ${twitterUser}: Unable to save Tweet to collector as "${tweetID}" due to invalid data : No Tweet ID or ActionID`, `error`);
					cb(true);
				}
			} else {
				Logger.printLine(`Collector`, `Unable to save Tweet to collector due to invalid data : No Intent`, `error`);
				cb(true);
			}
		} catch (err) {
			Logger.printLine(`Collector`, `Failed to save tweet into collector due to a uncaught error`, `error`, err);
			console.error(err)
			cb(true);
		}
	}
	function removeTweet(message, cb) {
		try {
			if (message && message.messageIntent) {
				let twitterUser = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
				let tweetID = ((x, y) => {
					if (x && x.length > 0 && x[0].title && (x[0].title.includes('📨 Tweet') || x[0].title.includes('✳ Retweet'))) {
						return x[0].url.split("/").pop().toString()
					} else if (x && x.title && (x.title.includes('📨 Tweet') || x.title.includes('✳ Retweet'))) {
						return x.url.split("/").pop().toString()
					} else if (y.length > 0) {
						return getIDfromText(y).toString()
					} else {
						return null
					}
				}) (message.messageEmbeds, message.messageText);

				if (tweetID) {
					db.safe(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ?`, [twitterUser, tweetID], (err, results) => {
						if (err) {
							Logger.printLine(`Collector`, `Failed to save tweet into collector due to an SQL error : ${err.sqlMessage}`, `error`, err);
							cb(true);
						} else {
							Logger.printLine(`Collector`, `Account ${twitterUser}: Removed Tweet from collector as "${tweetID}"`, `info`);
							cb(true);
						}
					})
				} else {
					Logger.printLine(`Collector`, `Unable to delete Tweet from the collector as "${tweetID}" due to invalid data : No Tweet ID or ActionID`, `error`);
					cb(true);
				}
			} else {
				Logger.printLine(`Collector`, `Unable to delete Tweet from the collector due to invalid data : No Intent`, `error`);
				cb(true);
			}
		} catch (err) {
			Logger.printLine(`Collector`, `Failed to delete tweet from the collector due to a uncaught error`, `error`, err);
			cb(true);
		}
	}
	function clearCollector() {
		return false
	}
	function releaseTweet(twitterUser, action) {
		const overFlowValuse = (overflowControl.has((twitterUser) ? parseInt(twitterUser.toString()) : 1)) ? overflowControl.get((twitterUser) ? parseInt(twitterUser.toString()) : 1) : 0
		Logger.printLine("TwitterFlowControl", `Account ${twitterUser}: Requested to release Tweet!`, "debug");
		if (overFlowValuse > 1) {
			Logger.printLine("TwitterFlowControl", `Account ${twitterUser}: Overflow Condition, Releasing ${overFlowValuse} Tweets!`, "warn");
		}
		const twit = twitterAccounts.get(twitterUser)
		for (let i = 0; i <= overFlowValuse; i +=1) {
			setTimeout(() => {
				db.safe(`SELECT * FROM twitter_tweet_queue WHERE taccount = ? ORDER BY RAND() LIMIT 100`, [twitterUser], async (err, tweetQueue) => {
					if (err) {
						Logger.printLine(`Collector`, `Failed to get tweet from collector due to an SQL error`, `error`, err);
					} else if (tweetQueue && tweetQueue.length > 0) {
						let actionList = [];
						if (action) {
							switch (action) {
								case 'send':
									actionList = [
										{
											action: 'SendTweet',
											type: 4,
											tweets: tweetQueue.filter(e => { return e.action === 4 })
										}
									];
									break;
								case 'rt':
									actionList = [
										{
											action: ['favorites/create', 'statuses/retweet'],
											type: 1,
											tweets: tweetQueue.filter(e => { return e.action === 1 })
										},
										{
											action: ['statuses/retweet'],
											type: 2,
											tweets: tweetQueue.filter(e => { return e.action === 2 })
										},
										{
											action: ['favorites/create'],
											type: 3,
											tweets: tweetQueue.filter(e => { return e.action === 3 })
										}
									];
									break;
								default:
									actionList = [
										{
											action: ['favorites/create', 'statuses/retweet'],
											type: 1,
											tweets: tweetQueue.filter(e => { return e.action === 1 })
										},
										{
											action: ['statuses/retweet'],
											type: 2,
											tweets: tweetQueue.filter(e => { return e.action === 2 })
										},
										{
											action: ['favorites/create'],
											type: 3,
											tweets: tweetQueue.filter(e => { return e.action === 3 })
										},
										{
											action: [],
											type: 4,
											tweets: tweetQueue.filter(e => { return e.action === 4 })
										}
									];
									break;
							}
						} else {
							actionList = [
								{
									action: ['favorites/create', 'statuses/retweet'],
									type: 1,
									tweets: tweetQueue.filter(e => { return e.action === 1 })
								},
								{
									action: ['statuses/retweet'],
									type: 2,
									tweets: tweetQueue.filter(e => { return e.action === 2 })
								},
								{
									action: ['favorites/create'],
									type: 3,
									tweets: tweetQueue.filter(e => { return e.action === 3 })
								},
								{
									action: [],
									type: 4,
									tweets: tweetQueue.filter(e => { return e.action === 4 })
								}
							];
						}
						actionList.forEach(async (releaseCollection) => {
							let keyIndex = -1;
							if (releaseCollection.tweets.length > 0 && releaseCollection.type === 4) {
								async function tryTweet() {
									keyIndex++;
									if (releaseCollection.tweets[keyIndex].data !== null) {
										const json = JSON.parse(releaseCollection.tweets[keyIndex].data);
										sendTweet(twitterUser, json, async (ok) => {
											await db.safe(`DELETE
													   FROM twitter_tweet_queue
													   WHERE taccount = ?
														 AND id = ?
														 AND action = ?`, [twitterUser, releaseCollection.tweets[keyIndex].id, releaseCollection.type], (err, results) => {
												if (err) {
													Logger.printLine(`Collector`, `Failed to delete tweet from collector due to an SQL error`, `error`, err);
												}
											});
											if (!ok) {
												tryTweet();
											}
										})
									} else {
										await db.safe(`DELETE
												   FROM twitter_tweet_queue
												   WHERE taccount = ?
													 AND id = ?
													 AND action = ?`, [twitterUser, releaseCollection.tweets[keyIndex].id, releaseCollection.type], (err, results) => {
											if (err) {
												Logger.printLine(`Collector`, `Failed to delete tweet from collector due to an SQL error`, `error`, err);
											}
										});
										tryTweet();
									}
								}
								await tryTweet();
							} else if (releaseCollection.tweets.length > 0 && releaseCollection.action.length > 0) {
								async function tryTweet() {
									keyIndex++;
									if (releaseCollection.tweets.length - 1 >= keyIndex && releaseCollection.tweets[keyIndex]) {
										const tweetID = releaseCollection.tweets[keyIndex].id;
										await limiter1.removeTokens(1, async function () {
											await twit.client.get('statuses/show', { id: tweetID.toString() }, async (err, tweetData) => {
												if ( !err || (tweetData && ( ((releaseCollection.type === 1 && releaseCollection.type === 3) && tweetData.favorited) || ((releaseCollection.type === 1 && releaseCollection.type === 2) && tweetData.retweeted) ) ) ) {
													Logger.printLine(`Collector`, `Account ${twitterUser}: Releasing Tweet ${tweetID} from collector`, `info`);
													await releaseCollection.action.forEach((actionIntent, intentIndex) => {
														twit.client.post(actionIntent, { id : tweetID.toString() }, function(err, response){
															if (err) {
																mqClient.sendMessage(`Unable to interact with tweet ${tweetID} for account #${twitterUser} with ${actionIntent}, Ticket will be Dropped!`, "warn", "TweetInteract", err);
																Logger.printLine(`Collector`, `Account ${twitterUser}: Failed to release Tweet ${tweetID} in collector, retrying...`, `error`);
																if (intentIndex === 0) { tryTweet(); }
															} else {
																let username = response.user.screen_name;
																Logger.printLine("TwitterInteract", `Account ${twitterUser}: Sent command ${actionIntent} to ${username} for ${tweetID}`, "info", response);
																if (actionIntent === 'statuses/retweet')
																	mqClient.sendMessage(`Tweet interaction successfully for account #${twitterUser}!\nhttps://twitter.com/${username}/status/${response.id_str}`, "info", "Twitter")
															}
														})
													});
												} else {
													tryTweet();
												}
												await db.safe(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ? AND action = ?`, [twitterUser, tweetID, releaseCollection.type], (err, results) => {
													if (err) {
														Logger.printLine(`Collector`, `Account ${twitterUser}: Failed to delete tweet from collector due to an SQL error`, `error`, err);
													}
												});
											});
										});
									}
								}
								await tryTweet();
							}
						})
					} else {
						console.log('Empty Queue');
					}
				})
			}, (overFlowValuse - 1) * 5000)
		}
	}

	function sendTweet(twitterUser, message, cb) {
		let inputText
		const twit = twitterAccounts.get((twitterUser) ? parseInt(twitterUser.toString()) : 1)
		function textChecker(text, returned) {
			if (text.length > 275) {
				textToPicture.convert({
					text: text,
					source: "./src/tweet-bg.png",
					color: 'white',
				}).then(result => {
					return result.getBase64()
				}).then(str => {
					returned(str.replace(/^data:image\/png;base64,/, ""))
					Logger.printLine("Twitter", `Account ${twitterUser}: Generated a image with the status text`, "debug", {
						tweetText: text,
						tweetLength: text.length
					})
				}).catch(err => {
					Logger.printLine("Twitter", `Account ${twitterUser}: Error when creating text to image for long messsage`, "error", err, {
						tweetText: text,
						tweetLength: text.length
					})
					returned(false)
				})
			} else {
				returned(true)
			}
		}
		function sendAction(params){
			function send(object){
				twit.client.post('statuses/update', object, function (err, data, response) {
					if (!err) {
						cb(true);
						mqClient.sendMessage(`Tweet sent successfully for account #${twitterUser}!\nhttps://twitter.com/${data.user.screen_name}/status/${data.id_str}`, "info", "Twitter")
					} else {
						mqClient.sendMessage(`Failed to send tweet for account #${twitterUser}!, Ticket will be dropped!`, "err", "Twitter", err)
						cb(false);
					}
				})
			}
			textChecker(inputText, function (results) {
				if (results === true) {
					params.status = inputText
					send(params)
				} else if (results === false) {
					mqClient.sendMessage("Failed to obtain a text image for your long message!", "err", "SendTweet", {
						tweetText: inputText,
						tweetLength: inputText.length
					})
					cb(false)
				} else {
					sendMedia([results], "raw")
						.then(function (moremediakeys) {
							if (moremediakeys) {
								params.media_ids = moremediakeys.concat(params.media_ids)
								const URLs = getURLfromText(message.messageText)
								if (URLs.length > 0) {
									let messageFinalText = ""
									for (let index in URLs) {
										messageFinalText = messageFinalText + URLs[index] + "\n"
										if (parseInt(index) === URLs.length-1) {
											params.status = messageFinalText
											send(params);
										}
									}
								} else {
									params.status = ""
									send(params);
								}
							} else {
								mqClient.sendMessage(`Did not get second set of media keys for tweet, Ticket will be dropped!`, "err", "SendTweet")
								cb(false);
							}
						})
				}
			})
		}
		function sendMedia(media_array, mediatype){
			let mediaIDs = [];
			let index = 0
			return new Promise(function (fulfill){
				function parseImage(imageSize, media, url, numOfMedia) {
					function uploadFile(media, numOfMedia) {
						limiter2.removeTokens(1, function () {
							twit.client.post('media/upload', { media_data: Buffer.from(media).toString('base64') }, function (err, data, response) {
								if (!err && data.media_id_string) {
									mediaIDs.push(data.media_id_string);
									Logger.printLine("TwitterMedia", `Account ${twitterUser}: Uploaded ${data.media_id_string}`, "debug", data)
									index++;
									if (index === numOfMedia) {
										fulfill(mediaIDs)
									}
								} else {
									Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to upload media for tweet!`, "error", err)
									fulfill(null);
								}
							})
						})
					}
					if (imageSize.length / 1000000 > 5 ){
						Logger.printLine("TwitterMedia", `Account ${twitterUser}: File is to large for Twitter, will resize it down`, "info", imageSize)
						const scaleSize = 2500 // Lets Shoot for 2100?
						let resizeParam = {
							fit: sharp.fit.inside,
							withoutEnlargement: true
						}
						if (imageSize.width > imageSize.height) { // Landscape Resize
							resizeParam.width = scaleSize
						} else { // Portrait or Square Image
							resizeParam.height = scaleSize
						}
						sharp(Buffer.from(media))
							.resize(resizeParam)
							.toFormat('jpg')
							.withMetadata()
							.toBuffer({resolveWithObject: true})
							.then(({data, info}) => {
								uploadFile(data, numOfMedia)
							})
							.catch(err => {
								Logger.printLine("TwitterMedia", `Account ${twitterUser}: File failed to resize media for sending Tweet! ${url}`, "error", err)
								fulfill(null);
							})
					} else {
						uploadFile(media, numOfMedia)
					}
				}
				switch (mediatype) {
					case 'url':
						Logger.printLine("TwitterMedia", `Account ${twitterUser}: Got Discord File Upload`, "debug")
						for( let key in media_array ){
							Logger.printLine("TwitterMedia", `Account ${twitterUser}: Need ${media_array[key].url} for Twitter Upload`, "debug", media_array[key])
							probe(media_array[key].url).then(imageSize => {
								request.get({
									url: media_array[key].url,
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
									if(err){
										Logger.printLine("TwitterMedia", `Account ${twitterUser}: File failed to download media for sending Tweet! ${media_array[key].url}`, "error", err, res)
										fulfill(null);
									} else {
										parseImage(imageSize, body, media_array[key].url, media_array.length)
									}
								})
							})
								.catch(err => {
									Logger.printLine("TwitterMedia", `Account ${twitterUser}: File failed to resize media for sending Tweet! ${media_array[key].url}`, "error", err);
									fulfill(null);
								})
						}
						break;
					case 'raw':
						Logger.printLine("TwitterMedia", `Account ${twitterUser}: Got Raw File Upload`, "debug")
						for( let key in media_array ){
							const mediaparams = {
								media_data : media_array[key]
							}
							limiter2.removeTokens(1, function() {
								twit.client.post('media/upload', mediaparams, function(err, data, response) {
									if(!err) {
										mediaIDs.push(data.media_id_string);
										Logger.printLine("TwitterMedia", `Account ${twitterUser}: Uploaded ${data.media_id_string}`, "debug", data)
										if (media_array[key] === media_array[media_array.length-1]) {
											fulfill(mediaIDs)
										}
									} else {
										Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to upload media for tweet!`, "error", response)
										fulfill(null);
									}
								})
							})
						}
						break;
					case 'hash':
						Logger.printLine("TwitterMedia", `Account ${twitterUser}: Got Raw File Upload`, "debug")
						for( let key in media_array ){
							const filePath = path.join(process.cwd(),`/data/flow_storage_${twitterUser}`, '/' + media_array[key])
							if (fs.existsSync(filePath)) {
								fs.readFile(filePath, (err, data) => {
									if (err) {
										Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to upload media for tweet! Data Error`, "error", err);
										fulfill(null);
									} else if (data) {
										limiter2.removeTokens(1, function () {
											twit.client.post('media/upload', { media_data: Buffer.from(data).toString() }, function (err, data, response) {
												if (!err) {
													mediaIDs.push(data.media_id_string);
													Logger.printLine("TwitterMedia", `Account ${twitterUser}: Uploaded ${data.media_id_string}`, "debug", data)
													if (media_array[key] === media_array[media_array.length - 1]) {
														fulfill(mediaIDs)
													}
												} else {
													Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to upload media for tweet!`, "error", response)
													fulfill(null);
												}
											})
										})
									} else {
										Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to upload media for tweet! Data Invalid`, "error")
										fulfill(null);
									}
									try {
										fs.unlinkSync(filePath);
									} catch (e) {
										Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to delete media for tweet! ${e.message}`, "error", e)
									}
								})
							} else {
								Logger.printLine("TwitterMedia", `Account ${twitterUser}: Failed to upload media for tweet! File does not exsist!`, "error", response)
								fulfill(null);
							}
						}
						break;
					default:
						break;
				}
			})
		}
		let parameters = {}

		if (message.messageAction === "Reply" && !(message.messageEmbeds && message.messageEmbeds.length > 0)) {
			mqClient.sendMessage(`Did not get url for tweet to reply, Ticket will be dropped!`, "err", "SendTweet")
			cb(false);
		} else {
			if (message.messageAction === "Reply"){
				parameters.auto_populate_reply_metadata = true;
				if (message.messageEmbeds && message.messageEmbeds.length > 0) {
					parameters.in_reply_to_status_id = getIDfromText(message.messageEmbeds[0].url);
				} else {
					parameters.in_reply_to_status_id = getIDfromText(message.messageText);
				}
				inputText = message.messageText
					.split("\n<@!>").pop()
					.replace('/^[ ]+|[ ]+$/g','')
					.split("***").join("")
					.split("**").join("")
					.split("`").join("")
					.split("__").join("")
					.split("~~").join("")
					.split("||").join("")
					.split("<#").join("")
					.split("<!@").join("")
					.split(">").join("")
				Logger.printLine("TwitterSend", `Account ${twitterUser}: Preparing to send Reply`, "debug", {
					tweetText: inputText,
					tweetLength: inputText.length
				})
			} else {
				inputText = message.messageText
					.split("***").join("")
					.split("**").join("")
					.split("`").join("")
					.split("__").join("")
					.split("~~").join("")
					.split("||").join("")
					.split("<#").join("")
					.split("<!@").join("")
					.split(">").join("")
				Logger.printLine("TwitterSend", `Account ${twitterUser}: Preparing to send Tweet`, "debug", {
					tweetText: inputText,
					tweetLength: inputText.length
				})
			}
			if (message.messageFileData[0]) {
				sendMedia(message.messageFileData, message.messageFileType)
					.then((mediakeys) => {
						if (mediakeys) {
							parameters.media_ids = mediakeys
							sendAction(parameters);
						} else {
							mqClient.sendMessage(`Did not get media keys for tweet, Ticket will be dropped!`, "err", "SendTweet")
							cb(false);
						}
					})
			} else {
				sendAction(parameters);
			}
		}
	}
	async function downloadUser(message, cb) {
		try {
			const twitterUser = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
			const twit = twitterAccounts.get(twitterUser);
			const tweets = await new Promise((resolve, reject) => {
				twit.client.get('statuses/user_timeline', {
					screen_name: message.userID,
					count: (message.tweetCount) ? message.tweetCount : 3200,
					include_rts: !(message.excludeRT),
					exclude_replies: !(message.excludeReplys)
				}, async (err, data, response) => {
					if (err) {
						Logger.printLine("Twitter", `Failed to get users tweets - ${err.message}`, "error", err)
						resolve([]);
					} else {
						resolve(data)
					}
				})
			})
			Logger.printLine("Twitter", `Account ${twitterUser}: Returning ${tweets.length} tweets for user ${message.userID}`, "info")
			let listRequests = tweets.filter(e => ((e.extended_entities && e.extended_entities.media) || e.entities.media)).reduce((promiseChain, tweet) => {
				return promiseChain.then(() => new Promise(async (tweetResolve) => {
					const lasttweet = await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE tweetid = ? LIMIT 1`, [((tweet.retweeted_status && tweet.retweeted_status.id_str)) ? tweet.retweeted_status.id_str : tweet.id_str]);
					if (lasttweet.rows.length === 0 || message.allowDuplicates) {
						const competedTweet = await sendTweetToDiscordv2({
							channelid: `${(message.messageChannelID) ? message.messageChannelID : discordaccount[0].chid_download}`,
							saveid: discordaccount[0].chid_download,
							nsfw: 0,
							txtallowed: 0,
							fromname: "Manual Download",
							tweet,
							redirect: 0,
							bypasscds: 0,
							autolike: 0,
							replyenabled: 0,
							mergelike: 0,
							listusers: false,
							disablelike: 0,
							list_num: 0,
							list_id: 0,
							accountid: twitterUser,
						})
						if (competedTweet && competedTweet.length > 0) {
							let sent = true
							for (let i in competedTweet) {
								const _sent = await mqClient.publishData(`${systemglobal.Discord_Out}`, competedTweet[i])
								if (!_sent)
									sent = false;
							}
							if (lasttweet.rows.length === 0 && sent)
								await db.query(`INSERT INTO twitter_history_inbound VALUES (?, null, NOW())`, [((tweet.retweeted_status && tweet.retweeted_status.id_str)) ? tweet.retweeted_status.id_str : tweet.id_str])
						}
					}
					tweetResolve(true);
				}))
			}, Promise.resolve());
			listRequests.then(async (ok) => {
				cb(true);
			})
		} catch (err) {
			Logger.printLine("Twitter", `Failed to get users tweets - ${err.message}`, "error", err)
			console.error(err);
		}
	}
	async function downloadTweet(message, cb) {
		const username = (message.messageEmbeds.length > 0) ? message.messageEmbeds[0].author.name.split("(@").pop().slice(0, -1).toLowerCase() : getURLfromText(message.messageText).pop().split("/")[3].toLowerCase()
		const listinfo = await db.query(`SELECT taccount,name,saveid,nsfw,redirect_taccount FROM twitter_list WHERE listid = ?`, [message.listID])
		const channelreplacement = await db.query(`SELECT channelid FROM twitter_user_redirect WHERE twitter_username = ?`, [username])

		if (listinfo.error) {
			Logger.printLine("SQL", `SQL Error when getting Twitter Lists records`, "emergency", listinfo.error)
		}
		if (listinfo.error) {
			channelreplacement.printLine("SQL", `SQL Error when getting to the Twitter Redirect records`, "emergency", channelreplacement.error)
		}

		const command = 'statuses/show'
		let channelID
		let channelNsfw
		if (message.messageChannelOveride) {
			channelID = message.messageChannelOveride;
			channelNsfw = 0
		} else if (channelreplacement.rows.length > 0) {
			channelID = channelreplacement.rows[0].channelid
			channelNsfw = 0
		} else {
			if (message.listID === discordaccount[0].chid_download) {
				channelID = discordaccount[0].chid_download
				channelNsfw = 0
			} else {
				channelID = listinfo.rows[0].saveid;
				channelNsfw = listinfo.rows[0].nsfw
			}
		}
		let buttons = []
		if (channelNsfw === 0 || (channelNsfw === 1 && listinfo.rows[0].redirect_taccount !== listinfo.rows[0].taccount)) {
			buttons = ["Pin"]
			if (message.listID === discordaccount[0].chid_download) {
				buttons.push("RemoveFile")
			}
			buttons.push("Archive", "MoveMessage")
		} else {
			buttons = ["Pin", "Archive", "MoveMessage"]
		}
		const TweetID = (message.messageEmbeds && message.messageEmbeds.length > 0 && message.messageEmbeds[0].title && (message.messageEmbeds[0].title.includes('📨 Tweet') || message.messageEmbeds[0].title.includes('✳ Retweet'))) ? message.messageEmbeds[0].url.split('/photo')[0].split('/').pop() : getIDfromText(message.messageText);
		const twit = twitterAccounts.get(1)

		if ( message.messageEmbeds.length > 0 && message.messageEmbeds[0].image ) {
			const name = message.messageEmbeds[0].author.name.split(" (@")[0]
			Object.values(message.messageEmbeds).forEach(function (row) {
				if (row.image) {
					const FileName = username + "-" + getIDfromText(row.image.url).replace("large", "")
					let URL
					if (row.image.url.includes(":large")) {
						URL = row.image.url
					} else {
						URL = row.image.url + ":large"
					}
					const description = (message.messageEmbeds[0].description && message.messageEmbeds[0].description.length > 0) ? `\n**${message.messageEmbeds[0].description}**` : ''
					request.get({
						url: URL,
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
							mqClient.sendMessage(`Error when trying to download tweet ${TweetID} media`, "err", "DownloadTweet", err)
						} else {
							if (body.length < 1000 ) {
								Logger.printLine("DownloadTweet", `Error when trying to download tweet ${TweetID} media from Twitter, will try Discord Proxy media now`, "warn", message.messageEmbeds[0])
								const URL = message.messageEmbeds[0].image.proxy_url;
								request.get({
									url: URL,
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
										mqClient.sendMessage(`Error when trying to download tweet ${TweetID} media`, "err", "DownloadTweet", err)
									} else {
										mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
											fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
											messageReturn: false,
											messageType: 'sfile',
											messageChannelID: channelID,
											messageText: `**🌁 Twitter Image** - ***${name} (@${username})***${description}`,
											itemFileData: body.toString('base64'),
											itemFileSize: body.length,
											itemFileName: FileName,
											addButtons: buttons
										}, function (ok) {
											if (ok) {
												Logger.printLine("TweetDownload", `Tweet ${TweetID} was downloaded to ${channelID}`, "debug", {
													fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
													messageReturn: false,
													messageType: 'sfile',
													messageChannelID: channelID,
													messageText: `**🌁 Twitter Image** - ***${name} (@${username})***${description}`,
													itemFileSize: body.length,
													itemFileName: FileName,
													addButtons: buttons
												})
											} else {
												Logger.printLine("TweetDownload", `Error when trying to send downloaded tweet ${TweetID} media`, "error", {
													fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
													messageReturn: false,
													messageType: 'sfile',
													messageChannelID: channelID,
													messageText: `**🌁 Twitter Image** - ***${name} (@${username})***`,
													itemFileSize: body.length,
													itemFileName: FileName,
													addButtons: buttons
												})
											}
										})
									}
								});
							} else {
								mqClient.sendData(`${systemglobal.Discord_Out}.priority`, {
									fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
									messageType: 'sfile',
									messageReturn: false,
									messageChannelID: channelID,
									messageText: `**🌁 Twitter Image** - ***${name} (@${username})***${description}`,
									itemFileData: body.toString('base64'),
									itemFileSize: body.length,
									itemFileName: FileName,
									addButtons: buttons
								}, function (ok) {
									if (ok) {
										Logger.printLine("TwitterDownload", `Tweet ${TweetID} was downloaded to ${channelID}`, "info", {
											fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
											messageType: 'sfile',
											messageReturn: false,
											messageChannelID: channelID,
											messageText: `**🌁 Twitter Image** - ***${name} (@${username})***`,
											itemFileSize: body.length,
											itemFileName: FileName,
											addButtons: buttons
										})
									} else {
										Logger.printLine("TwitterDownload", `Error when trying to send downloaded tweet ${TweetID} media`, "error", {
											fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
											messageType: 'sfile',
											messageReturn: false,
											messageChannelID: channelID,
											messageText: `**🌁 Twitter Image** - ***${name} (@${username})***`,
											itemFileSize: body.length,
											itemFileName: FileName,
											addButtons: buttons
										})
									}
								})
							}
						}
					});
				}
			})
			cb(true)
		} else if ( message.messageEmbeds.length > 0 && message.messageEmbeds[0].video ) {
			const name = message.messageEmbeds[0].author.name
			const ID = getIDfromText(message.messageEmbeds[0].url)
			const FileName = `${username}-${ID}.mp4`
			mqClient.sendData(systemglobal.FileWorker_In, {
				messageChannelID: channelID,
				messageReturn: false,
				messageText: `**🎞 Twitter Video** - ***${name} (@${username})***`,
				itemFileName : FileName,
				itemVideoURL : message.messageEmbeds[0].video.url
			}, function (ok) {
				if (ok) {
					Logger.printLine("TwitterDownload", `Tweet ${TweetID} will be downloaded to ${channelID}, Sent to file worker proxy downloader`, "info", message.messageEmbeds[0], {
						messageChannelID: channelID,
						messageReturn: false,
						messageText: `**🎞 Twitter Video** - ***${name} (@${username})***`,
						itemFileName : FileName,
						itemVideoURL : message.messageEmbeds[0].video.url
					})
				}
			})
			cb(true);
		} else {
			limiter1.removeTokens(1, async function () {
				twit.client.get(command, { id : TweetID }, function(err, response){
					if(err){
						mqClient.sendMessage(`Unable download tweet ${TweetID} metadata`, "warn", "DownloadTweet", err)
						console.log(err)
					} else if (response.extended_entities && response.extended_entities.media) {
						for( let media of response.extended_entities.media ){
							request.get({
								url: media.media_url + ":large",
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
								if(err){
									mqClient.sendMessage(`Error when trying to download tweet ${TweetID} media`, "err", "DownloadTweet", err)
								} else {
									mqClient.sendData( `${systemglobal.Discord_Out}.priority`, {
										fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
										messageType : 'sfile',
										messageReturn: false,
										messageChannelID : channelID,
										messageText : `**🌁 Twitter Image** - ***${response.user.name} (@${response.user.screen_name})***`,
										itemFileData : body.toString('base64'),
										itemFileSize: body.length,
										itemFileName : getIDfromText(media.media_url),
										addButtons: buttons
									}, function (ok) {
										if (ok) {
											Logger.printLine("TwitterDownload", `Tweet ${TweetID} was downloaded to ${channelID}`, "info", {
												fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
												messageType : 'sfile',
												messageReturn: false,
												messageChannelID : channelID,
												messageText : "",
												itemFileName : getIDfromText(media.media_url),
												addButtons: buttons
											})
										}
									})
								}
							});
						}
					}
					cb(true);
				})
			});
		}
	}
	function listManagment(message, cb) {
		const accountID = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
		const twit = twitterAccounts.get(accountID);
		function postTwitter(command) {
			twit.client.post(command, {
				list_id: message.listID,
				screen_name: message.messageText
			}, function (err, response) {
				if (err) {
					switch (message.messageAction) {
						case "adduser" :
							mqClient.sendMessage(`Failed to add ${message.messageText} to that twitter list`, "err", "ListManager", err)
							break;
						case "removeuser" :
							mqClient.sendMessage(`Failed to remove ${message.messageText} to that twitter list`, "err", "ListManager", err)
							break;
					}
					cb(true);
				} else {
					switch (message.messageAction) {
						case "adduser" :
							db.safe('SELECT channelid FROM twitter_user_redirect WHERE twitter_username = ?', [message.messageText], (err, channel) => {
								if (err) {
									Logger.printLine("SQL", `SQL Error when verifying Twitter redirect records`, "emergency", err)
									mqClient.sendMessage(`✅ Added ${message.messageText} to that twitter list, unable to check redirect`, "info", "ListManager")
								} else if (channel.length > 0) {
									db.safe('INSERT IGNORE INTO twitter_user_redirect VALUES (?, ?)', [message.messageText, channel[0].channelid], (err, result) => {
										if (err) {
											Logger.printLine("SQL", `SQL Error when insert into Twitter redirect records`, "emergency", err)
											mqClient.sendMessage(`✅ Added ${message.messageText} to that twitter list, unable add redirect`, "info", "ListManager")
										} else if (result.affectedRows > 0) {
											mqClient.sendMessage(`✅ Added ${message.messageText} to that twitter list, with redirect from parent to <!#${channel[0].channelid}>`, "info", "ListManager")
										} else {
											mqClient.sendMessage(`✅ Added ${message.messageText} to that twitter list`, "info", "ListManager")
										}
									})
								} else {
									mqClient.sendMessage(`✅ Added ${message.messageText} to that twitter list`, "info", "ListManager")
								}
							})
							break;
						case "removeuser" :
							mqClient.sendMessage(`❎ Removed ${message.messageText} to that twitter list`, "info", "ListManager")
							db.safe('DELETE IGNORE FROM twitter_user_redirect WHERE twitter_username = ?', [message.messageText], (err, result) => {
								if (err) {
									Logger.printLine("SQL", `SQL Error when removing from Twitter redirect records`, "emergency", err)
								}
							})
							break;
					}
					cb(true);
				}
			})
		}
		function getTwitter(command) {
			twit.client.get(command, {
				list_id: message.listID,
			}, function (err, response) {
				if (err) {
					Logger.printLine("TwitterGet", `Error Getting Twitter Users in List ${message.listID}`, "error")
					cb(true);
				} else {
					for (const user of response.users) {
						const messageText = `👤 **${user.name} (${user.screen_name})** [👥 ${user.followers_count}]\n` + '`' + user.description + '`\n-------\n'
						mqClient.sendData( `${systemglobal.Discord_Out}.priority`, {
							fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
							messageType : 'stext',
							messageReturn: false,
							messageChannelID : discordaccount[0].chid_system,
							messageText : messageText,
						}, function (ok) {
							if (!ok) {
								Logger.printLine("mqClient.sendData", "Failed to send message to endpoint", "error", {
									fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
									messageType : 'stext',
									messageReturn: false,
									messageText : messageText,
								})
							}
						});
					}
					cb(true);
				}
			})
		}
		switch (message.messageAction) {
			case "adduser" :
				postTwitter('lists/members/create')
				break;
			case "removeuser" :
				postTwitter('lists/members/destroy')
				break;
			case "getusers" :
				getTwitter('lists/members')
				break;
		}
	}
	function interactTweet(message, intent, cb){
		const accountID = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
		const twit = twitterAccounts.get(accountID);
		let command = ''
		if (message.messageAction === "add" && intent === "Like") {
			command = 'favorites/create'
		}
		if (message.messageAction === "remove" && intent === "Like") {
			command = 'favorites/destroy'
		}
		if (message.messageAction === "add" && intent === "Retweet") {
			command = 'statuses/retweet'
		}
		if (message.messageAction === "remove" && intent === "Retweet") {
			command = 'statuses/unretweet'
		}
		let tweetArgs = { id : null }
		if ( message.messageEmbeds && message.messageEmbeds.length > 0 && message.messageEmbeds[0].title && (message.messageEmbeds[0].title.includes('📨 Tweet') || message.messageEmbeds[0].title.includes('✳ Retweet'))) {
			tweetArgs.id = message.messageEmbeds[0].url.split("/").pop();
		} else if ( message.messageEmbeds && message.messageEmbeds.title && (message.messageEmbeds.title.includes('📨 Tweet') || message.messageEmbeds.title.includes('✳ Retweet'))) {
			tweetArgs.id = message.messageEmbeds.url.split("/").pop();
		} else if (message.messageText.length > 0) {
			tweetArgs.id = getIDfromText(message.messageText)
		}

		twit.client.post(command, tweetArgs, function(err, response){
			if (err) {
				mqClient.sendMessage(`Unable to interact with tweet ${arguments.id} with ${command} for account #${accountID}\nTicket will be Dropped!`, "warn", "TweetInteract", err)
				cb(true);
			} else {
				let username = response.user.screen_name;
				let tweetId = response.id_str;
				Logger.printLine("TwitterInteract", `Account ${accountID}: Sent command ${command} to ${username} for ${tweetId}`, "info", response)
				cb(true);
			}
		})
	}
	function doAction(message, cb) {
		if (message.messageText !== 'undefined') {
			switch (message.messageIntent) {
				case "send":
					sendTweet((message.accountID) ? message.accountID : 1, message, (ok) => {
						cb(true);
					});
					break;
				case "Like":
					// Liked
					interactTweet(message, message.messageIntent, cb);
					break;
				case "Retweet":
					interactTweet(message, message.messageIntent, cb);
					break;
				case "LikeRT":
					interactTweet(message, 'Like', (retr) => {});
					interactTweet(message, 'Retweet', cb);
					break;
				case "Download":
					downloadTweet(message, cb);
					break;
				case "DownloadUser":
					downloadUser(message, cb);
					break;
				case "SendTweet":
					sendTweet((message.accountID) ? message.accountID : 1, message, (ok) => {
						cb(true);
					});
					break;
				case "Reply":
					sendTweet((message.accountID) ? message.accountID : 1, message, (ok) => {
						cb(true);
					});
					break;
				case "listManager":
					listManagment(message, cb)
					break;
				case "releaseTweet":
					releaseTweet((message.accountID) ? message.accountID : 1, message.messageAction);
					cb(true);
					break;
				case "clearCollector":
					clearCollector();
					cb(true);
					break;
				default:
					mqClient.sendMessage(`Was unable to handle the given action ${message.messageIntent}`, "warn", "Twitter");
					cb(true);
					break;
			}
		} else {
			Logger.printLine("Twitter", `Message could not be handled, there was no body, Ticket Closed!`, "warn", message)
			cb(true);
		}
	}

	function getMentions() {
		Array.from(twitterAccounts.entries()).forEach(e => {
			const id = e[0];
			const twit = e[1];

			limiter4.removeTokens(1, function() {
				twit.client.get('statuses/mentions_timeline', async function(err, data, response) {
					if(!err){
						for (const tweet of data) {
							const _tweetID = (tweet.retweeted_status && tweet.retweeted_status.id_str) ? tweet.retweeted_status.id_str : tweet.id_str
							const lasttweet = await db.query(`SELECT * FROM twitter_history_mention WHERE tweetid = ? OR tweetid = ?`, [_tweetID, tweet.id_str]);
							if (lasttweet.error) {
								Logger.printLine("SQL", `SQL Error when getting Twitter history records`, "emergency", lasttweet.error)
							} else if (lasttweet.rows.length === 0 ) {
								const competedTweet = await sendTweetToDiscordv2({
									channelid: twit.config.activitychannelid,
									nsfw: 0,
									txtallowed: 1,
									fromname: "Mention",
									tweet,
									redirect: null,
									bypasscds: 0,
									replyenabled: 1,
									mergelike: 0,
									autolike: 0,
									list_num: -1,
									list_id: -1,
									accountid: id
								})
								if (competedTweet && competedTweet.length > 0) {
									let sent = true
									for (let i in competedTweet) {
										const _sent = await mqClient.publishData(`${systemglobal.Discord_Out}.priority`, competedTweet[i])
										if (!_sent)
											sent = false;
									}
									if (sent)
										await db.query(`INSERT IGNORE INTO twitter_history_mention VALUES (?, ?, NOW())`, [_tweetID, id])
								}
							}
						}
					} else {
						mqClient.sendMessage(`Error retrieving tweet`, "err", "TwitterMentions", err)
					}
				})
			})
		})
	}
	async function getTweets(getRt) {
		Array.from(twitterAccounts.entries()).forEach(async e => {
			const id = e[0];
			const twit = e[1];

			const twitterlist = await db.query(`SELECT * FROM twitter_list WHERE taccount = ?`, [id]);
			const twitterusers = await db.query(`SELECT * FROM twitter_list_users`)
			const twitterblockedwords = await db.query(`SELECT word FROM twitter_blockedwords WHERE taccount = ?`, [id])

			if (twitterlist.error) { console.error(twitterlist.error) }
			if (twitterusers.error) { console.error(twitterusers.error) }
			if (twitterblockedwords.error) { console.error(twitterblockedwords.error) }

			let messageArrayPriority = [];
			let messageArray = [];
			let listRequests = twitterlist.rows.reduce((promiseChain, list) => {
				return promiseChain.then(() => new Promise((listResolve) => {
					limiter1.removeTokens(1, function () {
						let params = {
							list_id: '' + list.listid,
							count: 500,
							include_rts: '' + list.getretweets
						}
					twit.client.get('lists/statuses', params, function (err, tweets) {
						if (err) {
							mqClient.sendMessage(`Error retrieving twitter ${list.name} (${list.listid})!`, "err", "TwitterInbound", err)
							listResolve(false);
						} else {
					twit.client.get('lists/members', { list_id: '' + list.listid, count: 1000 }, function (err, listUsers) {
						if (err) {
							Logger.printLine("TwitterGet", `Account ${id}: Error Getting Twitter Users in List ${list.listid}`, "error", err)
							listResolve(false);
						} else {
					listUsers.users.filter(e => twitterusers.rows.filter(f => e.screen_name.toLowerCase() === f.username.toLowerCase()).length === 0).map(e => e.screen_name).forEach(e => {
						console.log(`Added User : ${e}`)
						db.query(`INSERT IGNORE INTO twitter_list_users SET username = ?, listid = ?`, [e, list.listid])
					})

					let tweetRequests = tweets.reduce((promiseChain1, tweet) => {
						return promiseChain1.then(() => new Promise(async (tweetResolve) => {
							const _tweetID = (tweet.retweeted_status && tweet.retweeted_status.id_str) ? tweet.retweeted_status.id_str : tweet.id_str;
							const lasttweet = await db.query(`SELECT * FROM twitter_history_inbound WHERE tweetid = ? OR tweetid = ?`, [_tweetID, tweet.id_str]);
							const blocked = (tweet.text && tweet.text.length > 1) ? twitterblockedwords.rows.filter(e => tweet.text.includes(e.word)).map(e => e.word) : [];

							if (!lasttweet.error && lasttweet.rows.length === 0 && blocked.length === 0) {
								if (tweet.text.includes("RT @") && list.blockselfrt === 1 && tweet.user.screen_name.includes(tweet.text.split('RT @').pop().split(': ')[0])) {
									Logger.printLine("Twitter", `Account ${id}: Tweet was blocked because its a self RT`, "warn", tweet)
									db.safe(`INSERT IGNORE INTO twitter_history_inbound VALUES (?, ?, NOW())`, [_tweetID, list.listid], function (err) {
										if (err) { Logger.printLine("SQL", `SQL Error when writing to the Twitter history records`, "emergency", err) }
									});
									tweetResolve(false);
								} else if (tweet.text.includes("RT @") && list.blockselfrt === 1 && twitterusers.rows.filter(e => { return e.username.toLowerCase() === tweet.text.split('RT @').pop().split(': ')[0].toLowerCase() }).length > 0) {
									Logger.printLine("Twitter", `Account ${id}: Tweet was blocked because @${tweet.user.screen_name} can't RT a list member (@${tweet.text.split('RT @').pop().split(': ')[0]})`, "warn", tweet)
									db.safe(`INSERT IGNORE INTO twitter_history_inbound VALUES (?, ?, NOW())`, [_tweetID, list.listid], function (err) {
										if (err) { Logger.printLine("SQL", `SQL Error when writing to the Twitter history records`, "emergency", err) }
									});
									tweetResolve(false);
								} else {
									const competedTweet = await sendTweetToDiscordv2({
										channelid: (list.channelid_rt && tweet.text.includes("RT @")) ? list.channelid_rt : list.channelid,
										saveid: list.saveid,
										nsfw: (list.nsfw === 1) ? (list.redirect_taccount !== list.taccount) ? 0 : list.nsfw : list.nsfw,
										txtallowed: list.textallowed,
										fromname: list.name,
										tweet,
										redirect: list.redirect_taccount,
										bypasscds: list.bypasscds,
										autolike: list.autolike,
										replyenabled: list.replyenabled,
										mergelike: list.mergelike,
										listusers: listUsers.users,
										disablelike: list.disablelike,
										list_num: list.id,
										list_id: list.listid,
										accountid: id,
									})
									if (competedTweet && competedTweet.length > 0) {
										let sent = true
										for (let i in competedTweet) {
											const _sent = await mqClient.publishData(`${systemglobal.Discord_Out}${(list.channelid_rt && tweet.text.includes("RT @")) ? '' : '.priority'}`, competedTweet[i])
											if (!_sent)
												sent = false;
										}
										if (sent)
											await db.query(`INSERT IGNORE INTO twitter_history_inbound VALUES (?, ?, NOW())`, [_tweetID, list.listid])
									}
									tweetResolve(true);
								}
							} else if (!lasttweet.error && lasttweet.rows.length === 0 && blocked.length > 0 ) {
								Logger.printLine("TwitterInbound", `Account ${id}: Tweet was blocked because it contained the word [ ${blocked.join(', ')} ]`, "warn", tweet)
								db.query(`INSERT IGNORE INTO twitter_history_inbound VALUES (?, ?, NOW())`, [_tweetID, list.listid])
								tweetResolve(false);
							} else {
								tweetResolve(false);
							}
						}));
					}, Promise.resolve());
					tweetRequests.then((ok) => {
						console.log(`Account ${id}: List Complete - ${list.listid}`)
						listResolve(true);
					});
						}
					})
						}
					})
					});
				}))
			}, Promise.resolve());
			listRequests.then(async (ok) => {
				if (messageArray.length > 0) {
					await messageArray.forEach(async (message) => {
						await mqClient.sendData( `${systemglobal.Discord_Out}`, message, function (ok) {
							if (!ok) {
								Logger.printLine("mqClient.sendData", "Failed to send message to endpoint", "error")
							}
						});
					})
					messageArray = null;
				}
				console.log(`Account ${id}: Completed Pass`);
			})
		})
	}
	async function getLikes() {
		const twitterlist = (await db.query(`SELECT * FROM twitter_list WHERE taccount = 1 AND remotecds_onlike = 1`, [])).rows.map(e => e.listid);
		limiter5.removeTokens(1, function () {
			let params = {
				count: 200
			}
			const twit = twitterAccounts.get(1)
			twit.client.get('favorites/list', params, async function (err, tweets) {
				if (err) {
					mqClient.sendMessage(`Error retrieving twitter favorites!`, "err", "TwitterFavorites", err)
				} else {
					const tweetIDs = Array.from(tweets).map(e => (e.retweeted_status && e.retweeted_status.id_str) ? e.retweeted_status.id_str : e.id_str)
					const tweetsDB = (await db.query(`SELECT * FROM twitter_tweets`)).rows.filter(e => twitterlist.indexOf(e.listid) !== -1 && tweetIDs.indexOf(e.tweetid) !== -1)
					tweetsDB.forEach(tweet => {
						mqClient.sendData( `${systemglobal.Discord_Out}.priority`, {
							fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
							messageAction: 'ActionPost',
							messageType: 'command',
							messageIntent: 'DefaultDownload',
							messageReturn: false,
							messageChannelID: tweet.channelid,
							messageID: tweet.messageid
						}, async function (ok) {
							if (ok) {
								Logger.printLine("TwitterDownload", `Tweet ${tweet.tweetid} was requested to downloaded`, "info", {
									fromClient : `return.${facilityName}.${systemglobal.SystemName}`
								})
								await db.query(`DELETE FROM twitter_tweets WHERE messageid = ?`, [tweet.messageid])
							}
						})
					})
				}
			})
		});
	}

	process.on('uncaughtException', function(err) {
		console.log(err)
		Logger.printLine("uncaughtException", err.message, "critical", err)
		process.exit(1)
	});
	start();
})()
