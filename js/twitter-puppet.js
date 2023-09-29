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
	let tAuthorization;
	let tGraphQL;

	let overflowControl = new Map();
	let activeTasks = new Map();
	let twitterAccounts = new Map();
	let twitterBrowsers = new Map();
	let twitterTabs = new Map();
	let twitterTabCloseures = {};
	let twitterBrowserCloseures = {};
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

	async function createBrowser(account) {
		const browser = await puppeteer.launch({
			executablePath: systemglobal.Chrome_Exec || undefined,
			headless: (account.headless !== undefined) ? account.headless : 'new',
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--inprivate',
				'--no-gpu',
				`--remote-debugging-port=${9222 + ((parseInt(account.id.toString())) - 1)}`,
				'--remote-debugging-address=0.0.0.0',
				'--enable-features=NetworkService',
			],
			ignoreHTTPSErrors: true
		})
		if (!account.allow_idle)
			browser.on('close', () => createBrowser(account))
		twitterBrowsers.set(parseInt(account.id.toString()), browser);
		Logger.printLine("BrowserManager", `Created new browser for account #${account.id}`, "info")
	}
	await Promise.all(systemglobal.Twitter_Accounts.map(async account => {
		if (account.id && account.cookies && account.screenName) {
			Logger.printLine("Twitter", "Settings up Twitter Client using account #" + account.id, "debug")
			if (account.flowcontrol)
				Logger.printLine("Twitter", `NOTE: Flow Control is enabled on account #${account.id}`, "debug")

			twitterAccounts.set(parseInt(account.id.toString()), {
				id: parseInt(account.id.toString()),
				cookie: account.cookies,
				screenName: account.screenName,
				headless: (account.headless !== undefined) ? account.headless : undefined,
				config: account.config,
				allow_idle: (account.id !== 1 && !account.no_idle),
				flowcontrol: (account.flowcontrol) ? account.flowcontrol : false
			})
			if (account.id === 1) {
				await createBrowser(account);
				await yoinkTwitterAPIKey(account.id);
			} else if (account.autostart) {
				await createBrowser(account);
			} else {
				Logger.printLine("Twitter", `NOTE: Browser is available as on-demand only for #${account.id}`, "debug")
			}
		} else {
			Logger.printLine("Twitter", `Missing Twitter Bot Login Properties for account ${account.id}, Please verify that they exists in the configuration file or the global_parameters table`, "critical");
		}
	}))

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
			ch.prefetch(1);
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
							storeTweet(MessageContents, cb);
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
				if (twit.config && twit.config.activity_channel === null) {
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
			verifyQueue();
			if (enablePullData) {
				//updateStats();
			}
			cron.schedule('*/30 * * * *', () => {
				if (enablePullData) {
					updateStats();
					getTweets();
					//getMentions();
				}
			});
			cron.schedule('0 * * * *', () => {
				if (enablePullData) {
					getLikes();
				}
			});
			cron.schedule('4,34 * * * *', verifyQueue);
		})
		if (process.send && typeof process.send === 'function') {
			process.send('ready');
		}
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
		const _tweetQueue = await db.query(`SELECT * FROM twitter_tweet_queue WHERE (system_id = ? OR system_id IS NULL) ORDER BY RAND() LIMIT 100`, [systemglobal.SystemName])
		if (_tweetQueue.errors) {
			Logger.printLine(`Collector`, `Failed to get tweet from collector due to an SQL error`, `error`, _tweetQueue.errors);
		} else {
			await Promise.all(Array.from(twitterAccounts.entries()).map(async e => {
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
								const page = await getTwitterTab(twit, `get`, `https://twitter.com/${twit.screenName}/status/${tweet.id.toString()}`);
								if (page) {
									const dead = await page.evaluate(async () => {
										return !(document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"]'));
									})
									if (dead) {
										Logger.printLine(`Collector`, `Account ${twitterUser}: Removed dead tweet ${tweet.id} from the collector!`, `info`);
										await db.safe(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ? AND action = ?`, [ twitterUser, tweet.id.toString(), tweet.action ], (err, results) => {
											if (err) {
												Logger.printLine(`Collector`, `Failed to delete tweet from collector due to an SQL error`, `error`, err);
											}
										});
									}
									closeTab(account, `get`);
								} else {
									Logger.printLine(`Collector`, `Account ${twitterUser}: Removed dead tweet ${tweet.id} from the collector!`, `info`);
									await db.safe(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ? AND action = ?`, [ twitterUser, tweet.id.toString(), tweet.action ], (err, results) => {
										if (err) {
											Logger.printLine(`Collector`, `Failed to delete tweet from collector due to an SQL error`, `error`, err);
										}
									});
								}
							})
						}
					}))
				}
			}))
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
					db.safe(`INSERT INTO twitter_tweet_queue SET taccount = ?, action = ?, id = ?, data = ?, system_id = ?`, [twitterUser, actionID, message.messageFileData, json, systemglobal.SystemName], (err, savedResult) => {
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
					db.safe(`INSERT INTO twitter_tweet_queue SET taccount = ?, action = ?, id = ?, system_id = ?`, [twitterUser, actionID, tweetID, systemglobal.SystemName], (err, savedResult) => {
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
				db.safe(`SELECT * FROM twitter_tweet_queue WHERE taccount = ?${(!enablePullData) ? ' AND system_id = "' + systemglobal.SystemName + '" AND action = "4"' : ''} ORDER BY RAND() LIMIT 100`, [twitterUser], async (err, tweetQueue) => {
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
											action: ['add-Like', 'add-Retweet'],
											type: 1,
											tweets: tweetQueue.filter(e => { return e.action === 1 })
										},
										{
											action: ['add-Retweet'],
											type: 2,
											tweets: tweetQueue.filter(e => { return e.action === 2 })
										},
										{
											action: ['add-Like'],
											type: 3,
											tweets: tweetQueue.filter(e => { return e.action === 3 })
										}
									];
									break;
								default:
									actionList = [
										{
											action: ['add-Like', 'add-Retweet'],
											type: 1,
											tweets: tweetQueue.filter(e => { return e.action === 1 })
										},
										{
											action: ['add-Retweet'],
											type: 2,
											tweets: tweetQueue.filter(e => { return e.action === 2 })
										},
										{
											action: ['add-Like'],
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
									action: ['add-Like', 'add-Retweet'],
									type: 1,
									tweets: tweetQueue.filter(e => { return e.action === 1 })
								},
								{
									action: ['add-Retweet'],
									type: 2,
									tweets: tweetQueue.filter(e => { return e.action === 2 })
								},
								{
									action: ['add-Like'],
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
						await Promise.all(actionList.map(async (releaseCollection) => {
							let keyIndex = -1;
							if (releaseCollection.tweets.length > 0 && releaseCollection.type === 4) {
								/*async function tryTweet() {
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
								await tryTweet();*/
							} else if (releaseCollection.tweets.length > 0 && releaseCollection.action.length > 0) {
								async function tryTweet() {
									keyIndex++;
									if (releaseCollection.tweets.length - 1 >= keyIndex && releaseCollection.tweets[keyIndex]) {
										const tweetID = releaseCollection.tweets[keyIndex].id;
										await limiter1.removeTokens(1, async function () {
											Logger.printLine(`Collector`, `Account ${twitterUser}: Releasing Tweet ${tweetID} from collector`, `info`);
											const page = await getTwitterTab(twit, `flowctrlrelease-${releaseCollection.tweets[keyIndex].uid}`, `https://twitter.com/${twit.screenName}/status/${tweetID}`, true);
											if (page){
												try {
													const results = await page.evaluate(async (rc) => {
														const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
														return await Promise.all(rc.map(async (ai) => {
															return await new Promise(async res => {
																if (document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"] [aria-label="There’s a new version of this Tweet."]')) {
																	const newTweet = document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"] [aria-label="There’s a new version of this Tweet."]')
																	const link = newTweet.parentNode.parentNode.parentNode.querySelector('a');
																	link.click();
																	while (!document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"]')) {
																		await sleep(1000);
																	}
																}
																const twt = document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"]');
																if (twt) {
																	try {
																		switch (ai) {
																			case "add-Like":
																				if (twt.querySelector('div[data-testid="like"]')) {
																					twt.querySelector('div[data-testid="like"]').click();
																					await sleep(1500);
																					res(!!(twt.querySelector('div[data-testid="unlike"]')));
																				} else {
																					res(1);
																				}
																				break;
																			case "add-Retweet":
																				if (twt.querySelector('div[data-testid="retweet"]')) {
																					twt.querySelector('div[data-testid="retweet"]').click();
																					await sleep(250);
																					document.querySelector('div[data-testid="Dropdown"] div[tabindex="0"]').click()
																					await sleep(1500);
																					res(!!(twt.querySelector('div[data-testid="unretweet"]')));
																				} else {
																					res(1);
																				}
																				break;
																			default:
																				res(false);
																				break;
																		}
																	} catch (e) {
																		console.error(`Failed to interact with tweets`);
																		res(false);
																	}
																} else {
																	res(false);
																}
															})
														}));
													}, releaseCollection.action)
													console.log(results)
													if (results[0] === false) {
														mqClient.sendMessage(`Unable to interact with tweet ${tweetID} for account #${twitterUser} with ${releaseCollection.action.join('/')}, Ticket will be Dropped!`, "warn", "TweetInteract", err);
														Logger.printLine(`Collector`, `Account ${twitterUser}: Failed to release Tweet ${tweetID} in collector, retrying...`, `error`);
														tryTweet()
													} else {
														Logger.printLine("TwitterInteract", `Account ${twitterUser}: Sent command ${releaseCollection.action.join('/')} to ${tweetID}: ${results}`, "info");
													}
												} catch (e) {
													Logger.printLine("TwitterInteract", `Failed to complete action for ${releaseCollection.action.join('/')} to ${id}: ${e.message}`, "error", e)
													console.error(e)
													tryTweet()
												}
												closeTab(twit, `flowctrlrelease-${releaseCollection.tweets[keyIndex].uid}`);
											} else {
												mqClient.sendMessage(`Unable to interact with tweet ${tweetID} for account #${twitterUser} with ${releaseCollection.action.join('/')}, Ticket will be Dropped!`, "warn", "TweetInteract", err);
												Logger.printLine(`Collector`, `Account ${twitterUser}: Failed to release Tweet ${tweetID} in collector (No Interface), retrying...`, `error`);
												tryTweet();
											}

											await db.safe(`DELETE FROM twitter_tweet_queue WHERE taccount = ? AND id = ? AND action = ?`, [twitterUser, tweetID, releaseCollection.type], (err, results) => {
												if (err) {
													Logger.printLine(`Collector`, `Account ${twitterUser}: Failed to delete tweet from collector due to an SQL error`, `error`, err);
												}
											});
										});
									}
								}
								await tryTweet();
							}
						}))
					} else {
						console.log('Empty Queue');
					}
				})
			}, (overFlowValuse - 1) * 5000)
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
						const filename = `${obj.tweet.screenName}-${obj.tweet.id}.${media.format}`
						if (media.type === 'photo') {
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
										/*if (index === 0 && twitterNotify.has(((obj.tweet.retweeted) ? obj.tweet.retweeted : obj.tweet.screenName).toLowerCase())) {
											const notifyChannel = twitterNotify.get(((obj.tweet.retweeted) ? obj.tweet.retweeted : obj.tweet.screenName).toLowerCase())
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
						} else if (media.type === "video" || media.type === "animated_gif") {
							Logger.printLine("TweetDownload", `Account ${obj.accountid}: Send ${media.media_url} to FileWorker`, "debug", { url: media.media_url })
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
										messageReturn: false,
										messageChannelID : (!err && channelreplacement.length > 0) ? channelreplacement[0].channelid : obj.saveid,
										itemFileName: filename,
										itemDateTime: tweetDate,
										itemFileURL: media.media_url,
										itemReferral: `https://twitter.com/status/${((obj.tweet.retweeted && obj.tweet.retweeted_id)) ? obj.tweet.retweeted_id : obj.tweet.id}`,
										messageText: `**🎞 Twitter Video** - ***${obj.tweet.userName} (@${obj.tweet.screenName})***${(obj.tweet.text && obj.tweet.text.length > 0) ? '\n**' + obj.tweet.text + '**' : ''}`,
										tweetMetadata: {
											account: obj.accountid,
											list: obj.list_id,
											id: ((obj.tweet.retweeted && obj.tweet.retweeted_id)) ? obj.tweet.retweeted_id : obj.tweet.id,
											userId: (obj.tweet.retweeted) ? obj.tweet.retweeted : obj.tweet.screenName,
										}
									})
									resolve();
								})
								/*if (index === 0 && twitterNotify.has(((obj.tweet.retweeted) ? obj.tweet.retweeted : obj.tweet.screenName).toLowerCase())) {
                                    const notifyChannel = twitterNotify.get(((obj.tweet.retweeted) ? obj.tweet.retweeted : obj.tweet.screenName).toLowerCase())
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
		const username = (message.messageEmbeds.length > 0 && message.messageEmbeds[0].author) ? message.messageEmbeds[0].author.name.split("(@").pop().slice(0, -1).toLowerCase() : getURLfromText(message.messageText).pop().split("/")[3].toLowerCase()
		const listinfo = await db.query(`SELECT taccount,name,saveid,nsfw,redirect_taccount FROM twitter_list WHERE listid = ?`, [message.listID])
		const channelreplacement = await db.query(`SELECT channelid FROM twitter_user_redirect WHERE twitter_username = ?`, [username])

		if (listinfo.error) {
			Logger.printLine("SQL", `SQL Error when getting Twitter Lists records`, "emergency", listinfo.error)
		}
		if (channelreplacement.error) {
			channelreplacement.printLine("SQL", `SQL Error when getting to the Twitter Redirect records`, "emergency", channelreplacement.error)
		}

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
		const TweetID = (message.messageEmbeds && message.messageEmbeds.length > 0 && message.messageEmbeds[0].title && (message.messageEmbeds[0].title.includes('📨 Tweet') || message.messageEmbeds[0].title.includes('✳ Retweet'))) ? message.messageEmbeds[0].url.split('/photo')[0].split('/').pop() : getIDfromText(message.messageText);
		const twit = twitterAccounts.get(1)
		try {
			const tweets = await getTweet(username, TweetID, twit);
			Logger.printLine("Twitter", `Account 1: Returning ${tweets.length} tweet @${username}:${TweetID}`, "info")
			let listRequests = tweets.reduce((promiseChain, tweet) => {
				return promiseChain.then(() => new Promise(async (tweetResolve) => {
					const lasttweet = await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE tweetid = ? LIMIT 1`, [(tweet.retweeted && tweet.retweeted_id) ? tweet.retweeted_id : tweet.id]);
					const competedTweet = await sendTweetToDiscordv2({
						channelid: channelID,
						saveid: channelID,
						nsfw: channelNsfw,
						txtallowed: 0,
						fromname: "Manual Download",
						tweet,
						redirect: 0,
						bypasscds: 1,
						autolike: 0,
						replyenabled: 0,
						mergelike: 0,
						listusers: 0,
						disablelike: 0,
						list_num: 0,
						list_id: 0,
						accountid: 1,
					})
					if (competedTweet && competedTweet.length > 0) {
						let sent = true
						for (let i in competedTweet) {
							const _sent = await mqClient.publishData((competedTweet[i].itemFileURL) ? systemglobal.FileWorker_In : `${systemglobal.PDP_Out || systemglobal.Discord_Out}`, competedTweet[i])
							if (!_sent)
								sent = false;
						}
						if (lasttweet.rows.length === 0 && sent)
							await db.query(`INSERT INTO twitter_history_inbound VALUES (?, ?, NOW())`, [(tweet.retweeted && tweet.retweeted_id) ? tweet.retweeted_id : tweet.id, null])
					}
					tweetResolve(true);
				}))
			}, Promise.resolve());
			listRequests.then(async (ok) => {
				cb(true);
			})
		} catch (err) {
			Logger.printLine("Twitter", `Failed to get users tweets using account 1 - ${err.message}`, "error", err)
			console.error(err);
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
								const _sent = await mqClient.publishData((competedTweet[i].itemFileURL) ? `${systemglobal.FileWorker_In}` : `${systemglobal.PDP_Out || systemglobal.Discord_Out}`, competedTweet[i])
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
					interactTweet(message, [message.messageIntent], cb);
					break;
				case "Retweet":
					interactTweet(message, [message.messageIntent], cb);
					break;
				case "LikeRT":
					interactTweet(message, ['Like', 'Retweet'], cb);
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

	let activeActions = [];
	async function interactTweet(message, intent, cb){
		const accountID = (message.accountID) ? parseInt(message.accountID.toString()) : 1;
		const account = twitterAccounts.get(accountID);
		let id = null;
		if ( message.messageEmbeds && message.messageEmbeds.length > 0 && message.messageEmbeds[0].title && (message.messageEmbeds[0].title.includes('📨 Tweet') || message.messageEmbeds[0].title.includes('✳ Retweet'))) {
			id = message.messageEmbeds[0].url.split("/").pop();
		} else if ( message.messageEmbeds && message.messageEmbeds.title && (message.messageEmbeds.title.includes('📨 Tweet') || message.messageEmbeds.title.includes('✳ Retweet'))) {
			id = message.messageEmbeds.url.split("/").pop();
		} else if (message.messageText.length > 0) {
			id = getIDfromText(message.messageText)
		}

		if (id && activeActions.indexOf(`${id}-${message.messageAction}-${intent.join('-')}`)  === -1) {
			activeActions.push(`${accountID}-${id}-${message.messageAction}-${intent.join('-')}`);
			try {
				const page = await getTwitterTab(account, `get`, `https://twitter.com/${account.screenName}/status/${id}`, true);
				if (page) {
					await Promise.all(intent.map(async thisIntent => {
						const results = await page.evaluate(async (action) => {
							const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
							if (document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"] [aria-label="There’s a new version of this Tweet."]')) {
								const newTweet = document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"] [aria-label="There’s a new version of this Tweet."]')
								const link = newTweet.parentNode.parentNode.parentNode.querySelector('a');
								link.click();
								while (!document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"]')) {
									await sleep(1000);
								}
							}
							const twt = document.querySelector('div[data-testid="cellInnerDiv"] article[data-testid="tweet"][tabindex="-1"]');
							//document.querySelector('[aria-label="There’s a new version of this Tweet."]').parentNode.parentNode.parentNode.querySelector('a')
							return await new Promise(async res => {
								if (twt) {
									try {
										switch (action) {
											case "add-Like":
												if (twt.querySelector('div[data-testid="like"]')) {
													twt.querySelector('div[data-testid="like"]').click();
													await sleep(1500);
													res(!!(twt.querySelector('div[data-testid="unlike"]')));
												} else {
													res(1);
												}
												break;
											case "remove-Like":
												if (twt.querySelector('div[data-testid="unlike"]')) {
													twt.querySelector('div[data-testid="unlike"]').click();
													await sleep(1500);
													res(!!(twt.querySelector('div[data-testid="like"]')));
												} else {
													res(1);
												}
												break;
											case "add-Retweet":
												if (twt.querySelector('div[data-testid="retweet"]')) {
													twt.querySelector('div[data-testid="retweet"]').click();
													await sleep(250);
													document.querySelector('div[data-testid="Dropdown"] div[tabindex="0"]').click()
													await sleep(1500);
													res(!!(twt.querySelector('div[data-testid="unretweet"]')));
												} else {
													res(1);
												}
												break;
											case "remove-Retweet":
												if (twt.querySelector('div[data-testid="unretweet"]')) {
													twt.querySelector('div[data-testid="unretweet"]').click();
													await sleep(250);
													document.querySelector('div[data-testid="Dropdown"] div[tabindex="0"]').click()
													await sleep(1500);
													res(!!(twt.querySelector('div[data-testid="retweet"]')));
												} else {
													res(1);
												}
												break;
											default:
												res(false);
												break;
										}
									} catch (e) {
										console.error(`Failed to interact with tweets`);
										res(false);
									}
								} else {
									res(false);
								}
							})
						}, `${message.messageAction}-${thisIntent}`)
						Logger.printLine("TwitterInteract", `Account ${accountID}: Sent command ${message.messageAction}/${thisIntent} to ${id}: ${results}`, "info")
						return results;
					}));
					closeTab(account, `get`);
					cb(true);
				} else {
					Logger.printLine("TwitterInteract", `Failed to interact with tweet because never got a tab`, "error")
					cb(false);
				}
			} catch (e) {
				Logger.printLine("TwitterInteract", `Failed to complete action for ${message.messageAction}/${intent.join('+')} to ${id}: ${e.message}`, "error", e)
				console.error(e)
				cb(false);
			}
		} else {
			cb(true);
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
											const _sent = await mqClient.publishData((competedTweet[i].itemFileURL) ? `${systemglobal.FileWorker_In}` : `${systemglobal.PDP_Out || systemglobal.Discord_Out}${(list.channelid_rt && tweet.text.includes("RT @")) ? '' : '.priority'}`, competedTweet[i])
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
						Logger.printLine("TwitterIngest", `Account ${id}: List Complete - ${list.listid}`, "info")
						listResolve(true);
					});
					});
				}))
			}, Promise.resolve());
			listRequests.then(async (ok) => {
				if (messageArray.length > 0) {
					await messageArray.forEach(async (message) => {
						await mqClient.sendData( (message.itemFileURL) ? `${systemglobal.FileWorker_In}` : `${systemglobal.PDP_Out || systemglobal.Discord_Out}`, message, function (ok) {
							if (!ok) {
								Logger.printLine("mqClient.sendData", "Failed to send message to endpoint", "error")
							}
						});
					})
					messageArray = null;
				}
				Logger.printLine("TwitterIngest", `Account ${id}: Completed Pass`, "info")
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

	async function getTwitterTab(account, task, url, wait_for_tweet) {
		try {
			if (twitterTabCloseures[`${task}-${account.id}`]) {
				clearTimeout(twitterTabCloseures[`${task}-${account.id}`]);
				delete twitterTabCloseures[`${task}-${account.id}`]
			}
			if (account.allow_idle && twitterBrowsers.has(account.id) && twitterBrowserCloseures[account.id]) {
				clearTimeout(twitterBrowserCloseures[account.id]);
				delete twitterBrowserCloseures[account.id]
			}
			if (twitterTabs.has(`${task}-${account.id}`)) {
				const page = twitterTabs.get(`${task}-${account.id}`);
				if (wait_for_tweet) {
					await page.goto(url);
					let i = 0;
					while (i <= 4) {
						i++;
						try {
							await page.waitForSelector('div[data-testid="cellInnerDiv"] article, div[data-testid="error-detail"]')
							i = 100
						} catch (e) {
							Logger.printLine("TabManager", `Page failed to return a article! Retry...`, "error")
						}
					}
					if (i >= 5 && i !== 100) {
						Logger.printLine("TabManager", `Failed to launch browser/tab: Timeout`, "error");
						return false;
					}
				} else {
					await page.goto(url, {waitUntil: 'networkidle2'});
				}
				return page;
			} else {
				if (!twitterBrowsers.has(account.id))
					await createBrowser(account)
				const browser = twitterBrowsers.get(account.id);
				Logger.printLine("TabManager", `Created Tab for account #${account.id} task "${task}"`, "info")
				const page = await browser.newPage();
				await page.setViewport({
					width: 1080,
					height: 4096,
					deviceScaleFactor: 1,
				});
				await page.setUserAgent(
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edge/92.0.902.73'
				);
				await page.setCookie(...account.cookie);
				/*page.on('console', msg => {
                    for (let i = 0; i < msg.args().length; i++) {
                        console.log(msg.args()[i]);
                    }
                });*/
				if (wait_for_tweet) {
					await page.goto(url);
					let i = 0;
					while (i <= 4) {
						i++;
						try {
							await page.waitForSelector('div[data-testid="cellInnerDiv"] article, div[data-testid="error-detail"]')
							i = 100
						} catch (e) {
							Logger.printLine("TabManager", `Page failed to return a article! Retry...`, "error")
						}
					}
					if (i >= 5 && i !== 100) {
						Logger.printLine("TabManager", `Failed to launch browser/tab: Timeout`, "error");
						return false;
					}
				} else {
					await page.goto(url, {waitUntil: 'networkidle2'});
				}
				Logger.printLine("TabManager", `Tab for account #${account.id} task "${task}" is ready`, "info")
				twitterTabs.set(`${task}-${account.id}`, page);
				return page;
			}
		} catch (err) {
			Logger.printLine("TabManager", `Failed to launch browser/tab: ${err.message}`, "error", err);
			console.error(err);
			return false;
		}
	}
	function closeTab(account, task) {
		if (twitterTabs.has(`${task}-${account.id}`)) {
			if (twitterTabCloseures[`${task}-${account.id}`]) {
				clearTimeout(twitterTabCloseures[`${task}-${account.id}`]);
			}
			twitterTabCloseures[`${task}-${account.id}`] = setTimeout(async () => {
				const page = twitterTabs.get(`${task}-${account.id}`);
				await page.close();
				Logger.printLine("TabManager", `Closed Inactive Tab: ${task}-${account.id}`, "warn")
				twitterTabs.delete(`${task}-${account.id}`)
				delete twitterTabCloseures[`${task}-${account.id}`]
			}, 60000)
		}
		if (account.allow_idle && twitterBrowsers.has(account.id)) {
			if (twitterBrowserCloseures[account.id]) {
				clearTimeout(twitterBrowserCloseures[account.id]);
			}
			twitterBrowserCloseures[account.id] = setTimeout(async () => {
				const browser = twitterBrowsers.get(account.id);
				await browser.close();
				Logger.printLine("BrowserManager", `Closed Inactive Browser for account #${account.id}`, "warn")
				twitterBrowsers.delete(account.id)
				delete twitterBrowserCloseures[account.id]
			}, 90000)
		}
	}
	async function doomScrollList(list, account) {
		let search = `list:${list.listid}`
		if (!list.textallowed)
			search += ' filter:media'
		if (!list.getretweets)
			search += ' -filter:retweets'
		const TWITTER_LIST_URL = `https://twitter.com/search?q=${encodeURIComponent(search)}&src=typed_query&f=live`;
		const SCROLL_DELAY_MS_MIN = 100;
		const SCROLL_DELAY_MS_MAX = 2500;
		const MAX_TWEET_COUNT = 500;

		Logger.printLine("HTDSv1", `Starting search query = ${search}...`, "info");
		const page = await getTwitterTab(account, `list`, TWITTER_LIST_URL, true)

		if (page) {
			let previousHeight = 0;
			let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
			let returnedTweets = [];
			let parsedIDs = [];

			let latesttweets = (await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE listid = ?  AND timestamp >= now() - INTERVAL 1 DAY ORDER BY timestamp DESC`, [list.listid])).rows.map(e => e.tweetid);
			latesttweets.push(...(await db.query(`SELECT tweetid FROM twitter_history_inbound WHERE listid = ? ORDER BY timestamp DESC LIMIT 100`, [list.listid])).rows.map(e => e.tweetid));

			Logger.printLine("HTDSv1", `${latesttweets.length} breakpoints are set and ready!`, "info");

			function checkHistory() {
				return latesttweets.filter(e => parsedIDs.indexOf(e.toString()) !== -1).length === 0
			}

			let stop = false;
			let stopCount = 0;

			fs.rmSync(path.join(systemglobal.TempFolder, `screenshots/${list.listid}/`), {
				recursive: true,
				force: true
			});
			if (!fs.existsSync(path.join(systemglobal.TempFolder, `screenshots/${list.listid}/`))) {
				fs.mkdirSync(path.join(systemglobal.TempFolder, `screenshots/${list.listid}/`), {recursive: true});
			}

			while (!stop) {
				if (!(checkHistory()) || parsedIDs.length > MAX_TWEET_COUNT)
					stop = true;
				if (previousHeight === currentHeight) {
					if (stopCount > 25)
						stop = true;
					stopCount++;
				}
				await page.evaluate(() => {
					window.scrollBy(0, window.innerHeight);
				});
				//await page.keyboard.press("PageDown");
				await page.waitForTimeout(1200);

				previousHeight = currentHeight;
				currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

				returnedTweets.push(...(await page.evaluate(async (gql, auth) => {
					async function getMediaURL(status_id, images, has_video) {
						if (has_video) {
							let _json = await fetchJson(status_id);
							let tweet = _json.legacy;
							let medias = tweet.extended_entities && tweet.extended_entities.media;
							if (medias.length > 0) {
								const media_array = medias.map(media => {
									const url = media.type == 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type == 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url;
									return {
										media_url: url,
										format: url.split('.').pop().split(':')[0].split('?')[0],
										type: media.type
									}
								})
								return {
									images: media_array,
									data: _json
								};
							} else {
								return {
									images: [],
									data: _json
								};
							}
						} else {
							return {
								images
							}
						}
					}

					let lastAPIAccessTime = null;
					const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

					async function fetchJson(status_id) {
						if (lastAPIAccessTime && !(Date.now() - lastAPIAccessTime > 30000)) {
							console.log(`Artificial Rate Limit Applied: Less then 30 Sec sense last call!`)
							await sleep(30000);
						}
						lastAPIAccessTime = Date.now();
						const host = location.hostname;
						const base_url = `https://${host}/i/api/graphql/${gql}/TweetDetail`;
						const variables = {
							"focalTweetId": status_id,
							"referrer": "tweet",
							"with_rux_injections": false,
							"includePromotedContent": true,
							"withCommunity": true,
							"withQuickPromoteEligibilityTweetFields": true,
							"withBirdwatchNotes": true,
							"withVoice": true,
							"withV2Timeline": true
						};
						const features = {
							"responsive_web_graphql_exclude_directive_enabled": true,
							"verified_phone_label_enabled": false,
							"responsive_web_home_pinned_timelines_enabled": false,
							"creator_subscriptions_tweet_preview_api_enabled": true,
							"responsive_web_graphql_timeline_navigation_enabled": true,
							"responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
							"tweetypie_unmention_optimization_enabled": true,
							"responsive_web_edit_tweet_api_enabled": true,
							"graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
							"view_counts_everywhere_api_enabled": true,
							"longform_notetweets_consumption_enabled": true,
							"responsive_web_twitter_article_tweet_consumption_enabled": false,
							"tweet_awards_web_tipping_enabled": false,
							"freedom_of_speech_not_reach_fetch_enabled": true,
							"standardized_nudges_misinfo": true,
							"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
							"longform_notetweets_rich_text_read_enabled": true,
							"longform_notetweets_inline_media_enabled": true,
							"responsive_web_media_download_video_enabled": false,
							"responsive_web_enhance_cards_enabled": false
						};
						const url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`);
						const cookies = (() => {
							let _cookies = {};
							document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
								n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
									_cookies[name.trim()] = value.trim();
								});
							});
							return name ? _cookies[name] : _cookies;
						})()
						const headers = {
							'authorization': auth,
							'x-twitter-active-user': 'yes',
							'x-twitter-client-language': cookies.lang,
							'x-csrf-token': cookies.ct0
						};
						if (cookies.ct0.length === 32) headers['x-guest-token'] = cookies.gt;
						const tweet_detail = await fetch(url, {headers: headers}).then(result => result.json());
						const tweet_entrie = tweet_detail.data.threaded_conversation_with_injections_v2.instructions[0].entries.find(n => n.entryId === `tweet-${status_id}`);
						const tweet_result = tweet_entrie.content.itemContent.tweet_results.result;
						return tweet_result.tweet || tweet_result;
					}

					const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'));
					const img_tweets = Array.from(twt.filter(e => e.querySelectorAll('time').length === 1))
					const nom_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length === 0)
					const rt_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length !== 0)

					console.log(`Doom Debugger: Normal - ${nom_tweets.length} RT - ${rt_tweets.length} Media - ${img_tweets.length} Total - ${twt.length}`);

					return [
						...(await Promise.all(nom_tweets.map(async a => {
							const metadataDiv = a.querySelector('div[data-testid="User-Name"] a[href*="/status/"]')
							const id = metadataDiv.href.split('/').pop().split('?')[0]
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
							const json = await getMediaURL(id, images, ((a.querySelectorAll('div[data-testid="videoComponent"], div[aria-label="Embedded video"]')).length > 0));
							const tweet = (json && json.core && json.core.user_results && json.core.user_results.result && json.core.user_results.result.legacy) ? json.core.user_results : undefined;
							const userDiv = (tweet) ? undefined : Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
							const screenName = (tweet) ? tweet.screen_name : userDiv.filter(e => e.includes('@')).pop().substring(1);
							const userName = (tweet) ? tweet.name : userDiv.filter(e => !e.includes('@')).pop()
							const text = (json && json.legacy && json.legacy.full_text) ? json.legacy.full_text : (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText)).join('') : ''
							const date = metadataDiv.querySelector('time').attributes['datetime'].value;

							return {
								id,
								date,
								userName,
								screenName,
								text,
								images: json.images,
								retweeted: false,
								is_api_backed: !!tweet
							};
						})))
					]
					// Add RT support here
				}, tGraphQL, tAuthorization)).filter(e => parsedIDs.indexOf(e.id) === -1));
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
			closeTab(account, `list`)

			return returnedTweets;
		} else {
			Logger.printLine("HTDSv1", `Failed to read list because never got a tab`, "error")
			return [];
		}
	}
	async function doomScrollUser(user, account) {
		const search = `(from:${user}) filter:media -filter:retweets`
		const TWITTER_LIST_URL = `https://twitter.com/search?q=${encodeURIComponent(search)}&src=typed_query&f=live`;
		const SCROLL_DELAY_MS_MIN = 100;
		const SCROLL_DELAY_MS_MAX = 2500;

		Logger.printLine("HTDSv1", `Starting search query = ${search}...`, "info");
		const page = await getTwitterTab(account, `get`, TWITTER_LIST_URL, true)

		if (page) {
			let previousHeight = 0;
			let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
			let returnedTweets = [];
			let parsedIDs = [];

			let stop = false;
			let stopCount = 0;

			fs.rmSync(path.join(systemglobal.TempFolder, `screenshots/dl-${user}/`), {recursive: true, force: true});
			if (!fs.existsSync(path.join(systemglobal.TempFolder, `screenshots/dl-${user}/`))) {
				fs.mkdirSync(path.join(systemglobal.TempFolder, `screenshots/dl-${user}/`), {recursive: true});
			}

			while (!stop) {
				if (previousHeight === currentHeight) {
					if (stopCount > 25)
						stop = true;
					stopCount++;
				}
				await page.evaluate(() => {
					window.scrollBy(0, window.innerHeight);
				});
				await page.waitForTimeout(1200);

				previousHeight = currentHeight;
				currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

				returnedTweets.push(...(await page.evaluate(async (gql, auth) => {
					async function getMediaURL(status_id, images, has_video) {
						if (has_video) {
							let _json = await fetchJson(status_id);
							let tweet = _json.legacy;
							let medias = tweet.extended_entities && tweet.extended_entities.media;
							if (medias.length > 0) {
								const media_array = medias.map(media => {
									const url = media.type == 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type == 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url;
									return {
										media_url: url,
										format: url.split('.').pop().split(':')[0].split('?')[0],
										type: media.type
									}
								})
								return {
									images: media_array,
									data: _json
								};
							} else {
								return {
									images: [],
									data: _json
								};
							}
						} else {
							return {
								images
							}
						}
					}

					let lastAPIAccessTime = null;
					const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

					async function fetchJson(status_id) {
						if (lastAPIAccessTime && !(Date.now() - lastAPIAccessTime > 30000)) {
							console.log(`Artificial Rate Limit Applied: Less then 30 Sec sense last call!`)
							await sleep(30000);
						}
						lastAPIAccessTime = Date.now();
						const host = location.hostname;
						const base_url = `https://${host}/i/api/graphql/${gql}/TweetDetail`;
						const variables = {
							"focalTweetId": status_id,
							"referrer": "tweet",
							"with_rux_injections": false,
							"includePromotedContent": true,
							"withCommunity": true,
							"withQuickPromoteEligibilityTweetFields": true,
							"withBirdwatchNotes": true,
							"withVoice": true,
							"withV2Timeline": true
						};
						const features = {
							"responsive_web_graphql_exclude_directive_enabled": true,
							"verified_phone_label_enabled": false,
							"responsive_web_home_pinned_timelines_enabled": false,
							"creator_subscriptions_tweet_preview_api_enabled": true,
							"responsive_web_graphql_timeline_navigation_enabled": true,
							"responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
							"tweetypie_unmention_optimization_enabled": true,
							"responsive_web_edit_tweet_api_enabled": true,
							"graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
							"view_counts_everywhere_api_enabled": true,
							"longform_notetweets_consumption_enabled": true,
							"responsive_web_twitter_article_tweet_consumption_enabled": false,
							"tweet_awards_web_tipping_enabled": false,
							"freedom_of_speech_not_reach_fetch_enabled": true,
							"standardized_nudges_misinfo": true,
							"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
							"longform_notetweets_rich_text_read_enabled": true,
							"longform_notetweets_inline_media_enabled": true,
							"responsive_web_media_download_video_enabled": false,
							"responsive_web_enhance_cards_enabled": false
						};
						const url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`);
						const cookies = (() => {
							let _cookies = {};
							document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
								n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
									_cookies[name.trim()] = value.trim();
								});
							});
							return name ? _cookies[name] : _cookies;
						})()
						const headers = {
							'authorization': auth,
							'x-twitter-active-user': 'yes',
							'x-twitter-client-language': cookies.lang,
							'x-csrf-token': cookies.ct0
						};
						if (cookies.ct0.length === 32) headers['x-guest-token'] = cookies.gt;
						const tweet_detail = await fetch(url, {headers: headers}).then(result => result.json());
						const tweet_entrie = tweet_detail.data.threaded_conversation_with_injections_v2.instructions[0].entries.find(n => n.entryId === `tweet-${status_id}`);
						const tweet_result = tweet_entrie.content.itemContent.tweet_results.result;
						return tweet_result.tweet || tweet_result;
					}

					const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'));
					const img_tweets = Array.from(twt.filter(e => e.querySelectorAll('time').length === 1))
					const nom_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length === 0)
					const rt_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length !== 0)

					console.log(`Doom Debugger: Normal - ${nom_tweets.length} RT - ${rt_tweets.length} Media - ${img_tweets.length} Total - ${twt.length}`);

					return [
						...(await Promise.all(nom_tweets.map(async a => {
							const metadataDiv = a.querySelector('div[data-testid="User-Name"] a[href*="/status/"]')
							const id = metadataDiv.href.split('/').pop().split('?')[0]
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
							const json = await getMediaURL(id, images, ((a.querySelectorAll('div[data-testid="videoComponent"], div[aria-label="Embedded video"]')).length > 0));
							const tweet = (json && json.core && json.core.user_results && json.core.user_results.result && json.core.user_results.result.legacy) ? json.core.user_results : undefined;
							const userDiv = (tweet) ? undefined : Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
							const screenName = (tweet) ? tweet.screen_name : userDiv.filter(e => e.includes('@')).pop().substring(1);
							const userName = (tweet) ? tweet.name : userDiv.filter(e => !e.includes('@')).pop()
							const text = (json && json.legacy && json.legacy.full_text) ? json.legacy.full_text : (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText)).join('') : ''
							const date = metadataDiv.querySelector('time').attributes['datetime'].value;

							return {
								id,
								date,
								userName,
								screenName,
								text,
								images: json.images,
								retweeted: false,
								is_api_backed: !!tweet
							};
						})))
					]
					// Add RT support here
				}, tGraphQL, tAuthorization)).filter(e => parsedIDs.indexOf(e.id) === -1));
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
			closeTab(account, `get`)

			return returnedTweets;
		} else {
			Logger.printLine("HTDSv1", `Failed to get user because never got a tab`, "error")
			return [];
		}
	}
	async function doomScrollFav(account) {
		const TWITTER_LIST_URL = `https://twitter.com/${account.screenName}/likes`;
		const SCROLL_DELAY_MS_MIN = 100;
		const SCROLL_DELAY_MS_MAX = 2500;
		const MAX_TWEET_COUNT = 250;

		Logger.printLine("HTDSv1", `Starting search favorites...`, "info");
		const page = await getTwitterTab(account, `fav`, TWITTER_LIST_URL);

		if (page) {
			let previousHeight = 0;
			let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
			let returnedTweets = [];
			let parsedIDs = [];

			let stop = false;
			let stopCount = 0;
			while (!stop) {
				if (parsedIDs.length > MAX_TWEET_COUNT)
					stop = true;
				if (previousHeight === currentHeight) {
					if (stopCount > 25)
						stop = true;
					stopCount++;
				}
				await page.evaluate(() => {
					window.scrollBy(0, window.innerHeight);
				});
				//await page.keyboard.press("PageDown");
				await page.waitForTimeout(1200);

				previousHeight = currentHeight;
				currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

				returnedTweets.push(...(await page.evaluate(async (gql, auth) => {
					async function getMediaURL(status_id, images, has_video) {
						if (has_video) {
							let _json = await fetchJson(status_id);
							let tweet = _json.legacy;
							let medias = tweet.extended_entities && tweet.extended_entities.media;
							if (medias.length > 0) {
								const media_array = medias.map(media => {
									const url = media.type == 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type == 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url;
									return {
										media_url: url,
										format: url.split('.').pop().split(':')[0].split('?')[0],
										type: media.type
									}
								})
								return {
									images: media_array,
									data: _json
								};
							} else {
								return {
									images: [],
									data: _json
								};
							}
						} else {
							return {
								images
							}
						}
					}

					let lastAPIAccessTime = null;
					const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

					async function fetchJson(status_id) {
						if (lastAPIAccessTime && !(Date.now() - lastAPIAccessTime > 30000)) {
							console.log(`Artificial Rate Limit Applied: Less then 30 Sec sense last call!`)
							await sleep(30000);
						}
						lastAPIAccessTime = Date.now();
						const host = location.hostname;
						const base_url = `https://${host}/i/api/graphql/${gql}/TweetDetail`;
						const variables = {
							"focalTweetId": status_id,
							"referrer": "tweet",
							"with_rux_injections": false,
							"includePromotedContent": true,
							"withCommunity": true,
							"withQuickPromoteEligibilityTweetFields": true,
							"withBirdwatchNotes": true,
							"withVoice": true,
							"withV2Timeline": true
						};
						const features = {
							"responsive_web_graphql_exclude_directive_enabled": true,
							"verified_phone_label_enabled": false,
							"responsive_web_home_pinned_timelines_enabled": false,
							"creator_subscriptions_tweet_preview_api_enabled": true,
							"responsive_web_graphql_timeline_navigation_enabled": true,
							"responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
							"tweetypie_unmention_optimization_enabled": true,
							"responsive_web_edit_tweet_api_enabled": true,
							"graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
							"view_counts_everywhere_api_enabled": true,
							"longform_notetweets_consumption_enabled": true,
							"responsive_web_twitter_article_tweet_consumption_enabled": false,
							"tweet_awards_web_tipping_enabled": false,
							"freedom_of_speech_not_reach_fetch_enabled": true,
							"standardized_nudges_misinfo": true,
							"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
							"longform_notetweets_rich_text_read_enabled": true,
							"longform_notetweets_inline_media_enabled": true,
							"responsive_web_media_download_video_enabled": false,
							"responsive_web_enhance_cards_enabled": false
						};
						const url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`);
						const cookies = (() => {
							let _cookies = {};
							document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
								n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
									_cookies[name.trim()] = value.trim();
								});
							});
							return name ? _cookies[name] : _cookies;
						})()
						const headers = {
							'authorization': auth,
							'x-twitter-active-user': 'yes',
							'x-twitter-client-language': cookies.lang,
							'x-csrf-token': cookies.ct0
						};
						if (cookies.ct0.length === 32) headers['x-guest-token'] = cookies.gt;
						const tweet_detail = await fetch(url, {headers: headers}).then(result => result.json());
						const tweet_entrie = tweet_detail.data.threaded_conversation_with_injections_v2.instructions[0].entries.find(n => n.entryId === `tweet-${status_id}`);
						const tweet_result = tweet_entrie.content.itemContent.tweet_results.result;
						return tweet_result.tweet || tweet_result;
					}

					const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'));
					const img_tweets = Array.from(twt.filter(e => e.querySelectorAll('time').length === 1))
					const nom_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length === 0)
					const rt_tweets = img_tweets.filter(e => Array.from(e.querySelectorAll(`span`)).filter(f => f.innerText.includes(' Retweet')).length !== 0)

					console.log(`Doom Debugger: Normal - ${nom_tweets.length} RT - ${rt_tweets.length} Media - ${img_tweets.length} Total - ${twt.length}`);

					return [
						...(await Promise.all(nom_tweets.map(async a => {
							const metadataDiv = a.querySelector('div[data-testid="User-Name"] a[href*="/status/"]')
							const id = metadataDiv.href.split('/').pop().split('?')[0]
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
							const json = await getMediaURL(id, images, ((a.querySelectorAll('div[data-testid="videoComponent"], div[aria-label="Embedded video"]')).length > 0));
							const tweet = (json && json.core && json.core.user_results && json.core.user_results.result && json.core.user_results.result.legacy) ? json.core.user_results : undefined;
							const userDiv = (tweet) ? undefined : Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
							const screenName = (tweet) ? tweet.screen_name : userDiv.filter(e => e.includes('@')).pop().substring(1);
							const userName = (tweet) ? tweet.name : userDiv.filter(e => !e.includes('@')).pop()
							const text = (json && json.legacy && json.legacy.full_text) ? json.legacy.full_text : (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText)).join('') : ''
							const date = metadataDiv.querySelector('time').attributes['datetime'].value;

							return {
								id,
								date,
								userName,
								screenName,
								text,
								images: json.images,
								retweeted: false,
								is_api_backed: !!tweet
							};
						})))
					]
					// Add RT support here
				}, tGraphQL, tAuthorization)).filter(e => parsedIDs.indexOf(e.id) === -1));
				parsedIDs = [...new Set([...parsedIDs, ...returnedTweets.map(e => e.id)])];
				await page.waitForTimeout(Math.floor(Math.random() * (SCROLL_DELAY_MS_MAX - SCROLL_DELAY_MS_MIN + 1)) + SCROLL_DELAY_MS_MIN);
			}
			closeTab(account, `fav`);

			return returnedTweets;
		} else {
			Logger.printLine("HTDSv1", `Failed to get favorites tweets because never got a tab`, "error")
			return [];
		}
	}
	async function getTweet(user, id, account) {
		Logger.printLine("HTDSv1", `Retrieving tweet ${user}/${id}...`, "info");

		const page = await getTwitterTab(account, `get`, `https://twitter.com/${user}/status/${id}`, true)
		if (page) {
			await page.waitForTimeout(1200);

			const returnedTweets = await page.evaluate(async (tweet_id, gql, auth) => {
				async function getMediaURL(status_id, images, has_video) {
					if (has_video) {
						let _json = await fetchJson(status_id);
						let tweet = _json.legacy;
						let medias = tweet.extended_entities && tweet.extended_entities.media;
						if (medias.length > 0) {
							const media_array = medias.map(media => {
								const url = media.type == 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type == 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url;
								return {
									media_url: url,
									format: url.split('.').pop().split(':')[0].split('?')[0],
									type: media.type
								}
							})
							return {
								images: media_array,
								data: _json
							};
						} else {
							return {
								images: [],
								data: _json
							};
						}
					} else {
						return {
							images
						}
					}
				}

				let lastAPIAccessTime = null;
				const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

				async function fetchJson(status_id) {
					if (lastAPIAccessTime && !(Date.now() - lastAPIAccessTime > 30000)) {
						console.log(`Artificial Rate Limit Applied: Less then 30 Sec sense last call!`)
						await sleep(30000);
					}
					lastAPIAccessTime = Date.now();
					const host = location.hostname;
					const base_url = `https://${host}/i/api/graphql/${gql}/TweetDetail`;
					const variables = {
						"focalTweetId": status_id,
						"referrer": "tweet",
						"with_rux_injections": false,
						"includePromotedContent": true,
						"withCommunity": true,
						"withQuickPromoteEligibilityTweetFields": true,
						"withBirdwatchNotes": true,
						"withVoice": true,
						"withV2Timeline": true
					};
					const features = {
						"responsive_web_graphql_exclude_directive_enabled": true,
						"verified_phone_label_enabled": false,
						"responsive_web_home_pinned_timelines_enabled": false,
						"creator_subscriptions_tweet_preview_api_enabled": true,
						"responsive_web_graphql_timeline_navigation_enabled": true,
						"responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
						"tweetypie_unmention_optimization_enabled": true,
						"responsive_web_edit_tweet_api_enabled": true,
						"graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
						"view_counts_everywhere_api_enabled": true,
						"longform_notetweets_consumption_enabled": true,
						"responsive_web_twitter_article_tweet_consumption_enabled": false,
						"tweet_awards_web_tipping_enabled": false,
						"freedom_of_speech_not_reach_fetch_enabled": true,
						"standardized_nudges_misinfo": true,
						"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
						"longform_notetweets_rich_text_read_enabled": true,
						"longform_notetweets_inline_media_enabled": true,
						"responsive_web_media_download_video_enabled": false,
						"responsive_web_enhance_cards_enabled": false
					};
					const url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`);
					const cookies = (() => {
						let _cookies = {};
						document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
							n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
								_cookies[name.trim()] = value.trim();
							});
						});
						return name ? _cookies[name] : _cookies;
					})()
					const headers = {
						'authorization': auth,
						'x-twitter-active-user': 'yes',
						'x-twitter-client-language': cookies.lang,
						'x-csrf-token': cookies.ct0
					};
					if (cookies.ct0.length === 32) headers['x-guest-token'] = cookies.gt;
					const tweet_detail = await fetch(url, {headers: headers}).then(result => result.json());
					console.log(tweet_detail);
					const tweet_entrie = tweet_detail.data.threaded_conversation_with_injections_v2.instructions[0].entries.find(n => n.entryId === `tweet-${status_id}`);
					const tweet_result = tweet_entrie.content.itemContent.tweet_results.result;
					return tweet_result.tweet || tweet_result;
				}

				const twt = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"] article[data-testid="tweet"]'))[0];
				const img_tweets = Array.from([twt].filter(e => e.querySelectorAll('time').length === 1))
				return await Promise.all(img_tweets.map(async a => {
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
					const json = await getMediaURL(tweet_id, images, ((a.querySelectorAll('div[data-testid="videoComponent"], div[aria-label="Embedded video"]')).length > 0));
					let tweet = (json && json.core && json.core.user_results && json.core.user_results.result && json.core.user_results.result.legacy) ? json.core.user_results : undefined;
					const userDiv = (tweet) ? undefined : Array.from(a.querySelectorAll(`div[data-testid="User-Name"] a span:not(:empty):not(:has(*))`)).map(e => e.innerText)
					const screenName = (tweet) ? tweet.screen_name : userDiv.filter(e => e.includes('@')).pop().substring(1);
					const userName = (tweet) ? tweet.name : userDiv.filter(e => !e.includes('@')).pop()
					const text = (json && json.legacy && json.legacy.full_text) ? json.legacy.full_text : (a.querySelector(`div[data-testid="tweetText"]`)) ? Array.from(a.querySelector(`div[data-testid="tweetText"]`).childNodes).map(e => ((e.nodeName === 'IMG') ? e.alt : e.innerText)).join('') : ''
					const date = a.querySelector('time').attributes['datetime'].value

					return {
						id: tweet_id,
						date,
						userName,
						screenName,
						text,
						images: json.images,
						retweeted: false,
						is_api_backed: !!tweet
					};
				}));
				// Add RT support here
			}, id, tGraphQL, tAuthorization)
			closeTab(account, `get`);
			return returnedTweets;
		} else {
			Logger.printLine("HTDSv1", `Failed to get tweet because never got a tab`, "error")
			return [];
		}
	}
	async function yoinkTwitterAPIKey(id) {
		const account = twitterAccounts.get(parseInt(id.toString()))
		const browser = twitterBrowsers.get(account.id);
		try {
			const page = await browser.newPage();
			await page.setViewport({
				width: 1280,
				height: 480,
				deviceScaleFactor: 1,
			});
			await page.setUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edge/92.0.902.73'
			);
			Logger.printLine("AuthManager", `Searching for graphql request...`, "warn")
			await page.setCookie(...account.cookie);
			await page.goto('https://twitter.com/');
			await page.setRequestInterception(true);
			page.on('request', req => {
				const url = req.url();
				const headers = req.headers();
				if (url.includes('https://twitter.com/i/api/graphql/') && url.includes('TweetDetail')) {
					tGraphQL = url.split('graphql/').pop().split('/')[0];
					tAuthorization = headers['authorization'];
					Logger.printLine("AuthManager", `Got required request data to start!`, "info")
				}
				req.continue().catch(e => e /* not intercepting */);
			});
			await page.waitForSelector('article');
			const tweet = await page.$('article');
			await tweet.click();
			while (tAuthorization === undefined) {
				await page.waitForTimeout(500);
			}
			await page.close();
		} catch (e) {
			Logger.printLine("TabManager", `Failed to load inital page!`, "emergency");
		}
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
