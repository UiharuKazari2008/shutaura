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
Shutaura Project - Twitter I/O System
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
	const facilityName = 'Twitter-Worker';

	const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
	const puppeteer = require('puppeteer');
	const amqp = require('amqplib/callback_api');
	const fs = require('fs');
	const sharp = require('sharp');
	const colors = require('colors');
	const probe = require('probe-image-size');
	const crypto = require('crypto');
	const moment = require('moment');
	const minimist = require('minimist');
	const cron = require('node-cron');
	let args = minimist(process.argv.slice(2));
	const tx2 = require('tx2')

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
	let twitterNotify = new Map();
	let enablePullData = true;

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
			const _cluster_id = systemparams_sql.filter(e => e.param_key === 'cluster.id');
			if (_cluster_id.length > 0 && _cluster_id[0].param_value) {
				systemglobal.Cluster_ID = _cluster_id[0].param_value;
			}
			const _cluster_entity = systemparams_sql.filter(e => e.param_key === 'cluster.entity');
			if (_cluster_entity.length > 0 && _cluster_entity[0].param_value) {
				systemglobal.Cluster_Entity = _cluster_entity[0].param_value;
			}
			const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
			if (_home_guild.length > 0 && _home_guild[0].param_value) {
				systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
			}
			const _mq_discord_out = systemparams_sql.filter(e => e.param_key === 'mq.discord.out');
			if (_mq_discord_out.length > 0 && _mq_discord_out[0].param_value) {
				systemglobal.Discord_Out = _mq_discord_out[0].param_value;
			}
			const _mq_pdp_out = systemparams_sql.filter(e => e.param_key === 'mq.pdp.out');
			if (_mq_pdp_out.length > 0 && _mq_pdp_out[0].param_value) {
				systemglobal.PDP_Out = _mq_pdp_out[0].param_value;
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
			const _chrome_path = systemparams_sql.filter(e => e.param_key === 'chrome.exec');
			if (_chrome_path.length > 0 && _chrome_path[0].param_value) {
				systemglobal.Chrome_Exec = _chrome_path[0].param_value;
			}
			const _twitter_account = systemparams_sql.filter(e => e.param_key === 'twitter.account' && e.param_data && e.account);
			if (_twitter_account.length > 0)
				systemglobal.Twitter_Accounts = _twitter_account.map(e => {
					return {
						id: parseInt(e.account.toString()),
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

		Logger.printLine("SQL", "Getting Twitter Notifications", "debug")
		const _twitternotify = await db.query(`SELECT * FROM twitter_notify`);
		if (_twitternotify.error) { Logger.printLine("SQL", "Error getting discord servers records!", "emergency", _twitternotify.error); return false }
		const _tni = _twitternotify.rows.map(e => e.username.toLowerCase());
		_twitternotify.rows.map(e => {
			twitterNotify.set(e.username.toLowerCase(), e.channel)
		});
		Array.from(twitterNotify.keys()).filter(e => _tni.indexOf(e) === -1).forEach(e => twitterNotify.delete(e));
		console.log(`Notification enabled for ${twitterNotify.size} users`);
	}
	await loadDatabaseCache();
	if (args.whost) {
		systemglobal.Watchdog_Host = args.whost
	}
	if (args.wid) {
		systemglobal.Watchdog_ID = args.wid
	}
	if (args.cid) {
		systemglobal.Cluster_ID = args.cid
	}
	if (args.ceid) {
		systemglobal.Cluster_Entity = args.ceid
	}
	const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

	Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug")

	const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`
	const MQWorker1 = `${systemglobal.Twitter_In}`
	// Twitter Timeline Checkins
	const limiter1 = new RateLimiter(1, (systemglobal.Twitter_Timeline_Pull) ? parseInt(systemglobal.Twitter_Timeline_Pull.toString()) * 1000 : 1000);
	const limiter5 = new RateLimiter(75, 15 * 60 * 1000);
	// Twitter User Timeline Pulls
	const limiter6 = new RateLimiter(895, 15 * 60 * 1000);
	// RabbitMQ
	const limiter3 = new RateLimiter(10, 1000);
	// Twitter Media Upload
	const limiter2 = new RateLimiter(14, (systemglobal.Twitter_MediaUpload_Delay) ? parseInt(systemglobal.Twitter_MediaUpload_Delay.toString()) * 1000 : 90000);
	// Twitter Mention
	const limiter4 = new RateLimiter(1, (systemglobal.Twitter_Mention_Pull) ? parseInt(systemglobal.Twitter_Mention_Pull.toString()) * 1000 : 1000);
	let Twitter = null;

	await Promise.all(systemglobal.Twitter_Accounts.map(async account => {
		if (account.id && account.cookies && account.screenName) {
			Logger.printLine("Twitter", "Settings up Twitter Client using account #" + account.id, "debug")
			if (account.flowcontrol)
				Logger.printLine("Twitter", `NOTE: Flow Control is enabled on account #${account.id}`, "debug")
			twitterAccounts.set(parseInt(account.id.toString()), {
				cookie: account.cookies,
				screenName: account.screenName,
				browser: await puppeteer.launch({
					executablePath: systemglobal.Chrome_Exec || undefined,
					headless: (account.headless !== undefined) ? account.headless : 'new',
					args: [
						'--no-sandbox',
						'--disable-setuid-sandbox',
						'--inprivate',
						`--remote-debugging-port=${9222 + ((parseInt(account.id.toString())) - 1)}`,
						'--remote-debugging-address=0.0.0.0'
					]
				}),
				config: twitteraccount.filter(e => e.taccount === parseInt(account.id.toString())).pop(),
				flowcontrol: (account.flowcontrol) ? account.flowcontrol : false
			})
		} else {
			Logger.printLine("Twitter", `Missing Twitter Bot Login Properties for account ${account.id}, Please verify that they exists in the configuration file or the global_parameters table`, "critical");
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

	let lastClusterCheckin = (new Date().getTime());
	if (systemglobal.Watchdog_Host && systemglobal.Cluster_ID) {
		await new Promise(async (cont) => {
			const isBootable = await new Promise(ok => {
				request.get(`http://${systemglobal.Watchdog_Host}/cluster/init?id=${systemglobal.Cluster_ID}&entity=${(systemglobal.Cluster_Entity) ? systemglobal.Cluster_Entity : facilityName + "-" + systemglobal.SystemName}`, async (err, res, body) => {
					if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
						console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${(systemglobal.Cluster_Entity) ? systemglobal.Cluster_Entity : facilityName + "-" + systemglobal.SystemName}:${systemglobal.Cluster_ID}`);
						ok(systemglobal.Cluster_Global_Master || false);
					} else {
						const jsonResponse = JSON.parse(Buffer.from(body).toString());
						if (jsonResponse.error) {
							console.error(jsonResponse.error);
							ok(false);
						} else {
							if (!jsonResponse.active) {
								Logger.printLine("ClusterIO", "System is not active, Standing by...", "warn");
							}
							ok(jsonResponse.active);
						}
					}
				})
			})
			if (!isBootable) {
				Logger.printLine("ClusterIO", "System is not active master, will not pull any data", "warn");
				enablePullData = false;
			} else {
				Logger.printLine("ClusterIO", "System active master", "info");
				enablePullData = true;
			}
			setInterval(() => {
				if (((new Date().getTime() - lastClusterCheckin) / 60000).toFixed(2) >= 4.5) {
					Logger.printLine("ClusterIO", "Cluster Manager Communication was lost, Standby Mode", "critical");
					enablePullData = false;
				}
				request.get(`http://${systemglobal.Watchdog_Host}/cluster/ping?id=${systemglobal.Cluster_ID}&entity=${(systemglobal.Cluster_Entity) ? systemglobal.Cluster_Entity : facilityName + "-" + systemglobal.SystemName}`, async (err, res, body) => {
					if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
						console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${(systemglobal.Cluster_Entity) ? systemglobal.Cluster_Entity : facilityName + "-" + systemglobal.SystemName}:${systemglobal.Cluster_ID}`);
					} else {
						const jsonResponse = JSON.parse(Buffer.from(body).toString());
						if (jsonResponse.error) {
							console.error(jsonResponse.error);
						} else {
							lastClusterCheckin = (new Date().getTime())
							if (!jsonResponse.active) {
								if (enablePullData) {
									Logger.printLine("ClusterIO", "System is not the active master!", "warn");
									enablePullData = false;
								}
							} else if (!enablePullData) {
								Logger.printLine("ClusterIO", "System is now active master", "warn");
								enablePullData = true;
							}
						}
					}
				})
			}, 60000)
			cont(true)
		})
	} else {
		enablePullData = true;
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
		if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID && !systemglobal.Cluster_ID) {
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
		sleep(2500).then(async () => {
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
			//verifyQueue();
			if (enablePullData) {
				//updateStats();
			}
			cron.schedule('*/30 * * * *', () => {
				if (enablePullData) {
					//updateStats();
					getTweets();
					//getMentions();
				}
			});
			cron.schedule('0 * * * *', () => {
				if (enablePullData) {
					getLikes();
				}
			});
			//cron.schedule('4,34 * * * *', verifyQueue);
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
			if (obj.tweet.images && obj.tweet.images.length > 0) {
				let messageArray = [];
				let requests = obj.tweet.images.reduce((promiseChain, media, index, array) => {
					return promiseChain.then(() => new Promise((resolve) => {
						if (media.type === 'photo') {
							const filename = `${obj.tweet.screenName}-${obj.tweet.id}.${media.format}`
							getImagetoB64(media.media_url, null, (image) => {
								if (image !== null) {
									Logger.printLine("TweetDownload", `Account ${obj.accountid}: Got ${media.media_url}`, "debug", { url: media.media_url })
									db.safe(`SELECT * FROM twitter_autodownload WHERE LOWER(username) = ?`, [(obj.tweet.retweeted) ? obj.tweet.retweeted.toLowerCase() : obj.tweet.screenName.toLowerCase()], (err, autodownload) => {
										if (err) {
											Logger.printLine("SQL", `Error looking up autodownload for ${(obj.tweet.retweeted) ? obj.tweet.retweeted.toLowerCase() : obj.tweet.screenName.toLowerCase()}!`, "error", err);
										}
										db.safe(`SELECT channelid FROM twitter_user_redirect WHERE LOWER(twitter_username) = ?`, [(obj.tweet.retweeted) ? obj.tweet.retweeted.toLowerCase() : obj.tweet.screenName.toLowerCase()], function (err, channelreplacement) {
											if (err) {
												Logger.printLine("SQL", `SQL Error when getting to the Twitter Redirect records`, "error", err)
											}
											let tweetDate = moment(obj.tweet.date).format('YYYY-MM-DD HH:mm:ss')
											messageArray.push({
												fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
												messageType : 'sfile',
												messageReturn: false,
												messageChannelID : (!err && channelreplacement.length > 0) ? channelreplacement[0].channelid : obj.saveid,
												itemFileData: image,
												itemFileName: filename,
												itemDateTime: tweetDate,
												messageText: `**🌁 Twitter Image** - ***${obj.tweet.userName} (@${obj.tweet.screenName})***${(obj.tweet.text && obj.tweet.text.length > 0) ? '\n**' + obj.tweet.text + '**' : ''}`,
												tweetMetadata: {
													account: obj.accountid,
													list: obj.list_id,
													id: ((obj.tweet.retweeted && obj.tweet.retweeted_id)) ? obj.tweet.retweeted_id : obj.tweet.id,
													userId: (obj.tweet.retweeted) ? obj.tweet.retweeted : obj.tweet.screenName,
												}
											})
											resolve();
										})
										/*if (index === 0 && twitterNotify.has((((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name).toLowerCase())) {
											const notifyChannel = twitterNotify.get((((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name).toLowerCase())
											mqClient.publishData(`${systemglobal.Discord_Out}${(list.channelid_rt && tweet.text.includes("RT @")) ? '' : '.priority'}`, {
												fromClient : `return.${facilityName}.${obj.accountid}.${systemglobal.SystemName}`,
												messageType : 'sfileext',
												messageReturn: false,
												messageChannelID : notifyChannel,
												itemFileData: image,
												itemFileName: filename,
												messageText: `New Tweet from @${((obj.tweet.retweeted_status && obj.tweet.retweeted_status.user.screen_name)) ? obj.tweet.retweeted_status.user.screen_name : obj.tweet.user.screen_name}`,
												messageObject: {...messageObject, title: _title}
											})
										}*/
									})
								} else if (obj.channelid !== null) {
									resolve();
								}
							})
						} else {
							Logger.printLine("Twitter", `Account ${obj.accountid}: Unhandled Media Type "${media.type}" for Tweet in ${obj.fromname} from ${obj.tweet.screenName} - RT: ${rt_stat}`, "error", {
								tweetList: obj.fromname,
								tweetUser: obj.tweet.screenName,
								tweetID: obj.tweet.id,
								tweetText: obj.tweet.text,
								tweetType: "media",
								tweetAction: 'allow',
								tweetRT : 'false',
							})
							resolve();
						}
					}))
				}, Promise.resolve());
				requests.then(() => {
					Logger.printLine("Twitter", `Account ${obj.accountid}: New Media Tweet in ${obj.fromname} from ${obj.tweet.screenName} - RT: false`, "info", {
						tweetList: obj.fromname,
						tweetUser: obj.tweet.screenName,
						tweetID: obj.tweet.id,
						tweetText: obj.tweet.text,
						tweetType: "media",
						tweetAction: 'allow',
						tweetRT : 'false',
					})
					cb(messageArray);
				})
			} else {
				cb([]);
			}
		})
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
										mqClient.sendData(`${systemglobal.PDP_Out || systemglobal.Discord_Out}.priority`, {
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
								mqClient.sendData(`${systemglobal.PDP_Out || systemglobal.Discord_Out}.priority`, {
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
				const response = await getTweet(username, TweetID, twit);
				if (response.length > 0) {
					for (let media of response[0].images) {
						request.get({
							url: media.media_url,
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
								mqClient.sendData( `${systemglobal.PDP_Out || systemglobal.Discord_Out}.priority`, {
									fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
									messageType : 'sfile',
									messageReturn: false,
									messageChannelID : channelID,
									messageText : `**🌁 Twitter Image** - ***${response[0].userName} (@${response[0].screenName})***`,
									itemFileData : body.toString('base64'),
									itemFileSize: body.length,
									itemFileName : `${response[0].screenName}-${response[0].id}.${media.format}`,
									addButtons: buttons
								}, function (ok) {
									if (ok) {
										Logger.printLine("TwitterDownload", `Tweet ${TweetID} was downloaded to ${channelID}`, "info", {
											fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
											messageType : 'sfile',
											messageReturn: false,
											messageChannelID : channelID,
											messageText : "",
											itemFileName : `${response[0].screenName}-${response[0].id}.${media.format}`,
											addButtons: buttons
										})
									}
								})
							}
						});
					}
					cb(true);
				} else {
					cb(true);
				}
			});
		}
	}
	async function downloadUser(message, cb) {
		const twitterUser = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
		const twit = twitterAccounts.get(twitterUser);
		try {
			const tweets = await doomScrollUser(message.userID, twit);
			Logger.printLine("Twitter", `Account ${twitterUser}: Returning ${tweets.length} tweets for user ${message.userID}`, "info")
			let listRequests = tweets.reduce((promiseChain, tweet) => {
				return promiseChain.then(() => new Promise(async (tweetResolve) => {
					const lasttweet = await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE tweetid = ? LIMIT 1`, [(tweet.retweeted && tweet.retweeted_id) ? tweet.retweeted_id : tweet.id]);
					if (lasttweet.rows.length === 0 || message.allowDuplicates) {
						const competedTweet = await sendTweetToDiscordv2({
							channelid: message.messageChannelID || message.messageDestinationID || discordaccount[0].chid_download,
							saveid: message.messageDestinationID || discordaccount[0].chid_download,
							nsfw: message.listNsfw || 0,
							txtallowed: message.listTxtallowed || 0,
							fromname: message.listName || "Manual Download",
							tweet,
							redirect: message.listRedirect_taccount || 0,
							bypasscds: message.listBypasscds || 1,
							autolike: message.listAutolike || 0,
							replyenabled: message.listReplyenabled || 0,
							mergelike: message.listMergelike || 0,
							listusers: message.listUsers || 0,
							disablelike: message.listDisablelike || 0,
							list_num: message.listNum || 0,
							list_id: message.listId || 0,
							accountid: twitterUser,
						})
						if (competedTweet && competedTweet.length > 0) {
							let sent = true
							for (let i in competedTweet) {
								const _sent = await mqClient.publishData(`${systemglobal.PDP_Out || systemglobal.Discord_Out}`, competedTweet[i])
								if (!_sent)
									sent = false;
							}
							if (lasttweet.rows.length === 0 && sent)
								await db.query(`INSERT INTO twitter_history_inbound VALUES (?, ?, NOW())`, [(tweet.retweeted && tweet.retweeted_id) ? tweet.retweeted_id : tweet.id, message.listId || null])
						}
					}
					tweetResolve(true);
				}))
			}, Promise.resolve());
			listRequests.then(async (ok) => {
				cb(true);
			})
		} catch (err) {
			Logger.printLine("Twitter", `Failed to get users tweets using account ${twitterUser} - ${err.message}`, "error", err)
			console.error(err);
		}
	}
	function doAction(message, cb) {
		if (message.messageText !== 'undefined') {
			switch (message.messageIntent) {
				case "send":
					//sendTweet((message.accountID) ? message.accountID : 1, message, (ok) => {
					//	cb(true);
					//});
					cb(true);
					break;
				case "Like":
					// Liked
					//interactTweet(message, message.messageIntent, cb);
					cb(true);
					break;
				case "Retweet":
					//interactTweet(message, message.messageIntent, cb);
					cb(true);
					break;
				case "LikeRT":
					//interactTweet(message, 'Like', (retr) => {});
					//interactTweet(message, 'Retweet', cb);
					cb(true);
					break;
				case "Download":
					downloadTweet(message, cb);
					break;
				case "DownloadUser":
					downloadUser(message, cb);
					break;
				case "PullTweets":
					//downloadMissingTweets(message.listID);
					cb(true);
					break;
				case "SendTweet":
					//sendTweet((message.accountID) ? message.accountID : 1, message, (ok) => {
					//	cb(true);
					//});
					cb(true);
					break;
				case "Reply":
					//sendTweet((message.accountID) ? message.accountID : 1, message, (ok) => {
					//	cb(true);
					//});
					cb(true);
					break;
				case "listManager":
					cb(true);
					break;
				case "releaseTweet":
					//releaseTweet((message.accountID) ? message.accountID : 1, message.messageAction);
					cb(true);
					break;
				case "clearCollector":
					//clearCollector();
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

	async function getTweets(countLimit) {
		for (const e of Array.from(twitterAccounts.entries())) {
			const id = e[0];
			const twit = e[1];

			const twitterlist = await db.query(`SELECT * FROM twitter_list WHERE taccount = ?`, [id]);
			const twitterblockedwords = await db.query(`SELECT word FROM twitter_blockedwords WHERE taccount = ?`, [id])

			if (twitterlist.error) { console.error(twitterlist.error) }
			if (twitterblockedwords.error) { console.error(twitterblockedwords.error) }

			let messageArray = [];
			let listRequests = twitterlist.rows.reduce((promiseChain, list) => {
				return promiseChain.then(() => new Promise((listResolve) => {
					limiter1.removeTokens(1, async function () {
					const tweets = await doomScrollList(list, twit)
					let tweetRequests = tweets.reduce((promiseChain1, tweet) => {
						return promiseChain1.then(() => new Promise(async (tweetResolve) => {
							const _tweetID = (tweet.retweeted && tweet.retweeted_id) ? tweet.retweeted_id : tweet.id;
							const lasttweet = await db.query(`SELECT * FROM twitter_history_inbound WHERE tweetid = ? OR tweetid = ?`, [_tweetID, tweet.id]);
							const blocked = (tweet.text && tweet.text.length > 1) ? twitterblockedwords.rows.filter(e => tweet.text.includes(e.word)).map(e => e.word) : [];

							if (!lasttweet.error && lasttweet.rows.length === 0 && blocked.length === 0) {
								/*if (tweet.text.includes("RT @") && list.blockselfrt === 1 && tweet.user.screen_name.includes(tweet.text.split('RT @').pop().split(': ')[0])) {
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
								} else {*/
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
										disablelike: list.disablelike,
										list_num: list.id,
										list_id: list.listid,
										accountid: id,
									})
									if (competedTweet && competedTweet.length > 0) {
										let sent = true
										for (let i in competedTweet) {
											const _sent = await mqClient.publishData(`${systemglobal.PDP_Out || systemglobal.Discord_Out}${(list.channelid_rt && tweet.text.includes("RT @")) ? '' : '.priority'}`, competedTweet[i])
											if (!_sent)
												sent = false;
										}
										if (sent)
											await db.query(`INSERT IGNORE INTO twitter_history_inbound VALUES (?, ?, NOW())`, [_tweetID, list.listid]);
											db.query(`INSERT IGNORE INTO twitter_list_users SET username = ?, listid = ?`, [tweet.screenName, list.listid]);
									}
									tweetResolve(true);
							/*} else if (!lasttweet.error && lasttweet.rows.length === 0 && blocked.length > 0 ) {
								Logger.printLine("TwitterInbound", `Account ${id}: Tweet was blocked because it contained the word [ ${blocked.join(', ')} ]`, "warn", tweet)
								db.query(`INSERT IGNORE INTO twitter_history_inbound VALUES (?, ?, NOW())`, [_tweetID, list.listid])
								tweetResolve(false);*/
							} else {
								tweetResolve(false);
							}
						}));
					}, Promise.resolve());
					tweetRequests.then((ok) => {
						console.log(`Account ${id}: List Complete - ${list.listid}`)
						listResolve(true);
					});
					});
				}))
			}, Promise.resolve());
			listRequests.then(async (ok) => {
				if (messageArray.length > 0) {
					await messageArray.forEach(async (message) => {
						await mqClient.sendData( `${systemglobal.PDP_Out || systemglobal.Discord_Out}`, message, function (ok) {
							if (!ok) {
								Logger.printLine("mqClient.sendData", "Failed to send message to endpoint", "error")
							}
						});
					})
					messageArray = null;
				}
				console.log(`Account ${id}: Completed Pass`);
			})
		}
	}
	async function getLikes() {
		const twitterlistRows = await db.query(`SELECT * FROM twitter_list WHERE taccount = 1 AND remotecds_onlike = 1`, [])
		const twitterlist = twitterlistRows.rows.map(e => e.listid);
		limiter5.removeTokens(1, async function () {
			const twit = twitterAccounts.get(1)
			const tweets = await doomScrollFav(twit);
			const tweetIDs = tweets.map(e => ((e.retweeted && e.retweeted_id)) ? e.retweeted_id : e.id)
			const tweetsDB = (await db.query(`SELECT * FROM twitter_tweets WHERE decision IS NULL`)).rows.filter(e => twitterlist.indexOf(e.listid) !== -1 && tweetIDs.indexOf(e.tweetid) !== -1)
			tweetsDB.forEach(tweet => {
				const list = twitterlistRows.rows.filter(f => f.listid.toString() === tweet.listid.toString())[0]
				if (list && list.bypasscds && list.remote_saveid) {
					mqClient.sendData( `${systemglobal.Discord_Out}.priority`, {
						fromClient : `return.${facilityName}.${systemglobal.SystemName}`,
						messageAction: 'MovePost',
						messageType: 'command',
						messageReturn: false,
						messageChannelID: tweet.channelid,
						messageID: tweet.messageid,
						messageData: list.remote_saveid
					}, async function (ok) {
						if (ok) {
							Logger.printLine("TwitterDownload", `Tweet ${tweet.tweetid} was requested to move`, "info", {
								fromClient : `return.${facilityName}.${systemglobal.SystemName}`
							})
						}
					})
				} else if (!list || (list && !list.bypasscds)) {
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
							await db.query(`UPDATE twitter_tweets SET decision = 1 WHERE messageid = ?`, [tweet.messageid])
						}
					})
				}
			})

		});
	}

	async function doomScrollList(list, account) {
		let search = `list:${list.listid}`
		if (!list.textallowed)
			search += ' filter:images'
		if (!list.getretweets)
			search += ' -filter:retweets'
		const TWITTER_LIST_URL = `https://twitter.com/search?q=${encodeURIComponent(search)}&src=typed_query&f=live`;
		const SCROLL_DELAY_MS_MIN = 100;
		const SCROLL_DELAY_MS_MAX = 2500;
		const MAX_TWEET_COUNT = 500;

		Logger.printLine("HTDSv1", `Starting search query = ${search}...`, "info");

		const page = await account.browser.newPage();
		await page.setViewport({
			width: 1080,
			height: 1920,
			deviceScaleFactor: 1,
		});
		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36'
		);
		await page.setCookie(...account.cookie);
		await page.goto(TWITTER_LIST_URL, { waitUntil: 'networkidle2' });

		let previousHeight = 0;
		let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
		let returnedTweets = [];
		let parsedIDs = [];

		let latesttweets = (await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE listid = ?  AND timestamp >= now() - INTERVAL 1 DAY ORDER BY timestamp DESC`, [list.listid])).rows.map(e => e.tweetid);
		latesttweets.push(...(await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE listid = ? ORDER BY timestamp DESC LIMIT 100`, [list.listid])).rows.map(e => e.tweetid));

		Logger.printLine("HTDSv1", `${latesttweets.length} breakpoints are set and ready!`, "info");

		function checkHistory() { return latesttweets.filter(e => parsedIDs.indexOf(e.toString()) !== -1).length === 0 }

		let stop = false;
		let stopCount = 0;

		fs.rmSync(path.join(systemglobal.TempFolder, `screenshots/${list.listid}/`), { recursive: true, force: true });
		if (!fs.existsSync(path.join(systemglobal.TempFolder, `screenshots/${list.listid}/`))) {
			fs.mkdirSync(path.join(systemglobal.TempFolder, `screenshots/${list.listid}/`), { recursive: true });
		}

		while (!stop) {
			if (!(checkHistory()) || parsedIDs.length > MAX_TWEET_COUNT )
				stop = true;
			if (previousHeight === currentHeight) {
				if (stopCount > 25)
					stop = true;
				stopCount++;
			}
			await page.evaluate(() => { window.scrollBy(0, window.innerHeight); });
			//await page.keyboard.press("PageDown");
			await page.waitForTimeout(1200);

			previousHeight = currentHeight;
			currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

			returnedTweets.push(...(await page.evaluate(() => {
				const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'));
				const img_tweets = Array.from(
					twt
						.filter(e =>
							e.querySelector('img[src*="/media/"]') &&
							e.querySelectorAll('time').length === 1)
				)
				const nom_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length === 0)
				const rt_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length !== 0)

				console.log(`Doom Debugger: Normal - ${nom_tweets.length} RT - ${rt_tweets.length} Media - ${img_tweets.length} Total - ${twt.length}`);

				return [
					...nom_tweets.map(a => {
						const images = Array.from(a.querySelectorAll('img[src*="/media/"]')).map(e => {
							const url = e.src.split('?');
							const sq = new URLSearchParams(url[1]);
							sq.delete('name')
							sq.set('name', 'large')
							return {
								media_url: url[0] + '?' + sq.valueOf(),
								format: sq.getAll('format')[0],
								type: "photo"
							}
						});
						const userDiv = Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
						const screenName = userDiv.filter(e => e.includes('@')).pop().substring(1)
						const userName = userDiv.filter(e => !e.includes('@')).pop()
						const text = (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText )).join('') : ''
						const metadataDiv = a.querySelector('div[data-testid="User-Name"] a[href*="/status/"]')
						const id = metadataDiv.href.split('/').pop()
						const date = metadataDiv.querySelector('time').attributes['datetime'].value

						return { id, date, userName, screenName, text, images, retweeted: false };
					})
				]
				// Add RT support here
			})).filter(e => parsedIDs.indexOf(e.id) === -1));
			parsedIDs = [...new Set([...parsedIDs, ...returnedTweets.map(e => e.id)])];

			await page.screenshot({
				path: path.join(systemglobal.TempFolder, `screenshots/${list.listid}/${(new Date()).valueOf()}.jpg`),
				type: 'jpeg',
				encoding: 'binary',
				fullPage: false,
				quality: 50,
				captureBeyondViewport: true
			});
			await page.waitForTimeout(Math.floor(Math.random() * (SCROLL_DELAY_MS_MAX - SCROLL_DELAY_MS_MIN + 1)) + SCROLL_DELAY_MS_MIN);
		}
		await page.close();

		return returnedTweets;
	}
	async function doomScrollUser(user, account) {
		const search = `(from:${user}) filter:images -filter:retweets`
		const TWITTER_LIST_URL = `https://twitter.com/search?q=${encodeURIComponent(search)}&src=typed_query&f=live`;
		const SCROLL_DELAY_MS_MIN = 100;
		const SCROLL_DELAY_MS_MAX = 2500;

		Logger.printLine("HTDSv1", `Starting search query = ${search}...`, "info");

		const page = await account.browser.newPage();
		await page.setViewport({
			width: 1080,
			height: 4096,
			deviceScaleFactor: 1,
		});
		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36'
		);
		await page.setCookie(...account.cookie);
		await page.goto(TWITTER_LIST_URL, { waitUntil: 'networkidle2' });

		let previousHeight = 0;
		let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
		let returnedTweets = [];
		let parsedIDs = [];

		let stop = false;
		let stopCount = 0;

		fs.rmSync(path.join(systemglobal.TempFolder, `screenshots/dl-${user}/`), { recursive: true, force: true });
		if (!fs.existsSync(path.join(systemglobal.TempFolder, `screenshots/dl-${user}/`))) {
			fs.mkdirSync(path.join(systemglobal.TempFolder, `screenshots/dl-${user}/`), { recursive: true });
		}

		while (!stop) {
			if (previousHeight === currentHeight) {
				if (stopCount > 25)
					stop = true;
				stopCount++;
			}
			await page.evaluate(() => { window.scrollBy(0, window.innerHeight); });
			await page.waitForTimeout(1200);

			previousHeight = currentHeight;
			currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

			returnedTweets.push(...(await page.evaluate(() => {
				const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'));
				const img_tweets = Array.from(
					twt
						.filter(e =>
							e.querySelector('img[src*="/media/"]') &&
							e.querySelectorAll('time').length === 1)
				)
				const nom_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length === 0)
				const rt_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length !== 0)

				console.log(`Doom Debugger: Normal - ${nom_tweets.length} RT - ${rt_tweets.length} Media - ${img_tweets.length} Total - ${twt.length}`);

				return [
					...nom_tweets.map(a => {
						const images = Array.from(a.querySelectorAll('img[src*="/media/"]')).map(e => {
							const url = e.src.split('?');
							const sq = new URLSearchParams(url[1]);
							sq.delete('name')
							sq.set('name', 'large')
							return {
								media_url: url[0] + '?' + sq.valueOf(),
								format: sq.getAll('format')[0],
								type: "photo"
							}
						});
						const userDiv = Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
						const screenName = userDiv.filter(e => e.includes('@')).pop().substring(1)
						const userName = userDiv.filter(e => !e.includes('@')).pop()
						const text = (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText )).join('') : ''
						const metadataDiv = a.querySelector('div[data-testid="User-Name"] a[href*="/status/"]')
						const id = metadataDiv.href.split('/').pop()
						const date = metadataDiv.querySelector('time').attributes['datetime'].value

						return { id, date, userName, screenName, text, images, retweeted: false };
					})
				]
				// Add RT support here
			})).filter(e => parsedIDs.indexOf(e.id) === -1));
			parsedIDs = [...new Set([...parsedIDs, ...returnedTweets.map(e => e.id)])];
			await page.screenshot({
				path: path.join(systemglobal.TempFolder, `screenshots/dl-${user}/${(new Date()).valueOf()}.jpg`),
				type: 'jpeg',
				encoding: 'binary',
				fullPage: false,
				quality: 50,
				captureBeyondViewport: true
			});
			await page.waitForTimeout(Math.floor(Math.random() * (SCROLL_DELAY_MS_MAX - SCROLL_DELAY_MS_MIN + 1)) + SCROLL_DELAY_MS_MIN);
		}
		await page.close();

		return returnedTweets;
	}
	async function doomScrollFav(account) {
		const TWITTER_LIST_URL = `https://twitter.com/${account.screenName}/likes`;
		const SCROLL_DELAY_MS_MIN = 100;
		const SCROLL_DELAY_MS_MAX = 2500;
		const MAX_TWEET_COUNT = 250;

		Logger.printLine("HTDSv1", `Starting search favorites...`, "info");

		const page = await account.browser.newPage();
		await page.setViewport({
			width: 1080,
			height: 4096,
			deviceScaleFactor: 1,
		});
		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36'
		);
		await page.setCookie(...account.cookie);
		await page.goto(TWITTER_LIST_URL, { waitUntil: 'networkidle2' });

		let previousHeight = 0;
		let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
		let returnedTweets = [];
		let parsedIDs = [];

		let stop = false;
		let stopCount = 0;
		while (!stop) {
			if (parsedIDs.length > MAX_TWEET_COUNT )
				stop = true;
			if (previousHeight === currentHeight) {
				if (stopCount > 25)
					stop = true;
				stopCount++;
			}
			await page.evaluate(() => { window.scrollBy(0, window.innerHeight); });
			//await page.keyboard.press("PageDown");
			await page.waitForTimeout(1200);

			previousHeight = currentHeight;
			currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

			returnedTweets.push(...(await page.evaluate(() => {
				const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'));
				const img_tweets = Array.from(
					twt
						.filter(e =>
							e.querySelector('img[src*="/media/"]') &&
							e.querySelectorAll('time').length === 1)
				)
				const nom_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length === 0)
				const rt_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length !== 0)

				console.log(`Doom Debugger: Normal - ${nom_tweets.length} RT - ${rt_tweets.length} Media - ${img_tweets.length} Total - ${twt.length}`);

				return [
					...nom_tweets.map(a => {
						const images = Array.from(a.querySelectorAll('img[src*="/media/"]')).map(e => {
							const url = e.src.split('?');
							const sq = new URLSearchParams(url[1]);
							sq.delete('name')
							sq.set('name', 'large')
							return {
								media_url: url[0] + '?' + sq.valueOf(),
								format: sq.getAll('format')[0],
								type: "photo"
							}
						});
						const userDiv = Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
						const screenName = userDiv.filter(e => e.includes('@')).pop().substring(1)
						const userName = userDiv.filter(e => !e.includes('@')).pop()
						const text = (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText )).join('') : ''
						const metadataDiv = a.querySelector('div[data-testid="User-Name"] a[href*="/status/"]')
						const id = metadataDiv.href.split('/').pop()
						const date = metadataDiv.querySelector('time').attributes['datetime'].value

						return {
							id,
							date,
							userName,
							screenName,
							text,
							images,
							retweeted: false
						};
					})
				]
				// Add RT support here
			})).filter(e => parsedIDs.indexOf(e.id) === -1));
			parsedIDs = [...new Set([...parsedIDs, ...returnedTweets.map(e => e.id)])];
			await page.waitForTimeout(Math.floor(Math.random() * (SCROLL_DELAY_MS_MAX - SCROLL_DELAY_MS_MIN + 1)) + SCROLL_DELAY_MS_MIN);
		}
		await page.close();

		return returnedTweets;
	}
	async function getTweet(user, id, account) {
		const TWITTER_LIST_URL = `https://twitter.com/${user}/status/${id}`;

		Logger.printLine("HTDSv1", `Retrieving tweet ${user}/${id}...`, "info");

		const page = await account.browser.newPage();
		await page.setViewport({
			width: 1080,
			height: 4096,
			deviceScaleFactor: 1,
		});
		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36'
		);
		await page.setCookie(...account.cookie);
		await page.goto(TWITTER_LIST_URL, { waitUntil: 'networkidle2' });
		await page.waitForTimeout(1200);

		const returnedTweets = await page.evaluate(() => {
			const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'))[0];
			const img_tweets = Array.from(
				[twt]
					.filter(e =>
						e.querySelector('img[src*="/media/"]') &&
						e.querySelectorAll('time').length === 1)
			)
			return img_tweets.map(a => {
				const images = Array.from(a.querySelectorAll('img[src*="/media/"]')).map(e => {
					const url = e.src.split('?');
					const sq = new URLSearchParams(url[1]);
					sq.delete('name')
					sq.set('name', 'large')
					return {
						media_url: url[0] + '?' + sq.valueOf(),
						format: sq.getAll('format')[0],
						type: "photo"
					}
				});
				const userDiv = Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
				const screenName = userDiv.filter(e => e.includes('@')).pop().substring(1)
				const userName = userDiv.filter(e => !e.includes('@')).pop()
				const text = (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText )).join('') : ''
				const date = a.querySelector('time').attributes['datetime'].value

				return {
					id,
					date,
					userName,
					screenName,
					text,
					images,
					retweeted: false
				};
			});
			// Add RT support here
		})

		await page.close();

		return returnedTweets;
	}

	process.on('uncaughtException', function(err) {
		Array.from(twitterAccounts.values()).forEach(async e => {
			e.browser.close();
		})
		console.log(err)
		Logger.printLine("uncaughtException", err.message, "critical", err)
		process.exit(1)
	});
	tx2.action('pull', async (reply) => {
		await getTweets();
		reply({ answer : 'done' });
	})
	start();
})()