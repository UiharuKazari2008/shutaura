/*    ___                  __                        _______ __
     /   | _________ _____/ /__  ____ ___  __  __   / ____(_) /___  __
    / /| |/ ___/ __ `/ __  / _ \/ __ `__ \/ / / /  / /   / / __/ / / /
   / ___ / /__/ /_/ / /_/ /  __/ / / / / / /_/ /  / /___/ / /_/ /_/ /
  /_/  |_\___/\__,_/\__,_/\___/_/ /_/ /_/\__, /   \____/_/\__/\__, /
                                        /____/               /____/
Developed at Academy City Research
"Developing a better automated future"
======================================================================================
Shutaura Project - FileWorker I/O System
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
	const facilityName = 'FileWorker';

	const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
	const fs = require('fs');
	const sharp = require('sharp');
	const path = require('path');
	const chokidar = require('chokidar');
	const RateLimiter = require('limiter').RateLimiter;
	const limiter = new RateLimiter(5, 5000);
	const limiterlocal = new RateLimiter(1, 1000);
	const limiterbacklog = new RateLimiter(5, 5000);
	const amqp = require('amqplib/callback_api');
	let amqpConn = null;
	const request = require('request');
	const sizeOf = require('image-size');
	const splitFile = require('split-file');
	const crypto = require("crypto");
	const slash = require('slash');
	const md5 = require("md5");
	const { DiscordSnowflake } = require('@sapphire/snowflake');
	const globalRunKey = crypto.randomBytes(5).toString("hex");
	let globalItemNumber = 0;
	const FileType = require('file-type');
	let youtubedl = undefined
	try {
		youtubedl = require('youtube-dl');
	} catch (e) {
		console.error("YouTube DL is not available, You must manually install it with 'npm install youtube-dl --force'")
	}
	const rimraf = require('rimraf');
	const ExifImage = require('exif').ExifImage;
	const moment = require('moment');
	const minimist = require("minimist");
	const { spawn } = require("child_process");
	const exec = require('child_process').exec;
	let args = minimist(process.argv.slice(2));
	let init = false

	let discordServers = new Map();
	let FolderPairs = new Map();
	let EncoderConf = {
		Exec: "ffmpeg",
		VScale: "640:-1",
		VCodec: "h264",
		VBitrate: "500K",
		VCRF: "30",
		ACodec: "aac",
		ABitrate: "128K"
	}

	const { fileSize } = require('./utils/tools');
	const Logger = require('./utils/logSystem')(facilityName);
	const db = require('./utils/shutauraSQL')(facilityName);

	Logger.printLine("Init", "FileWorker Server I/O", "debug")

	if (process.env.MQ_HOST && process.env.MQ_HOST.trim().length > 0)
		systemglobal.MQServer = process.env.MQ_HOST.trim()
	if (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_USER.trim().length > 0)
		systemglobal.MQUsername = process.env.RABBITMQ_DEFAULT_USER.trim()
	if (process.env.RABBITMQ_DEFAULT_PASS && process.env.RABBITMQ_DEFAULT_PASS.trim().length > 0)
		systemglobal.MQPassword = process.env.RABBITMQ_DEFAULT_PASS.trim()

	async function loadDatabaseCache() {
		Logger.printLine("SQL", "Getting System Parameters", "debug")
		const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (application = 'fileworker' OR application IS NULL) ORDER BY system_name, application`, [systemglobal.SystemName])
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

			const _mq_discord_out = systemparams_sql.filter(e => e.param_key === 'mq.discord.out');
			if (_mq_discord_out.length > 0 && _mq_discord_out[0].param_value) {
				systemglobal.Discord_Out = _mq_discord_out[0].param_value;
			}
			const _mq_pdp_out = systemparams_sql.filter(e => e.param_key === 'mq.pdp.out');
			if (_mq_pdp_out.length > 0 && _mq_pdp_out[0].param_value) {
				systemglobal.PDP_Out = _mq_pdp_out[0].param_value;
			}
			const _mq_pdp_out_bulk = systemparams_sql.filter(e => e.param_key === 'mq.pdp.bulk');
			if (_mq_pdp_out_bulk.length > 0 && _mq_pdp_out_bulk[0].param_value) {
				systemglobal.PDP_Out_Bulk = _mq_pdp_out_bulk[0].param_value;
			}
			const _mq_fw_in = systemparams_sql.filter(e => e.param_key === 'mq.fileworker.in');
			if (_mq_fw_in.length > 0 && _mq_fw_in[0].param_value) {
				systemglobal.FileWorker_In = _mq_fw_in[0].param_value;
			}
			const _accepted_files = systemparams_sql.filter(e => e.param_key === 'fileworker.accepted_types');
			if (_accepted_files.length > 0 && _accepted_files[0].param_data) {
				if (_accepted_files[0].param_data.videos)
					systemglobal.FW_Accepted_Videos = _accepted_files[0].param_data.videos;
				if (_accepted_files[0].param_data.images)
					systemglobal.FW_Accepted_Images = _accepted_files[0].param_data.images;
				if (_accepted_files[0].param_data.files)
					systemglobal.FW_Accepted_Files = _accepted_files[0].param_data.files;
			}
			// { "files" : [ "jpg","png","jpeg","jiff","tiff","mov","mp4","avi","mkv","zip","rar","tar","exe","unitypackage","txt","blend" ], "images" : [ "jpg","png","jpeg","jiff","tiff" ], "videos" : [ "mov","mp4","avi","mkv" ] }
			const _fileworker_config = systemparams_sql.filter(e => e.param_key === 'fileworker');
			if (_fileworker_config.length > 0 && _fileworker_config[0].param_data) {
				if (_fileworker_config[0].param_data.watch_dir)
					systemglobal.WatchFolder_1 = _fileworker_config[0].param_data.watch_dir;
				if (_fileworker_config[0].param_data.pickup_dir)
					systemglobal.PickupFolder = _fileworker_config[0].param_data.pickup_dir;
				if (_fileworker_config[0].param_data.priority_channels)
					systemglobal.FW_Priority_Channels = _fileworker_config[0].param_data.priority_channels;
				if (_fileworker_config[0].param_data.classic_split)
					systemglobal.UseJSSplit = (_fileworker_config[0].param_data.classic_split);
				if (_fileworker_config[0].param_data.keep_original_images)
					systemglobal.FW_Always_Keep_Original_Images = (_fileworker_config[0].param_data.keep_original_images);
			}
			// { "watch_dir" : "./upload", "pickup_dir" : "./download" }
		}

		Logger.printLine("SQL", "Getting Discord Servers", "debug")
		const _discordservers = await db.query(`SELECT * FROM discord_servers`)
		if (_discordservers.error) { Logger.printLine("SQL", "Error getting discord servers records!", "emergency", _discordservers.error); return false }

		Logger.printLine("SQL", "Getting Folder Pair Configuration", "debug")
		const _folderpairs = await db.query(`SELECT x.source, x.channelid,x.serverid, x.watch_folder, y.chid_filedata AS discord_filedata FROM kanmi_channels x LEFT OUTER JOIN discord_servers y ON (x.serverid = y.serverid AND x.source = 0) WHERE x.watch_folder IS NOT NULL`)
		if (_folderpairs.error) { Logger.printLine("SQL", "Error getting folder pair records!", "emergency", _folderpairs.error); return false }
		await Promise.all(_folderpairs.rows.map(folder => {
			FolderPairs.set("" + folder.watch_folder, {
				id: folder.channelid,
				source: folder.source,
				server: folder.serverid,
				name: folder.watch_folder,
				parts: (folder.discord_filedata) ? folder.discord_filedata : null
			})
		}))

		if (systemglobal.WatchFolder_1) {
			// Create Folder Listing
			const getDirectories = fs.readdirSync(systemglobal.WatchFolder_1, {withFileTypes: true})
				.filter(dirent => dirent.isDirectory())
				.map(dirent => dirent.name)
			// Add new folder maps
			FolderPairs.forEach((data, name) => {
				if (!fs.existsSync(path.join(systemglobal.WatchFolder_1, name))) {
					if (name !== "MultiPartFolder" && name !== "Data") {
						fs.mkdirSync(path.join(systemglobal.WatchFolder_1, name));
						Logger.printLine("FolderInit", `Created new folder ${name}`, "debug")
					}
				}
				if (!init) {
					console.log(`Registered Folder "${name}" => ${data.id}@${data.server} (Parts Ch: ${data.parts})`)
				}
			});
			// Remove old folder maps
			getDirectories.forEach(function (foldername) {
				if (FolderPairs.has(foldername) === false) {
					fs.readdirSync(path.join(systemglobal.WatchFolder_1, foldername)).forEach((file, index) => {
						if (file.startsWith(".")) {
							fs.unlinkSync(path.join(systemglobal.WatchFolder_1, foldername, file));
						}
					})
					if (foldername !== "MultiPartFolder" && foldername !== "Data") {
						fs.readdirSync(path.join(systemglobal.WatchFolder_1, foldername)).forEach((file, index) => {
							if (file.startsWith(".")) {
								fs.unlinkSync(path.join(systemglobal.WatchFolder_1, foldername, file));
							} else {
								fs.renameSync(path.join(systemglobal.WatchFolder_1, foldername, file), systemglobal.WatchFolder_1)
								Logger.printLine("FolderInit", `Found orphan file ${file} in ${foldername}`, "debug")
							}
						});
						fs.rmdirSync(path.join(systemglobal.WatchFolder_1, foldername));
						Logger.printLine("FolderInit", `Removed folder ${foldername}`, "debug")
					}
				}
			})
		}

		await Promise.all(_discordservers.rows.map(server => {
			discordServers.set(server.serverid, server);
			if (server.serverid === systemglobal.DiscordHomeGuild) {
				discordServers.set('homeGuild', server);
			}
		}))

		Logger.printLine("SQL", "All SQL Configuration records have been assembled!", "debug");
		setTimeout(loadDatabaseCache, 1200000)
	}
	await loadDatabaseCache();
	if (args.whost) {
		systemglobal.Watchdog_Host = args.whost
	}
	if (args.wid) {
		systemglobal.Watchdog_ID = args.wid
	}
	console.log(systemglobal)

	const MQServer = `amqp://${systemglobal.MQUsername}:${systemglobal.MQPassword}@${systemglobal.MQServer}/?heartbeat=60`
	const MQWorker1 = `${systemglobal.FileWorker_In}`
	const MQWorker2 = `${MQWorker1}.${systemglobal.SystemName}.local`
	const MQWorker3 = `${MQWorker1}.backlog`

	const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

	try {
		if (!fs.existsSync(systemglobal.TempFolder)) {
			fs.mkdirSync(systemglobal.TempFolder);
		}
		if (systemglobal.WatchFolder_1 && !fs.existsSync(systemglobal.WatchFolder_1)) {
			fs.mkdirSync(systemglobal.WatchFolder_1);
		}
		if (systemglobal.PickupFolder && !fs.existsSync(systemglobal.PickupFolder)) {
			fs.mkdirSync(systemglobal.PickupFolder);
		}
	} catch (e) {
		console.error('Failed to create the temp folder, not a issue if your using docker');
		console.error(e);
	}

	// Normal Requests
	function startWorker() {
		amqpConn.createChannel(function(err, ch) {
			if (closeOnErr(err)) return;
			ch.on("error", function(err) {
				Logger.printLine("KanmiMQ", "Channel 1 Error (Remote)", "error", err)
			});
			ch.on("close", function() {
				Logger.printLine("KanmiMQ", "Channel 1 Closed (Remote)", "critical")
				start();
			});
			ch.prefetch(10);
			ch.assertQueue(MQWorker1, { durable: true }, function(err, _ok) {
				if (closeOnErr(err)) return;
				ch.consume(MQWorker1, processMsg, { noAck: false });
				Logger.printLine("KanmiMQ", "Channel 1 Worker Ready (Remote)", "debug")
			});
			ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
				if (closeOnErr(err)) return;
				ch.bindQueue(MQWorker1, "kanmi.exchange", MQWorker1, [], function(err, _ok) {
					if (closeOnErr(err)) return;
					Logger.printLine("KanmiMQ", "Channel 1 Worker Bound to Exchange (Remote)", "debug")
				})
			})
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
		limiter.removeTokens(1, function() {
			proccessJob(MessageContents, cb)
		});

	}
	// Backloged Requests
	function startWorker3() {
		amqpConn.createChannel(function(err, ch) {
			if (closeOnErr(err)) return;
			ch.on("error", function(err) {
				Logger.printLine("KanmiMQ", "Channel 3 Error (Backlog)", "error", err)
			});
			ch.on("close", function() {
				Logger.printLine("KanmiMQ", "Channel 3 Closed (Backlog)", "critical")
				start();
			});
			ch.prefetch(5);
			ch.assertQueue(MQWorker3, { durable: true, queueMode: 'lazy'  }, function(err, _ok) {
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
			})
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
	function work3(msg, cb) {
		let MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
		MessageContents.backlogRequest = true;
		limiterbacklog.removeTokens(1, function() {
			proccessJob(MessageContents, cb)
		});
	}
	// Local Files
	function startWorker2() {
		amqpConn.createChannel(function(err, ch) {
			if (closeOnErr(err)) return;
			ch.on("error", function(err) {
				Logger.printLine("KanmiMQ", "Channel 2 Error (Local)", "error", err)
			});
			ch.on("close", function() {
				Logger.printLine("KanmiMQ", "Channel 2 Closed (Local)", "critical")
				start();
			});
			ch.prefetch(1);
			ch.assertQueue(MQWorker2, { durable: true, queueMode: 'lazy'  }, function(err, _ok) {
				if (closeOnErr(err)) return;
				ch.consume(MQWorker2, processMsg, { noAck: false });
				Logger.printLine("KanmiMQ", "Channel 2 Worker Ready (Local)", "debug")
			});
			ch.assertExchange("kanmi.exchange", "direct", {}, function(err, _ok) {
				if (closeOnErr(err)) return;
				ch.bindQueue(MQWorker2, "kanmi.exchange", MQWorker2, [], function(err, _ok) {
					if (closeOnErr(err)) return;
					Logger.printLine("KanmiMQ", "Channel 2 Worker Bound to Exchange (Local)", "debug")
				})
			})

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
	function work2(msg, cb) {
		try {
			limiterlocal.removeTokens(1, function() {
				let MessageContents = JSON.parse(Buffer.from(msg.content).toString('utf-8'));
				console.log(MessageContents);
				fs.access(MessageContents.FilePath, error => {
					if (!error) {
						console.log(MessageContents.FilePath)
						parseFile(MessageContents, function (check) {
							if (check) {
								fs.access(MessageContents.FilePath, error => {
									if (!error) {
										fs.unlink(MessageContents.FilePath, function (err) {
										})
									}
								});
							} else {
								console.log('Failed to parse local action')
							}
							cb(true);
						})
					} else {
						console.log('File not found for local message')
						cb(true);
					}
				});
			});
		} catch (err) {
			Logger.printLine("JobParser", "Error Parsing Job - " + err.message, "critical")
			cb(true);
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
		console.error(err)
		Logger.printLine("KanmiMQ", "Connection Closed due to error", "error", err)
		amqpConn.close();
		return true;
	}
	async function whenConnected() {
		if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
			request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
				if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
					console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
				}
			})
		}
		if (systemglobal.PickupFolder) {
			Logger.printLine('Init', 'Pickup is enabled on this FileWorker instance, now accepting requests', 'debug')
			await createMissingLinks();
		}
		startWorker();
		startWorker3();
		startWorker2();
		if (systemglobal.WatchFolder_1) {
			Logger.printLine('Init', 'File Watching is enabled on this FileWorker instance, now watching for uploads', 'debug')
			// Setup Folder Watchers
			sleep(1000).then(() => {
				function onboardFileAdd(filePath, groupID) {
					let attemptToLoadFile = null
					attemptToLoadFile = setInterval(send, 10000);

					function send() {
						fs.open(filePath, 'r+', function (err, fd) {
							if (err && err.code === 'EBUSY') { // File has not finished writing
								//console.log(`${filePath} is not ready, Retrying....`)
							} else if (err && err.code === 'ENOENT') { // File was deleted or removed
								Logger.printLine("LocalFileLoader", `${filePath} was deleted`, "debug")
								clearInterval(attemptToLoadFile);
							} else { // File is ready for ingest
								fs.close(fd, function () {
									const stats = fs.statSync(filePath);
									const fileSizeInBytes = stats["size"]
									if (fileSizeInBytes > 10) {
										const fileNameID = crypto.randomBytes(32).toString("hex");
										fs.rename(filePath, path.join(systemglobal.TempFolder, fileNameID), function (err) {
											if (err) {
												Logger.printLine("LocalFile", `Failed to onboard file ${filePath}`, "debug", err)
												clearInterval(attemptToLoadFile);
											} else {
												const dateOfFile = moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss');
												mqClient.sendData(MQWorker2, {
													Type: "Local",
													FileName: path.basename(filePath).replace('PRIORITY-',''),
													FilePath: path.join(systemglobal.TempFolder, fileNameID),
													Priority: (path.basename(filePath).startsWith('PRIORITY-')),
													OriginPath: filePath,
													OriginGroup: groupID,
													DateTime: dateOfFile,
												}, function (callback) {
													if (callback) {
														Logger.printLine("LocalFile", `Onboard ${fileNameID} - ${dateOfFile}`, "debug", {
															Type: "Local",
															FileName: path.basename(filePath),
															FilePath: path.join(systemglobal.TempFolder, fileNameID),
															OriginPath: filePath,
															OriginGroup: groupID,
															DateTime: dateOfFile,
														})
														clearInterval(attemptToLoadFile);
													}
												})
											}
										});
									} else {
										//console.log(`${filePath} is a placeholder, Retrying....`)
									}
								})
							}
						});
					}
				}

				let datawatcher1 = null
				if (systemglobal.WatchFolder_1 !== 'null') {
					datawatcher1 = chokidar.watch(systemglobal.WatchFolder_1, {
						ignored: /[\/\\]\./,
						persistent: true,
						usePolling: false,
						awaitWriteFinish: {
							stabilityThreshold: 2000,
							pollInterval: 100
						},
						depth: 2,
						ignoreInitial: false
					});
					datawatcher1.on('add', function (filePath) {
						if (!(filePath.includes('HOLD-') || filePath.includes('PREVIEW-') || filePath.includes('FILEATT-') || filePath.includes(".metadata"))) {
							onboardFileAdd(slash(filePath), "1")
						}
					})
						.on('error', function (error) {
							mqClient.sendMessage("Unknown error has occurred on FileWorker", "err", "FileWatcher1", error)
						})
						.on('ready', function () {
							Logger.printLine("FileWorker1", `${systemglobal.SystemName} - FileWorker #1 ready for changes`, "info")
						});
				}
			})
		} else {
			Logger.printLine('Init', 'File Watching is disabled on this FileWorker instance!', 'warning')
		}
		if (process.send && typeof process.send === 'function') {
			process.send('ready');
		}
		init = true
	}
	// Support Functions
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
	async function createMissingLinks() {
		const localFiles = fs.readdirSync(systemglobal.PickupFolder).filter(e => e.startsWith('.')).map(e => e.substring(1));
		const databaseItems = await db.query(`SELECT eid, fileid, real_filename FROM kanmi_records WHERE fileid IS NOT NULL AND filecached = 1`, [])
		if (!databaseItems.error && databaseItems.rows.length > 0) {
			await Promise.all(databaseItems.rows.filter(e => localFiles.indexOf(e.fileid) === -1).map(async (e) => {
				await db.query(`UPDATE kanmi_records SET filecached = 0 WHERE eid = ?`, [e.eid]);
				Logger.printLine('cleanCache', `Successfully removed invalid cache mark for file ${e.real_filename}`, 'warn');
			}))
			await Promise.all(localFiles.map(async (e) => {
				const cacheresponse = databaseItems.rows.filter(f => f.fileid === e)
				if (cacheresponse.length > 0) {
					const linkname = `${cacheresponse[0].eid}-${cacheresponse[0].real_filename}`
					if (!fs.existsSync(path.join(systemglobal.PickupFolder, linkname))) {
						try {
							fs.linkSync(path.join(systemglobal.PickupFolder, e), path.join(systemglobal.PickupFolder, linkname))
							Logger.printLine('cleanCache', `Successfully created missing symlink for file ${e.substring(1)} => ${linkname}`, 'info');
						} catch (err) {
							Logger.printLine('cleanCache', `Failed to create missing symlink for file ${e.substring(1)} => ${linkname}`, 'error');
						}
					}
				}
			}))
		}
	}
	function msToTime(s) {
		// Pad to 2 or 3 digits, default is 2
		function pad(n, z) {
			z = z || 2;
			return ('00' + n).slice(-z);
		}

		var ms = s % 1000;
		s = (s - ms) / 1000;
		var secs = s % 60;
		s = (s - secs) / 60;
		var mins = s % 60;
		var hrs = (s - mins) / 60;

		return pad(hrs) + ':' + pad(mins) + ':' + pad(secs)
	}
	// Get Video Duration
	async function startPosition(filename) {
		let ffmpegParam = `ffmpeg -i "${filename}" 2>&1 | grep "Duration"| cut -d ' ' -f 4 | sed s/,// | sed 's@\\..*@@g' | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + B[1] }'`
		const duration = await new Promise((resolve) => {
			exec(ffmpegParam, (err, stdout, stderr) => {
				if (err) {
					console.error(err);
					resolve(false);
				}
				resolve(parseInt(stdout.split("\n").join("").trim()));
			})
		})
		if (duration) {
			return msToTime((duration * .25) * 1000)
		} else {
			return '00:00:00'
		}
	}
	// Generate Video GIF Preview
	async function animateVideo(filename, time) {
		return await new Promise(function (fulfill) {
			const outputfile = path.join(systemglobal.TempFolder, `TEMPPREVIEW-${crypto.randomBytes(8).toString("hex")}.gif`);
			let scriptOutput = "";
			const spawn = require('child_process').spawn;
			let ffmpegParam = ['-hide_banner', '-nostats', '-y', '-ss', time, '-i', filename, '-f', 'gif', '-fs', '4000000', '-bufsize', '2M', '-vf', 'fps=10,scale=320:-1,smartblur=ls=-0.5', outputfile]
			console.log("[FFMPEG] Getting Animated Preview Image...")
			const child = spawn(EncoderConf.Exec, ffmpegParam);
			child.stdout.setEncoding('utf8');
			child.stdout.on('data', function (data) {
				console.log(data);
				data = data.toString();
				scriptOutput += data;
			});
			child.stderr.setEncoding('utf8');
			child.stderr.on('data', function (data) {
				console.log(data);
				data = data.toString();
				scriptOutput += data;
			});
			child.on('close', function (code) {
				if (code === 0 && fileSize(outputfile) > 0.00001) {
					try {
						const output = fs.readFileSync(outputfile, {encoding: 'base64'})
						deleteFile(outputfile, function (ready) {
							// Do Nothing
						})
						fulfill(output);
					} catch (err) {
						fulfill(null);
						Logger.printLine("FFMPEG-Post", `Error preparing encoded video - ${err.message}`)
					}
				} else {
					mqClient.sendMessage("Failed to generate animated preview image due to FFMPEG error!", "info")
					deleteFile(outputfile, function (ready) {
						// Do Nothing
					})
					fulfill(null)
				}
			});
		})
	}
	// Generate Video Preview Image
	async function previewVideo(filename, time) {
		return await new Promise(function (fulfill) {
			const outputfile = path.join(systemglobal.TempFolder, `TEMPPREVIEW-${crypto.randomBytes(8).toString("hex")}.jpg`);
			let scriptOutput = "";
			let ffmpegParam = ['-hide_banner', '-nostats', '-y', '-ss', time, '-i', filename, '-f', 'image2', '-vframes', '1', outputfile]
			console.log("[FFMPEG] Getting Preview Image...")
			const child = spawn(EncoderConf.Exec, ffmpegParam);
			child.stdout.setEncoding('utf8');
			child.stdout.on('data', function (data) {
				console.log(data);
				data = data.toString();
				scriptOutput += data;
			});
			child.stderr.setEncoding('utf8');
			child.stderr.on('data', function (data) {
				console.log(data);
				data = data.toString();
				scriptOutput += data;
			});
			child.on('close', function (code) {
				if (code === 0 && fileSize(outputfile) > 0.00001) {
					try {
						const output = fs.readFileSync(outputfile, {encoding: 'base64'})
						deleteFile(outputfile, function (ready) {
							// Do Nothing
						})
						fulfill(output);
					} catch (err) {
						fulfill(null);
						Logger.printLine("FFMPEG-Post", `Error preparing encoded video - ${err.message}`)
					}
				} else {
					mqClient.sendMessage("Failed to generate preview image due to FFMPEG error!", "info")
					deleteFile(outputfile, function (ready) {
						// Do Nothing
					})
					fulfill(null)
				}
			});
		})
	}
	// Encode Video File
	async function encodeVideo(filename, intent) {
		return await new Promise(function (fulfill) {
			const possiblePreview = path.join(path.dirname(filename), 'PREVIEW-' + path.basename(filename, path.extname(filename)) + '.mp4')
			if (fs.existsSync(possiblePreview) && parseFloat(fileSize(possiblePreview).toString()) < 24.899) {
				try {
					const output = fs.readFileSync(possiblePreview, {encoding: 'base64'})
					deleteFile(possiblePreview, function (ready) {
						// Do Nothing
					})
					fulfill(output);
				} catch (err) {
					fulfill(null);
					Logger.printLine("FFMPEG-Post", `Error preparing encoded video - ${err.message}`)
				}
			} else {
				const outputfile = path.join(systemglobal.TempFolder, `TEMPVIDEO-${crypto.randomBytes(8).toString("hex")}`);
				let scriptOutput = "";
				const spawn = require('child_process').spawn;
				let ffmpegParam = []
				if (intent) {
					ffmpegParam = ['-hide_banner', '-nostats', '-y', '-i', filename, '-f', 'mp4', '-fs', '7000000', '-vcodec', EncoderConf.VCodec, '-filter:v', 'scale=480:-2', '-crf', '15', '-maxrate', '150K', '-bufsize', '2M', '-acodec', EncoderConf.ACodec, '-b:a', '128K', outputfile]
				} else {
					ffmpegParam = ['-hide_banner', '-nostats', '-y', '-i', filename, '-f', 'mp4', '-vcodec', EncoderConf.VCodec, '-acodec', EncoderConf.ACodec, '-b:a', '128K', '-filter:v', 'scale=640:-1', '-crf', '15', '-maxrate', '500K', '-bufsize', '2M', outputfile]
				}
				console.log("[FFMPEG] Starting to encode video...")
				const child = spawn(EncoderConf.Exec, ffmpegParam);
				// You can also use a variable to save the output
				// for when the script closes later
				child.stdout.setEncoding('utf8');
				child.stdout.on('data', function (data) {
					//Here is where the output goes
					console.log(data);
					data = data.toString();
					scriptOutput += data;
				});
				child.stderr.setEncoding('utf8');
				child.stderr.on('data', function (data) {
					//Here is where the error output goes
					console.log(data);
					data = data.toString();
					scriptOutput += data;
				});
				child.on('close', function (code) {
					if (code.toString() === '0' && parseFloat(fileSize(outputfile).toString()) < 24.899) {
						try {
							const output = fs.readFileSync(outputfile, {encoding: 'base64'})
							deleteFile(outputfile, function (ready) {
								// Do Nothing
							})
							fulfill(output);
						} catch (err) {
							fulfill(null);
							Logger.printLine("FFMPEG-Post", `Error preparing encoded video - ${err.message}`)
						}
					} else {
						mqClient.sendMessage("Post-Encoded video file was to large to be send! Will be a multipart file", "info")
						deleteFile(outputfile, function (ready) {
							// Do Nothing
						})
						fulfill(null)
					}
				});
			}
		})
	}

	function proccessJob(MessageContents, cb) {
		try {
			if (MessageContents.messageType === 'command' && MessageContents.messageAction) {
				switch (MessageContents.messageAction) {
					case 'CacheSpannedFile':
						if (MessageContents.fileUUID && systemglobal.PickupFolder) {
							db.safe(`SELECT x.*, y.data FROM (SELECT kanmi_records.*, discord_multipart_files.url, discord_multipart_files.valid
									 FROM kanmi_records,
										  discord_multipart_files
									 WHERE kanmi_records.fileid = ?
									   AND kanmi_records.source = 0
									   AND kanmi_records.fileid = discord_multipart_files.fileid) x LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) y ON (x.eid = y.eid)`, [MessageContents.fileUUID], function (err, cacheresponse) {
								if (err || cacheresponse.length === 0) {
									mqClient.sendMessage("SQL Error occurred when messages to check for cache", "err", 'main', "SQL", err)
									cb(true)
								} else if (cacheresponse.filter(e => e.valid === 0 && !(!e.url)).length !== 0) {
									mqClient.sendMessage(`Failed to proccess the MultiPart File ${cacheresponse.real_filename} (${MessageContents.fileUUID})\nSome files are not valid and will need to be revalidated or repaired!`, "error", "MPFDownload")
									cb(true)
								} else if (cacheresponse.filter(e => e.valid === 1 && !(!e.url)).length !== cacheresponse[0].paritycount) {
									mqClient.sendMessage(`Failed to proccess the MultiPart File ${cacheresponse.real_filename} (${MessageContents.fileUUID})\nThe expected number of parity files were not available. \nTry to repair the parity cache \`juzo jfs repair parts\``, "error", "MPFDownload")
									cb(true)
								} else {
									let itemsCompleted = [];
									const fileName = cacheresponse[0].real_filename
									const fileNameUniq = '.' + cacheresponse[0].fileid
									const CompleteFilename = path.join(systemglobal.PickupFolder, fileNameUniq);
									const PartsFilePath = path.join(systemglobal.TempFolder, `PARITY-${cacheresponse[0].fileid}`);
									fs.mkdirSync(PartsFilePath, {recursive: true})
									let requests = cacheresponse.filter(e => e.valid === 1 && !(!e.url)).map(e => e.url).sort((x, y) => (x.split('.').pop() < y.split('.').pop()) ? -1 : (y.split('.').pop() > x.split('.').pop()) ? 1 : 0).reduce((promiseChain, URLtoGet, URLIndex) => {
										return promiseChain.then(() => new Promise((resolve) => {
											const DestFilename = path.join(PartsFilePath, `${URLIndex}.par`)
											const stream = request.get({
												url: URLtoGet,
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
											}).pipe(fs.createWriteStream(DestFilename))
											// Write File to Temp Filesystem
											stream.on('finish', function () {
												Logger.printLine("MPFDownload", `Downloaded Part #${URLIndex} : ${DestFilename}`, "debug", {
													URL: URLtoGet,
													DestFilename: DestFilename,
													CompleteFilename: fileName
												})
												itemsCompleted.push(DestFilename);
												resolve()
											});
											stream.on("error", function (err) {
												mqClient.sendMessage(`Part of the multipart file failed to download! ${URLtoGet}`, "err", "MPFDownload", err)
												resolve()
											})
										}))
									}, Promise.resolve());
									requests.then(async () => {
										if (itemsCompleted.length === cacheresponse[0].paritycount) {
											await new Promise((deleted) => {
												rimraf(CompleteFilename, function (err) { deleted(!err) });
											})
											try {
												await splitFile.mergeFiles(itemsCompleted.sort(function (a, b) {
													return a - b
												}), CompleteFilename)
												try {
													fs.symlinkSync(fileNameUniq, path.join(systemglobal.PickupFolder, `${cacheresponse[0].eid}-${cacheresponse[0].real_filename}`))
												} catch (err) {
													mqClient.sendMessage(`File "${fileName.replace(/[/\\?%*:|"<> ]/g, '_')}" could not be linked to symlink!`, "info", "MPFDownload")
												}
												mqClient.sendMessage(`File "${fileName.replace(/[/\\?%*:|"<> ]/g, '_')}" was build successfully and is now available!`, "info", "MPFDownload")
												db.safe(`UPDATE kanmi_records
														 SET filecached = 1
														 WHERE fileid = ?
														   AND source = 0`, [MessageContents.fileUUID], function (err, setcacheresponse) {
													if (err) {
														mqClient.sendMessage(`File "${fileName.replace(/[/\\?%*:|"<> ]/g, '_')}" failed to be set as cache!`, "err", "MPFCache", err)
													} else {
														Logger.printLine("MPFCache", `File ${fileName.replace(/[/\\?%*:|"<> ]/g, '_')} was cached successfully!`, 'info')
													}
												})
												await new Promise((deleted) => {
													rimraf(PartsFilePath, function (err) { deleted(!err) });
												})
												if (systemglobal.FW_Accepted_Videos.indexOf(path.extname(fileName.toString()).split(".").pop().toLowerCase()) !== -1) {
													// Get Video Duration
													const startPosition = await (async (filename) => {
														const exec = require('child_process').exec;
														let ffmpegParam = `ffmpeg -i "${filename}" 2>&1 | grep "Duration"| cut -d ' ' -f 4 | sed s/,// | sed 's@\\..*@@g' | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + B[1] }'`
														const duration = await new Promise((resolve) => {
															exec(ffmpegParam, (err, stdout, stderr) => {
																if (err) {
																	console.error(err);
																	resolve(false);
																}
																resolve(parseInt(stdout.split("\n").join("").trim()));
															})
														})
														if (duration) {
															return msToTime((duration * .25) * 1000)
														} else {
															return '00:00:00'
														}
													})(CompleteFilename);

													if (cacheresponse[0].attachment_hash === null) {
														const preview_video = await encodeVideo(CompleteFilename, true)
														if (preview_video) {
															mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
																fromClient: `return.FileWorker.${systemglobal.SystemName}`,
																messageReturn: false,
																messageID: cacheresponse[0].id,
																messageChannelID: cacheresponse[0].channel,
																messageServerID: cacheresponse[0].server,
																messageType: 'command',
																messageAction: 'ReplaceContent',
																itemCacheName: `${cacheresponse[0].id}.mp4`,
																itemCacheData: preview_video,
																itemCacheType: 1
															}, function (callback) {
																if (callback) {
																	Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
																} else {
																	Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
																}
															});
														} else {
															mqClient.sendMessage(`Error occurred when encoding the video "${fileNameUniq}" for transport, Will not send preview video!`, "err", "", er)
														}
													}
													if (cacheresponse[0].cache_proxy === null || (cacheresponse[0] && !cacheresponse[0].cache_proxy.includes('-t9-preview-video.gif'))) {
														const preview_animated = await animateVideo(CompleteFilename, startPosition)
														const preview_image = await previewVideo(CompleteFilename, startPosition)

														if (preview_animated) {
															mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
																fromClient: `return.FileWorker.${systemglobal.SystemName}`,
																messageReturn: false,
																messageID: cacheresponse[0].id,
																messageChannelID: cacheresponse[0].channel,
																messageServerID: cacheresponse[0].server,
																messageType: 'command',
																messageAction: 'ReplaceContent',
																itemCacheName: `${cacheresponse[0].id}-t9-preview-video.gif`,
																itemCacheData: preview_animated,
																itemCacheType: 0
															}, function (callback) {
																if (callback) {
																	Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
																} else {
																	Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
																}
															});
															if (preview_image && (!cacheresponse[0].data || (cacheresponse[0].data && !cacheresponse[0].data.preview_image))) {
																mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
																	fromClient: `return.FileWorker.${systemglobal.SystemName}`,
																	messageReturn: false,
																	messageID: cacheresponse[0].id,
																	messageChannelID: cacheresponse[0].channel,
																	messageServerID: cacheresponse[0].server,
																	messageType: 'command',
																	messageAction: 'ModifyExtendedContent',
																	extendedContent: {
																		preview_image: 'FILE-0'
																	},
																	extendedAttachments: [
																		{
																			name: `${cacheresponse[0].id}-t9-preview-video.jpg`,
																			file: preview_image
																		}
																	]
																}, function (callback) {
																	if (callback) {
																		Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
																	} else {
																		Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
																	}
																});
															}
														} else if (preview_image) {
															mqClient.sendMessage(`Error occurred when generating animated preview the video "${fileNameUniq}" for transport, Will try to send image!`, "warn", "")
															mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
																fromClient: `return.FileWorker.${systemglobal.SystemName}`,
																messageReturn: false,
																messageID: cacheresponse[0].id,
																messageChannelID: cacheresponse[0].channel,
																messageServerID: cacheresponse[0].server,
																messageType: 'command',
																messageAction: 'ReplaceContent',
																itemCacheName: `${cacheresponse[0].id}-t9-preview-video.jpg`,
																itemCacheData: preview_image,
																itemCacheType: 0
															}, function (callback) {
																if (callback) {
																	Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
																} else {
																	Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
																}
															});
															mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
																fromClient: `return.FileWorker.${systemglobal.SystemName}`,
																messageReturn: false,
																messageID: cacheresponse[0].id,
																messageChannelID: cacheresponse[0].channel,
																messageServerID: cacheresponse[0].server,
																messageType: 'command',
																messageAction: 'ModifyExtendedContent',
																extendedContent: {
																	preview_image: null
																},
															}, function (callback) {
																if (callback) {
																	Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
																} else {
																	Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
																}
															});
														} else {
															mqClient.sendMessage(`Error occurred when generating preview the video "${fileNameUniq}" for transport, Will send without preview!`)
														}
													} else if (!cacheresponse[0].data || (cacheresponse[0].data && !cacheresponse[0].data.preview_image)) {
														const preview_image = await previewVideo(CompleteFilename, startPosition)
														if (preview_image) {
															mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
																fromClient: `return.FileWorker.${systemglobal.SystemName}`,
																messageReturn: false,
																messageID: cacheresponse[0].id,
																messageChannelID: cacheresponse[0].channel,
																messageServerID: cacheresponse[0].server,
																messageType: 'command',
																messageAction: 'ModifyExtendedContent',
																extendedContent: {
																	preview_image: 'FILE-0'
																},
																extendedAttachments: [
																	{
																		name: `${cacheresponse[0].id}-t9-preview-video.jpg`,
																		file: preview_image
																	}
																]
															}, function (callback) {
																if (callback) {
																	Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
																} else {
																	Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
																}
															});
														} else {
															mqClient.sendMessage(`Error occurred when generating preview the video "${fileNameUniq}" for transport, Will send without preview!`, "warn")
														}
													}
												}
											} catch (err) {
												mqClient.sendMessage(`File ${cacheresponse[0].real_filename} failed to rebuild!`, "err", "MPFDownload", err)
												console.error(err)
												for (let part of itemsCompleted) {
													fs.unlink(part, function (err) {
														if (err && (err.code === 'EBUSY' || err.code === 'ENOENT')) {
															//mqClient.sendMessage(`Error removing file part from temporary folder! - ${err.message}`, "err", "MPFDownload", err)
														}
													})
												}
											}
											cb(true)
										} else {
											mqClient.sendMessage(`Failed to proccess the MultiPart File ${cacheresponse.real_filename} (${MessageContents.fileUUID})\nThe expected number of parity files did not all download or save.`, "error", "MPFDownload")
											cb(true)
										}
									})
								}
							})
						} else {
							cb(true)
						}
						break;
					case 'RemoveSpannedFile':
						if (MessageContents.fileUUID && systemglobal.PickupFolder) {
							db.safe(`SELECT kanmi_records.*
									 FROM kanmi_records
									 WHERE kanmi_records.fileid = ?
									   AND kanmi_records.source = 0`, [MessageContents.fileUUID], async function (err, cacheresponse) {
								if (err || cacheresponse.length === 0) {
									mqClient.sendMessage("SQL Error occurred when messages to check for cache", "err", 'main', "SQL", err)
									cb(true)
								} else {
									const fileNameUniq = '.' + cacheresponse[0].fileid
									const CompleteFilename = path.join(systemglobal.PickupFolder, fileNameUniq);
									const LinkFileName = path.join(systemglobal.PickupFolder, `${cacheresponse[0].eid}-${cacheresponse[0].real_filename}`)
									await new Promise((deleted) => {
										rimraf(CompleteFilename, function (err) { deleted(!err) });
									})
									await new Promise((deleted) => {
										rimraf(LinkFileName, function (err) { deleted(!err) });
									})
									await db.query(`UPDATE kanmi_records SET filecached = 0 WHERE eid = ?`, [cacheresponse[0].eid]);
									Logger.printLine('cleanCache', `Successfully removed cache for file ${cacheresponse[0].eid}-${cacheresponse[0].real_filename}`, 'info');
									cb(true);
								}
							})
						} else {
							cb(true)
						}
						break;
					case 'GenerateVideoPreview':
						db.safe(`SELECT * FROM kanmi_records WHERE id = ? AND source = 0`, [MessageContents.messageID], async (err, cacheresponse) => {
							if (err) {
								Logger.printLine('main', "SQL Error occurred when messages to check for cache", "error");
								cb(true)
							} else if (cacheresponse.length > 0) {
								let CompleteFilename
								if (systemglobal.PickupFolder && cacheresponse[0].filecached === 1) {
									CompleteFilename = path.join(systemglobal.PickupFolder, `.${cacheresponse[0].fileid}`);
								} else {
									CompleteFilename = path.join(systemglobal.TempFolder, `.${cacheresponse[0].fileid}`);
									await new Promise((tempFile) => {
										db.safe(`SELECT x.*, y.data FROM (SELECT kanmi_records.*, discord_multipart_files.url, discord_multipart_files.valid
									 FROM kanmi_records,
										  discord_multipart_files
									 WHERE kanmi_records.id = ?
									   AND kanmi_records.source = 0
									   AND kanmi_records.fileid = discord_multipart_files.fileid) x LEFT OUTER JOIN (SELECT * FROM kanmi_records_extended) y ON (x.eid = y.eid)`, [MessageContents.messageID], function (err, cacheresponse) {
											if (err || cacheresponse.length === 0) {
												Logger.printLine('main', "SQL Error occurred when messages to check for cache", "error");
												tempFile(false)
											} else if (cacheresponse.filter(e => e.valid === 0 && !(!e.url)).length !== 0) {
												Logger.printLine('MPFDownload', `Failed to proccess the Temporary MultiPart File ${cacheresponse.real_filename} (${MessageContents.fileUUID}) for video preview\nSome files are not valid and will need to be revalidated or repaired!`, "error");
												tempFile(false)
											} else if (cacheresponse.filter(e => e.valid === 1 && !(!e.url)).length !== cacheresponse[0].paritycount) {
												Logger.printLine('MPFDownload', `Failed to proccess the Temporary MultiPart File ${cacheresponse.real_filename} (${MessageContents.fileUUID}) for video preview\nThe expected number of parity files were not available. \nTry to repair the parity cache \`juzo jfs repair parts\``, "error");
												tempFile(false)
											} else {
												let itemsCompleted = [];
												const fileName = cacheresponse[0].real_filename
												const fileNameUniq = '.' + cacheresponse[0].fileid
												const PartsFilePath = path.join(systemglobal.TempFolder, `PARITY-${cacheresponse[0].fileid}`);
												fs.mkdirSync(PartsFilePath, {recursive: true})
												let requests = cacheresponse.filter(e => e.valid === 1 && !(!e.url)).map(e => e.url).sort((x, y) => (x.split('.').pop() < y.split('.').pop()) ? -1 : (y.split('.').pop() > x.split('.').pop()) ? 1 : 0).reduce((promiseChain, URLtoGet, URLIndex) => {
													return promiseChain.then(() => new Promise((resolve) => {
														const DestFilename = path.join(PartsFilePath, `${URLIndex}.par`)
														const stream = request.get({
															url: URLtoGet,
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
														}).pipe(fs.createWriteStream(DestFilename))
														// Write File to Temp Filesystem
														stream.on('finish', function () {
															Logger.printLine("MPFDownload", `Downloaded Part #${URLIndex} : ${DestFilename}`, "debug", {
																URL: URLtoGet,
																DestFilename: DestFilename,
																CompleteFilename: fileName
															})
															itemsCompleted.push(DestFilename);
															resolve()
														});
														stream.on("error", function (err) {
															mqClient.sendMessage(`Part of the multipart file failed to download! ${URLtoGet}`, "err", "MPFDownload", err)
															resolve()
														})
													}))
												}, Promise.resolve());
												requests.then(async () => {
													if (itemsCompleted.length === cacheresponse[0].paritycount) {
														await new Promise((deleted) => {
															rimraf(CompleteFilename, function (err) { deleted(!err) });
														})
														try {
															await splitFile.mergeFiles(itemsCompleted.sort(function (a, b) {
																return a - b
															}), CompleteFilename)
															await new Promise((deleted) => {
																rimraf(PartsFilePath, function (err) { deleted(!err) });
															})
															tempFile(true);
														} catch (err) {
															mqClient.sendMessage(`File ${cacheresponse[0].real_filename} failed to rebuild for video preview!`, "err", "MPFDownload", err)
															console.error(err)
															for (let part of itemsCompleted) {
																fs.unlink(part, function (err) {
																	if (err && (err.code === 'EBUSY' || err.code === 'ENOENT')) {
																		//mqClient.sendMessage(`Error removing file part from temporary folder! - ${err.message}`, "err", "MPFDownload", err)
																	}
																})
															}
															tempFile(false);
														}
														tempFile(false);
													} else {
														mqClient.sendMessage(`Failed to proccess the MultiPart File ${cacheresponse.real_filename} (${MessageContents.fileUUID}) for view preview\nThe expected number of parity files did not all download or save.`, "error", "MPFDownload")
														tempFile(false)
													}
												})
											}
										})
									})
								}

								console.log(systemglobal.FW_Accepted_Videos.indexOf(path.extname(CompleteFilename).split(".").pop().toLowerCase()) !== -1)
								if (fs.existsSync(CompleteFilename) && systemglobal.FW_Accepted_Videos.indexOf(path.extname(cacheresponse[0].real_filename).split(".").pop().toLowerCase()) !== -1) {
									// Get Video Duration
									const startPosition = await (async (filename) => {
										const exec = require('child_process').exec;
										let ffmpegParam = `ffmpeg -i "${filename}" 2>&1 | grep "Duration"| cut -d ' ' -f 4 | sed s/,// | sed 's@\\..*@@g' | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + B[1] }'`
										const duration = await new Promise((resolve) => {
											exec(ffmpegParam, (err, stdout, stderr) => {
												if (err) {
													console.error(err);
													resolve(false);
												}
												resolve(parseInt(stdout.split("\n").join("").trim()));
											})
										})
										if (duration) {
											return msToTime((duration * .25) * 1000)
										} else {
											return '00:00:00'
										}
									})(CompleteFilename);

									if (cacheresponse[0].cache_proxy === null || (cacheresponse[0] && !cacheresponse[0].cache_proxy.includes('-t9-preview-video.gif')) || (MessageContents.forceRefresh === true || MessageContents.forceRefresh === 'preview')) {
										const preview_animated = await animateVideo(CompleteFilename, startPosition)
										const preview_image = await previewVideo(CompleteFilename, startPosition)
										if (preview_animated) {
											mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
												fromClient: `return.FileWorker.${systemglobal.SystemName}`,
												messageReturn: false,
												messageID: cacheresponse[0].id,
												messageChannelID: cacheresponse[0].channel,
												messageServerID: cacheresponse[0].server,
												messageType: 'command',
												messageAction: 'ReplaceContent',
												itemCacheName: `${cacheresponse[0].id}-t9-preview-video.gif`,
												itemCacheData: preview_animated,
												itemCacheType: 0
											}, function (callback) {
												if (callback) {
													Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
												} else {
													Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
												}
											});
											if (preview_image && ((MessageContents.forceRefresh === true || MessageContents.forceRefresh === 'preview') || (!cacheresponse[0].data || (cacheresponse[0].data && !cacheresponse[0].data.preview_image)))) {
												mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
													fromClient: `return.FileWorker.${systemglobal.SystemName}`,
													messageReturn: false,
													messageID: cacheresponse[0].id,
													messageChannelID: cacheresponse[0].channel,
													messageServerID: cacheresponse[0].server,
													messageType: 'command',
													messageAction: 'ModifyExtendedContent',
													extendedContent: {
														preview_image: 'FILE-0'
													},
													extendedAttachments: [
														{
															name: `${cacheresponse[0].id}-t9-preview-video.jpg`,
															file: preview_image
														}
													]
												}, function (callback) {
													if (callback) {
														Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
													} else {
														Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
													}
												});
											}
										} else if (preview_image) {
											mqClient.sendMessage(`Error occurred when generating animated preview the video for transport, Will try to send image!`, "warn", "")
											mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
												fromClient: `return.FileWorker.${systemglobal.SystemName}`,
												messageReturn: false,
												messageID: cacheresponse[0].id,
												messageChannelID: cacheresponse[0].channel,
												messageServerID: cacheresponse[0].server,
												messageType: 'command',
												messageAction: 'ReplaceContent',
												itemCacheName: `${cacheresponse[0].id}-t9-preview-video.jpg`,
												itemCacheData: preview_image,
												itemCacheType: 0
											}, function (callback) {
												if (callback) {
													Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
												} else {
													Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
												}
											});
											mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
												fromClient: `return.FileWorker.${systemglobal.SystemName}`,
												messageReturn: false,
												messageID: cacheresponse[0].id,
												messageChannelID: cacheresponse[0].channel,
												messageServerID: cacheresponse[0].server,
												messageType: 'command',
												messageAction: 'RemoveExtendedContent',
												extendedContent: ['preview_image']
											}, function (callback) {
												if (callback) {
													Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
												} else {
													Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
												}
											});
										} else {
											mqClient.sendMessage(`Error occurred when generating preview the video for transport, Will send without preview!`)
										}
										cb(true);
									} else if ((MessageContents.forceRefresh === true || MessageContents.forceRefresh === 'preview') || (!cacheresponse[0].data || (cacheresponse[0].data && !cacheresponse[0].data.preview_image))) {
										const preview_image = await previewVideo(CompleteFilename, startPosition)
										if (preview_image) {
											mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
												fromClient: `return.FileWorker.${systemglobal.SystemName}`,
												messageReturn: false,
												messageID: cacheresponse[0].id,
												messageChannelID: cacheresponse[0].channel,
												messageServerID: cacheresponse[0].server,
												messageType: 'command',
												messageAction: 'ModifyExtendedContent',
												extendedContent: {
													preview_image: 'FILE-0'
												},
												extendedAttachments: [
													{
														name: `${cacheresponse[0].id}-t9-preview-video.jpg`,
														file: preview_image
													}
												]
											}, function (callback) {
												if (callback) {
													Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
												} else {
													Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
												}
											});
										} else {
											mqClient.sendMessage(`Error occurred when generating preview the video for transport, Will send without preview!`, "warn")
										}
										cb(true);
									}
									if (cacheresponse[0].cache_proxy === null || (MessageContents.forceRefresh === true || MessageContents.forceRefresh === 'video')) {
										const preview_video = await encodeVideo(CompleteFilename, true)
										if (preview_video) {
											mqClient.sendData(systemglobal.Discord_Out + '.backlog', {
												fromClient: `return.FileWorker.${systemglobal.SystemName}`,
												messageReturn: false,
												messageID: cacheresponse[0].id,
												messageChannelID: cacheresponse[0].channel,
												messageServerID: cacheresponse[0].server,
												messageType: 'command',
												messageAction: 'ReplaceContent',
												itemCacheName: `${cacheresponse[0].id}.mp4`,
												itemCacheData: preview_video,
												itemCacheType: 1
											}, function (callback) {
												if (callback) {
													Logger.printLine("KanmiMQ", `Sent to ${systemglobal.Discord_Out + '.backlog'}`, "debug")
												} else {
													Logger.printLine("KanmiMQ", `Failed to send to ${systemglobal.Discord_Out + '.backlog'}`, "error")
												}
											});
										} else {
											mqClient.sendMessage(`Error occurred when encoding the video "${fileNameUniq}" for transport, Will not send preview video!`, "err", "", er)
										}
									}
								} else {
									mqClient.sendMessage(`"File "${CompleteFilename}" is cached but is not available here!"`, "warn", 'GenerateVideoPreview')
									cb(true);
								}
								if (!(systemglobal.PickupFolder && cacheresponse[0].filecached === 1))
									fs.unlinkSync(CompleteFilename);
							} else {
								mqClient.sendMessage(`File ${MessageContents.messageID} is not cached!`, "warn", 'GenerateVideoPreview')
								cb(true);
							}
						})
						break;
					default:
						Logger.printLine("Commands", `Unknown Action sent "${MessageContents.messageAction}"`, "error")
						cb(true);
						break;
				}
			} else if (MessageContents.itemFileName) {
				let tempFilePath = path.join(systemglobal.TempFolder, (md5(Date.now().valueOf()) + "." + MessageContents.itemFileName.split("?")[0].split(".").pop().toLowerCase()));
				if (MessageContents.itemFileURL) { // Download a normal URL
					// Download File from URL
					let requestHeaders = {
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
					if (MessageContents.itemFileURL.includes("/i.redd.it/")) {
						requestHeaders = {};
					}
					if (MessageContents.itemReferral !== '') {
						requestHeaders.referer = MessageContents.itemReferral
					}
					let requestOptions = {
						url: encodeURI(MessageContents.itemFileURL),
						headers: requestHeaders
					}
					if (MessageContents.itemCookies !== '') {
						requestOptions.cookie = MessageContents.itemCookies
					}
					const stream = request.get(requestOptions).pipe(fs.createWriteStream(tempFilePath))
					// Write File to Temp Filesystem
					stream.on('open', function () {
						Logger.printLine("DownloadURL", `Starting Download of "${MessageContents.itemFileURL}"...`, "debug");
					})
					stream.on('finish', function () {
						if (systemglobal.FW_Accepted_Files.indexOf(path.extname(tempFilePath).split(".").pop().toLowerCase()).toString() === '-1') { // IF ( Downloaded File Extension is Missing )
							// Get File Type
							FileType.fromFile(tempFilePath)
								.then(function (results) {
									let fileExtension
									if (typeof results !== "undefined") {
										if (!(results.ext === 'mp4' && (path.extname(MessageContents.itemFileName).startsWith('m4') || path.extname(MessageContents.itemFileName).startsWith('mp3')))) {
											fileExtension = path.basename(MessageContents.itemFileName) + "." + results.ext
											Logger.printLine("DownloadURL", `Download ${tempFilePath} (Discovered Filetype : ${results.ext})`, "debug", {
												extension: results.ext,
												mimeType: results.mime,
												filename: tempFilePath,
												url: MessageContents.itemFileURL,
												referral: MessageContents.itemReferral,
												cookies: MessageContents.itemCookies
											})
										}
									} else {
										fileExtension = MessageContents.itemFileName.split("?")[0]
										Logger.printLine("DownloadURL", `Download ${tempFilePath} (Undiscovered Filetype)`, "debug", {
											filename: tempFilePath,
											url: MessageContents.itemFileURL,
											referral: MessageContents.itemReferral,
											cookies: MessageContents.itemCookies
										})
									}
									let Cleanedobject = {
										Type: 'Remote',
										ChannelID: MessageContents.messageChannelID,
										MessageText: MessageContents.messageText,
										FileName: fileExtension,
										FilePath: tempFilePath
									}
									if (MessageContents.backlogRequest && (MessageContents.backlogRequest === true || MessageContents.backlogRequest === 'true')) {
										Cleanedobject.Backlog = true
									}
									if (MessageContents.itemDateTime) {
										Cleanedobject.DateTime = MessageContents.itemDateTime
									}
									if (MessageContents.tweetMetadata) {
										Cleanedobject.tweetMeta = MessageContents.tweetMetadata
									}
									if (MessageContents.messageUserID) {
										Cleanedobject.UserID = MessageContents.messageUserID
									}
									if (MessageContents.messageRefrance) {
										Cleanedobject.messageRefrance = MessageContents.messageRefrance;
									}
									if (MessageContents.bulkRequest && (MessageContents.bulkRequest === true || MessageContents.bulkRequest === 'true')) {
										Cleanedobject.Bulk = MessageContents.bulkRequest
									}
									parseFile(Cleanedobject, function (check) {
										fs.access(tempFilePath, error => {
											if (!error) {
												fs.unlink(tempFilePath, function (err) {
												})
											}
										});
									})
									cb(true)
								})
								.catch(err => {
									cb(true);
									Logger.printLine("FileType", "Failed to get filetype", "error", err)
								})
						} else {
							// IF Filetype is "GIFv" then just say it's MP4 (because it is...)
							if (path.extname(tempFilePath).split(".").pop().toLowerCase().toString() === "gifv") {
								MessageContents.itemFileName = MessageContents.itemFileName.split("?")[0] + ".mp4"
							}
							Logger.printLine("DownloadURL", `Download ${tempFilePath}`, "debug", {
								filename: tempFilePath,
								url: MessageContents.itemFileURL,
								referral: MessageContents.itemReferral,
								cookies: MessageContents.itemCookies
							})

							let Cleanedobject = {
								Type: 'Remote',
								ChannelID: MessageContents.messageChannelID,
								MessageText: MessageContents.messageText,
								FileName: MessageContents.itemFileName.split("?")[0],
								FilePath: tempFilePath
							}
							if (MessageContents.itemDateTime) {
								Cleanedobject.DateTime = MessageContents.itemDateTime
							}
							if (MessageContents.tweetMetadata) {
								Cleanedobject.tweetMeta = MessageContents.tweetMetadata
							}
							if (MessageContents.backlogRequest && (MessageContents.backlogRequest === true || MessageContents.backlogRequest === 'true')) {
								Cleanedobject.Backlog = true
							}
							if (MessageContents.messageUserID) {
								Cleanedobject.UserID = MessageContents.messageUserID
							}
							if (MessageContents.messageRefrance) {
								Cleanedobject.messageRefrance = MessageContents.messageRefrance;
							}
							if (MessageContents.bulkRequest && (MessageContents.bulkRequest === true || MessageContents.bulkRequest === 'true')) {
								Cleanedobject.Bulk = MessageContents.bulkRequest
							}
							parseFile(Cleanedobject,function (check) {
								fs.access(tempFilePath, error => {
									if (!error) {
										fs.unlink(tempFilePath, function (err) {
										})
									}
								});
							})
							cb(true)
						}
					});
					stream.on('error', function (err) {
						Logger.printLine("Download", "Failed to download file", "error", err)
						cb(true);
					})
				} else if (MessageContents.itemVideoURL) { // Download a Video from
					// Download Video in best Video Quality & Audio Quality and Output as MP4
					console.log(MessageContents)
					let videoinfo = {}
					if (youtubedl !== undefined) {
						const video = youtubedl(MessageContents.itemVideoURL,
							[],
							{cwd: __dirname})
						video.on('info', function (info) {
							// Write output to the Temp Filesystem
							Logger.printLine("DownloadVideo", `Download Started : ${info._filename} (${info.size})`, "debug")
							videoinfo.name = info.title
							video.pipe(fs.createWriteStream(tempFilePath))
						})
						video.on('error', function (error) {
							mqClient.sendMessage(`Error downloading the video ${MessageContents.itemVideoURL}`, "err", "DownloadVideo", error)
							cb(true);
						})
						video.on('end', function () {
							fs.open(tempFilePath, 'r+', function (err, fd) {
								if (err && (err.code === 'EBUSY' || err.code === 'ENOENT')) {
									mqClient.sendMessage(`Error accessing the downloaded video ${MessageContents.itemFileName.split("?")[0]}, File was not available`, "err", "DownloadVideo")
								} else {
									fs.close(fd, function () {
										let messageText = MessageContents.messageText
										if (MessageContents.messageText === '**🎞 Downloaded Video**') {
											if (videoinfo.name !== undefined) {
												messageText += ` - ***${videoinfo.name}***`
											}
										}
										messageText += '\n`' + MessageContents.itemVideoURL + '`'
										let Cleanedobject = {
											Type: 'Remote',
											ChannelID: MessageContents.messageChannelID,
											MessageText: messageText,
											FileName: MessageContents.itemFileName.split("?")[0],
											FilePath: tempFilePath
										}
										if (MessageContents.backlogRequest && (MessageContents.backlogRequest === true || MessageContents.backlogRequest === 'true')) {
											Cleanedobject.Backlog = true
										}
										if (MessageContents.itemDateTime) {
											Cleanedobject.DateTime = MessageContents.itemDateTime
										}
										if (MessageContents.tweetMetadata) {
											Cleanedobject.tweetMeta = MessageContents.tweetMetadata
										}
										if (MessageContents.messageUserID) {
											Cleanedobject.UserID = MessageContents.messageUserID
										}
										if (MessageContents.bulkRequest && (MessageContents.bulkRequest === true || MessageContents.bulkRequest === 'true')) {
											Cleanedobject.Bulk = MessageContents.bulkRequest
										}
										parseFile(Cleanedobject, function (check) {
											fs.access(tempFilePath, error => {
												if (!error) {
													fs.unlink(tempFilePath, function (err) {
													})
												}
											})
										})
									})
								}
							})
							cb(true);
						})
					} else {
						mqClient.sendMessage(`Error downloading the video ${MessageContents.itemVideoURL}, Not Installed`, "err", "DownloadVideo")
						cb(true);
					}
				} else if (MessageContents.itemFileRaw) { // Save a Raw File
					fs.writeFile(tempFilePath, MessageContents.itemFileRaw, "base64", function (err) {
						if (err) {
							Logger.printLine("SaveFile", `Error when saving the file ${tempFilePath}`, "error", err)
							cb(true)
						} else {
							Logger.printLine("SaveFile", `Saved File ${tempFilePath}`, "debug")
							let Cleanedobject = {
								Type: 'Remote',
								ChannelID: MessageContents.messageChannelID,
								MessageText: MessageContents.messageText,
								FileName: MessageContents.itemFileName.split("?")[0],
								FilePath: tempFilePath
							}
							if (MessageContents.itemDateTime) {
								Cleanedobject.DateTime = MessageContents.itemDateTime
							}
							if (MessageContents.tweetMetadata) {
								Cleanedobject.tweetMeta = MessageContents.tweetMetadata
							}
							if (MessageContents.backlogRequest && (MessageContents.backlogRequest === true || MessageContents.backlogRequest === 'true')) {
								Cleanedobject.Backlog = true
							}
							if (MessageContents.messageUserID) {
								Cleanedobject.UserID = MessageContents.messageUserID
							}
							if (MessageContents.bulkRequest && (MessageContents.bulkRequest === true || MessageContents.bulkRequest === 'true')) {
								Cleanedobject.Bulk = MessageContents.bulkRequest
							}
							parseFile(Cleanedobject, function (check) {
								fs.access(tempFilePath, error => {
									if (!error) {
										fs.unlink(tempFilePath, function (err) {
										})
									}
								});
							})
							cb(true)
						}
					});
				} else {
					mqClient.sendMessage("No Known Filetype was passed to the FileWorker for parsing, Message Dropped", "err", "Ingest")
					cb(true)
				}
			} else {
				mqClient.sendMessage("No Known Filetype was passed to the FileWorker for parsing, Message Dropped", "err", "Ingest")
				console.log(MessageContents)
				cb(true)
			}
		} catch (err) {
			Logger.printLine("JobParser", "Error Parsing Remote Job - " + err.message, "critical")
			console.error(err);
			cb(true);
		}
	}
	async function parseFile(object, cb) {
		try {
			// Get Snowflake
			globalItemNumber++
			const itemID = globalRunKey + "-" + globalItemNumber.toString().padStart(5, '0');
			let externalMetadata = {};
			// Generate Initial Parameter Object
			let parameters = {
				itemID: itemID,
				sendTo: systemglobal.Discord_Out,
				messageReturn: false,
				fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
				messageType: "sfile"
			}
			if (object.Backlog && object.Backlog === true) {
				parameters.sendTo = systemglobal.Discord_Out + '.backlog'
			}
			if (object.Bulk && object.Bulk === true) {
				parameters.isBulk = true
			}
			if (object.Type.toString() === "Remote") {
				// Remote - File has been sent from a remote client and has been downloaded local
				//          This should already have its requested message and Channel ID passed
				parameters.messageChannelID = object.ChannelID.toString()
				parameters.messageText = object.MessageText.toString()
				parameters.itemFileName = object.FileName.split("?")[0].toString()
				if (object.DateTime) {
					parameters.itemDateTime = object.DateTime.toString()
					console.log(`Got Remote Date and Time for File : ${parameters.itemDateTime}`)
				}
				if (object.tweetMeta) {
					parameters.tweetMetadata = object.tweetMeta
					console.log(`Got Embedded Tweet Metadata : ${object.tweetMeta.userId}:${object.tweetMeta.id}`)
				}
				Logger.printLine("FileProcessor", `Processing Remote File : ${object.FileName.split("?")[0].toString()}`, "info", parameters)
			} else if (object.Type.toString() === "Local") {
				// Local - File has been sent from the local file queue and is a local file on the system
				//         No known channel is passed but comes with a GroupID and original file pat
				parameters.messageText = ''
				parameters.itemFileName = object.FileName.split("?")[0].toString()
				parameters.clientPath = object.OriginPath.toString()
				parameters.prioritySend = (!!object.Priority)
				parameters.clientGroupID = object.OriginGroup.toString()
				parameters.itemDateTime = object.DateTime.toString()
				parameters.tweetMetadata = object.tweetMeta
				// Determine the Channel to send file to from its folder Path
				if (FolderPairs.has(path.basename(path.dirname(object.OriginPath.toString())))) {
					// Find Parent directory to get its Channel ID from the lookup table
					parameters.messageChannelID = FolderPairs.get(path.basename(path.dirname(object.OriginPath.toString()))).id;
				} else {
					// If no valid Path is found, just send it to the Default Data folder
					parameters.messageChannelID = FolderPairs.get("Data").id;
				}
				if (fs.existsSync(object.OriginPath.toString() + '.metadata')) {
					try {
						const json = JSON.parse(fs.readFileSync(object.OriginPath.toString() + '.metadata').toString());
						Logger.printLine("FileProcessor", `Processing Metadata File : ${object.FileName.split("?")[0].toString()}`, "info");
						console.log(json)
						externalMetadata = json;
						fs.unlinkSync(object.OriginPath.toString() + '.metadata');
					} catch (e) {
						Logger.printLine("FileProcessor", `Failed to Metadata : ${object.FileName.split("?")[0].toString()}.metadata`, "error");
					}
				}
				Logger.printLine("FileProcessor", `Processing Local File : ${object.FileName.split("?")[0].toString()}`, "info", parameters);
			} else if (object.Type.toString() === "Proxy") {
				// Proxy - File has been sent from a remote FileWorker but requires this server to send
				//         the file to its final destination, No processing is required for the file
				//         Pretty much its just a message proxy to discord
				parameters.messageChannelID = object.ChannelID.toString()

				parameters.messageText = object.MessageText.toString()
				parameters.itemFileName = object.FileName.split("?")[0].toString()
				parameters.itemFileData = object.FileData.toString()
				if (object.DateTime) {
					parameters.itemDateTime = object.DateTime.toString()
				}
				if (object.tweetMeta) {
					parameters.tweetMetadata = object.tweetMeta
				}
				Logger.printLine("FileProcessor", `Processing Proxy File : ${object.FileName.toString()}`, "debug", parameters)
			}
			//  If not going to the Twitter Compose channel, Add the Buttons
			parameters.addButtons = ["Pin"]
			if (externalMetadata.addButtons) {
				parameters.addButtons.push(externalMetadata.addButtons);
			}
			if (parameters.messageChannelID === discordServers.get('homeGuild').chid_download) {
				parameters.addButtons.push("RemoveFile");
			}

			if (externalMetadata.prioritySend || parameters.prioritySend || (systemglobal.FW_Priority_Channels && systemglobal.FW_Priority_Channels.length > 0 && systemglobal.FW_Priority_Channels.indexOf(parameters.messageChannelID) !== -1)) {
				parameters.sendTo = systemglobal.Discord_Out + '.priority';
			}
			parameters.addButtons.push("Archive", "MoveMessage");
			if (externalMetadata.UserID) {
				parameters.messageUserID = externalMetadata.UserID;
			} else if (object.UserID) {
				parameters.messageUserID = object.UserID;
			}
			if (externalMetadata.messageRefrance) {
				parameters.messageRefrance = externalMetadata.messageRefrance;
			} else if (object.messageRefrance) {
				parameters.messageRefrance = object.messageRefrance;
			}
			if (externalMetadata.itemDateTime) {
				parameters.itemDateTime = externalMetadata.itemDateTime;
			}
			if (externalMetadata.tweetMetadata) {
				parameters.tweetMetadata = externalMetadata.tweetMetadata;
			}
			if (externalMetadata.messageText) {
				parameters.messageText = externalMetadata.messageText;
			}
			if (externalMetadata.itemFileName) {
				parameters.itemFileName = externalMetadata.itemFileName;
			}

			// Resize Image Files
			function resizeImageFile(filename, callback) {
				// Get Image Dimentions
				const dimensions = sizeOf(filename);
				const scaleSize = 2500 // Lets Shoot for 2100?
				let resizeParam = {
					fit: sharp.fit.inside,
					withoutEnlargement: true
				}
				if (dimensions.width > dimensions.height) { // Landscape Resize
					resizeParam.width = scaleSize
				} else { // Portrait or Square Image
					resizeParam.height = scaleSize
				}
				parameters.itemSize = [dimensions.height, dimensions.width, (dimensions.height / dimensions.width)];
				sharp(filename)
					.resize(resizeParam)
					.toFormat('jpg')
					.toBuffer({resolveWithObject: true})
					.then(({data, info}) => {
						callback(data.toString('base64'))
					})
					.catch((err) => {
						callback(false)
					});
			}

			// Get EXIF Data
			function getImageData(filename, callback) {
				try {
					new ExifImage({image: filename}, function (error, exifData) {
						if (error) {
							console.log('Error: ' + error.message);
							callback(false)
						} else {
							if (exifData.exif.CreateDate) {
								parseDate(exifData.exif.CreateDate.split(' '));
							} else if (exifData.exif.DateTimeOriginal) {
								parseDate(exifData.exif.DateTimeOriginal.split(' '));
							} else if (exifData.image.ModifyDate) {
								parseDate(exifData.image.ModifyDate.split(' '));
							} else {
								callback(false)
							}

							function parseDate(imageDate) {
								const date = imageDate[0].split(':').join('-');
								const time = imageDate[1]
								const newTime = moment(`${date} ${time}`).format('YYYY-MM-DD HH:mm:ss');
								callback(newTime);
							}
						}
					})
				} catch (e) {
					callback(false);
					console.error(e);
				}
			}

			// Generate a MultiPart File
			function sendMultiPartFile(cb) {
				//const filepartsid = crypto.randomBytes(16).toString("hex");
				const filepartsid = itemID + '-' + DiscordSnowflake.generate();
				const flesize = Math.ceil(fileSize(object.FilePath.toString()));
				const txtMessage = parameters.messageText

				function sendTxt() {
					parameters.messageType = "stext";
					parameters.messageText = `**🧩 File : ${filepartsid}**\n*🏷 Name: ${object.FileName.toString()} (${flesize.toFixed(2)} MB)*\n` + txtMessage
					parameters.addButtons = ["ReqFile", "Pin", "RemoveFile", "Archive", "MoveMessage"]
					mqClient.sendData(parameters.sendTo, parameters, function (callback) {
						if (callback) {
							Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
							if (object.Type.toString() === "Local") {
								deleteFile(object.FilePath.toString(), function (ready) {
									if (ready === false) {
										Logger.printLine("DeleteFile", `Failed to delete ${object.FilePath.toString()}`, "warn")
									}
								})
							}
							cb(true)
						} else {
							Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
							cb(false)
						}
					});
				}

				function sendPreview(b64Data, previewSuffix) {
					parameters.messageType = "sfile";
					parameters.messageText = `**🧩 File : ${filepartsid}**\n*🏷 Name: ${object.FileName.toString()} (${flesize.toFixed(2)} MB)*\n` + txtMessage;
					parameters.addButtons = ["ReqFile", "Pin", "RemoveFile", "Archive", "MoveMessage"];
					parameters.itemFileData = '' + b64Data;
					parameters.itemFileName = filepartsid + previewSuffix;
					const sendTo = ((systemglobal.PDP_Out_Bulk && object.Bulk && object.Bulk === true) ? ((object.Backlog && object.Backlog === true) ? systemglobal.PDP_Out_Bulk + '.backlog' : systemglobal.PDP_Out_Bulk) : ((systemglobal.PDP_Out) ? ((object.Backlog && object.Backlog === true) ? systemglobal.PDP_Out + '.backlog' : systemglobal.PDP_Out) : parameters.sendTo));
					mqClient.sendData(sendTo, parameters, function (callback) {
						if (callback) {
							Logger.printLine("KanmiMQ", `Sent to ${sendTo}`, "debug")
							if (object.Type.toString() === "Local") {
								deleteFile(object.FilePath.toString(), function (ready) {
									if (ready === false) {
										Logger.printLine("DeleteFile", `Failed to delete ${object.FilePath.toString()}`, "warn")
									}
								})
							}
							cb(true);
						} else {
							Logger.printLine("KanmiMQ", `Failed to send to ${sendTo}`, "error");
							cb(false);
						}
					});
				}

				function sendMultiPreview(b64Data, b64AnimatedPreview, b64Preview) {
					parameters.messageType = "smultifile";
					parameters.messageText = `**🧩 File : ${filepartsid}**\n*🏷 Name: ${object.FileName.toString()} (${flesize.toFixed(2)} MB)*\n` + txtMessage
					parameters.addButtons = ["ReqFile", "Pin", "RemoveFile", "Archive", "MoveMessage"]
					let attachments = [];
					if (b64Data) {
						attachments.push({
							fileName: '' + filepartsid + '.mp4',
							fileData: '' + b64Data
						})
					}
					if (b64AnimatedPreview) {
						attachments.push({
							fileName: `${filepartsid}-t9-preview-video.gif`,
							fileData: '' + b64AnimatedPreview
						})
					}
					if (b64Preview) {
						attachments.push({
							fileName: '' + filepartsid + '-t9-preview-video.jpg',
							fileData: '' + b64Preview
						})
					}

					if (attachments.length === 1) {
						parameters.itemFileData = attachments[0].fileData;
						parameters.itemFileName = attachments[0].fileName;
					} else if (attachments.length === 2) {
						parameters.itemFileArray = attachments;
						delete parameters.itemFileName
					} else if (attachments.length === 3) {
						parameters.itemFileArray = attachments.slice(0,2)
						parameters.extendedContent = {
							preview_image: 'FILE-0'
						}
						parameters.extendedAttachments = [
							{
								name: attachments[2].fileName,
								file: attachments[2].fileData
							}
						]
						delete parameters.itemFileName
					} else {
						sendTxt();
					}

					mqClient.sendData(parameters.sendTo, parameters, function (callback) {
						if (callback) {
							Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
							if (object.Type.toString() === "Local") {
								deleteFile(object.FilePath.toString(), function (ready) {
									if (ready === false) {
										Logger.printLine("DeleteFile", `Failed to delete ${object.FilePath.toString()}`, "warn")
									}
								})
							}
							cb(true)
						} else {
							Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
							cb(false)
						}
					});
				}

				function postSplit(names) {
					Logger.printLine("MPFGen", `Completed splitting file "${filepartsid}" into ${names.length} parts`, "info")
					// Send Each Part
					let MPFChannelID_Lookup = undefined
					FolderPairs.forEach(e => {
						if (e.id === parameters.messageChannelID.toString()) {
							MPFChannelID_Lookup = e.parts
						}
					})
					if (MPFChannelID_Lookup) {
						postSplitParser(MPFChannelID_Lookup, names);
					} else {
						Logger.printLine("MPFGen", `No Parity Channel was mapped, Searching for Spanned File Storage Channel ID...`, "debug", parameters)
						db.safe(`SELECT discord_servers.chid_filedata
								 FROM kanmi_channels,
									  discord_servers
								 WHERE kanmi_channels.channelid = ?
								   AND kanmi_channels.serverid = discord_servers.serverid`, [parameters.messageChannelID], (err, serverdata) => {
							if (err) {
								if (FolderPairs.has("Data")) {
									mqClient.sendMessage(`SQL Error occurred when finding the file parts channel for ${parameters.messageChannelID}, Using default channel`, "err", "SQL", err);
									postSplitParser(FolderPairs.get("Data").parts, names);
								} else {
									mqClient.sendMessage(`SQL Error occurred when finding the file parts channel for ${parameters.messageChannelID}, Ticket will be dropped!`, "err", "SQL", err);
									cb(true);
								}
							} else if (serverdata.length > 0) {
								Logger.printLine("MPFGen", `Unmapped Channel, Using ${serverdata[0].chid_filedata} for Spanned File Storage`, "debug", parameters)
								postSplitParser(serverdata[0].chid_filedata, names);
							} else {
								if (FolderPairs.has("Data")) {
									mqClient.sendMessage(`Unable to find the file parts channel for ${parameters.messageChannelID}, Using default channel`, "err", "MPFGen");
									postSplitParser(FolderPairs.get("Data").parts, names);
								} else {
									mqClient.sendMessage(`Unable to find the file parts channel for ${parameters.messageChannelID}, Ticket will be dropped!`, "err", "MPFGen");
									cb(true);
								}
							}
						})
					}
				}

				function postSplitParser(MPFChannelID, names) {
					let sentParts = 0;
					parameters.fileData = {
						name: object.FileName.toString().trim().replace(/[/\\?%*:|"<>]/g, '_'),
						uuid: filepartsid,
						size: flesize.toFixed(2),
						total: names.length
					};

					let requests = names.reduce((promiseChain, partpath, key) => {
						return promiseChain.then(() => new Promise((resolve) => {
							try {
								const partBase64String = fs.readFileSync(partpath, {encoding: 'base64'})
								mqClient.sendData(parameters.sendTo, {
									ItemID: `${itemID}-${key}`,
									sendTo: parameters.sendTo,
									messageReturn: false,
									fromClient: `return.${facilityName}.${systemglobal.SystemName}`,
									fileUUID: filepartsid,
									filePartN: key,
									filePartTotal: names.length,
									messageType: "sfile",
									messageChannelID: MPFChannelID,
									messageText: `🧩 ID: ${filepartsid}\n🏷 Name: ${object.FileName.toString().trim().replace(/[/\\?%*:|"<>]/g, '_')}\n📦 Part: ${key}/${names.length}`,
									itemFileName: path.basename(partpath).split("?")[0],
									itemFileData: '' + partBase64String
								}, async (ok) => {
									if (ok) {
										Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
										fs.unlinkSync(partpath)
										sentParts++
										resolve();
									} else {
										Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
										resolve();
									}
								});
							} catch (err) {
								Logger.sendMessage(`Failed to read the file part ${partpath}`, 'error', 'PartsInspector', err)
								resolve();
							}
						}))
					}, Promise.resolve());
					requests.then(async () => {
						if (sentParts !== names.length) {
							mqClient.sendMessage(`Error occurred when getting split file "${object.FilePath.toString()}" for transport - Not all parts were uploaded (${sentParts} !== ${names.length})! Retry...`, "err", "MPFGen")
							cb(false)
						} else if (systemglobal.FW_Accepted_Images.indexOf(path.extname(object.FileName.toString()).split(".").pop().toLowerCase()) !== -1) {
							getImageData(object.FilePath.toString(), function (_date) {
								if (_date) {
									parameters.itemDateTime = _date;
									Logger.printLine("BackDate", `Image Original date is ${_date}, will backdate`, 'debug');
								} else {
									Logger.printLine("BackDate", `Failed to get a valid date from the image file!`, 'warn');
								}
								try {

									resizeImageFile(object.FilePath.toString(), function (data) {
										if (data === false) {
											mqClient.sendMessage(`Error occurred when resizing the image "${object.FilePath.toString()}" for transport, Will send without preview!`, "err", "")
											sendTxt()
										} else {
											sendPreview(data, '.jpg')
										}
									})
								} catch (e) {
									mqClient.sendMessage(`Error occurred when resizing the image "${object.FilePath.toString()}" for transport, Will send without preview!`, "err", e.message)
									sendTxt()
								}
							})
						} else if (systemglobal.FW_Accepted_Videos.indexOf(path.extname(object.FileName.toString()).split(".").pop().toLowerCase()) !== -1) {
							// Get Video Duration
							const startPosition = await (async (filename) => {
								const exec = require('child_process').exec;
								let ffmpegParam = `ffmpeg -i "${filename}" 2>&1 | grep "Duration"| cut -d ' ' -f 4 | sed s/,// | sed 's@\\..*@@g' | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + B[1] }'`
								const duration = await new Promise((resolve) => {
									exec(ffmpegParam, (err, stdout, stderr) => {
										if (err) {
											console.error(err);
											resolve(false);
										}
										resolve(parseInt(stdout.split("\n").join("").trim()));
									})
								})
								if (duration) {
									return msToTime((duration * .25) * 1000)
								} else {
									return '00:00:00'
								}
							})(object.FilePath.toString());

							const preview_animated = await animateVideo(object.FilePath.toString(), startPosition)
							const preview_image = await previewVideo(object.FilePath.toString(), startPosition)
							const preview_video = await encodeVideo(object.FilePath.toString(), true)


							sendMultiPreview(preview_video, preview_animated, preview_image)
						} else {
							sendTxt()
						}
					})
				}

				if (systemglobal.UseJSSplit) {
					Logger.printLine("MPFGen", `Starting to split file "${object.FilePath.toString()}" as "${filepartsid}"...`, "info")
					splitFile.splitFileBySize(object.FilePath.toString(), 24500000)
						.then((names) => {
							postSplit(names)
						})
						.catch((err) => {
							mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport, Ticket will be dropped!`, "err", "MPFGen", err)
							cb(true);
						});
				} else {
					expectedParityParts = (fileSize(object.FilePath.toString()) / 24.5)

					Logger.printLine("MPFGen-Native", `Starting to split file "${object.FilePath.toString()}" in to ${expectedParityParts} parts as "${filepartsid}"...`, "info")
					try {
						if (expectedParityParts > 670) {
							const FileBase = path.resolve(path.dirname(object.FilePath.toString()))
							const FileName = path.basename(object.FilePath.toString())
							const nativeSplit = spawn("split", ["-b", "5000000000", `${FileName}`, `MULTI_JFS_${filepartsid}.PSF-`], {cwd: FileBase});

							nativeSplit.stderr.on("data", data => {
								Logger.printLine("MPFGen-Native-MultiSplit", `${data}`, "info")
							});

							nativeSplit.on('error', (err) => {
								mqClient.sendMessage(`Error occurred when multi-splitting the "${object.FilePath.toString()}" for transport - "${(err) ? err.message : "Unknown"}", Ticket will be dropped!`, "err", "MPFGen", err)
								cb(true);
							});

							nativeSplit.on("close", code => {
								if (code === 0) {
									fs.readdir(FileBase, async function (err, files) {
										//handling error
										if (err) {
											mqClient.sendMessage(`Error occurred when getting the multi-split files "${object.FilePath.toString()}" for transport - ${err.message}, Ticket will be dropped!`, "err", "MPFGen", err)
											cb(true);
										} else if (files.length > 0) {
											const nativeParts = files.filter(e => e.startsWith(`MULTI_JFS_${filepartsid}.PSF-`));
											if (nativeParts.length > 0) {
												let parityList = [];
												let requests = nativeParts.reduce((promiseChain, msf) => {
													return promiseChain.then(() => new Promise((resolve) => {
														const nativeSplitParts = spawn("split", ["-b", "24500000", `${msf}`, `${msf.replace('MULTI_JFS_', 'JFS_')}-`], {cwd: FileBase});

														nativeSplitParts.stderr.on("data", data => { Logger.printLine("MPFGen-Native", `${data}`, "info") });

														nativeSplitParts.on('error', (err) => {
															mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport - "${(err) ? err.message : "Unknown"}", Ticket will be dropped!`, "err", "MPFGen", err)
															cb(true);
															resolve(false);
														});

														nativeSplitParts.on("close", code => {
															if (code === 0) {
																fs.readdir(FileBase, function (err, files) {
																	//handling error
																	if (err) {
																		mqClient.sendMessage(`Error occurred when getting split files "${object.FilePath.toString()}" for transport - ${err.message}, Ticket will be dropped!`, "err", "MPFGen", err)
																		cb(true);
																		resolve(false);
																	} else if (files.length > 0) {
																		const nativeParts = files.filter(e => e.startsWith(`${msf.replace('MULTI_JFS_', 'JFS_')}-`));
																		if (nativeParts.length > 0) {
																			rimraf(path.join(path.resolve(path.dirname(object.FilePath.toString())), msf), () => {console.log('Removed Temp Multi-Split File')})
																			parityList.push(...nativeParts.map(e => path.join(FileBase, e)))
																			setTimeout(() => {
																				resolve(true);
																			}, 2000);
																		} else {
																			mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport - No parity parts generated, Ticket will be dropped!`, "err", "MPFGen", err)
																			cb(true);
																			resolve(false);
																		}
																	}
																});
															} else {
																mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport - Stop Code ${code}, Ticket will be dropped!`, "err", "MPFGen")
																cb(true);
																resolve(false);
															}
														});
													}));
												}, Promise.resolve());
												requests.then(function (results) {
													postSplit(parityList)
												})
											} else {
												mqClient.sendMessage(`Error occurred when multi-splitting the "${object.FilePath.toString()}" for transport - No parity parts generated, Ticket will be dropped!`, "err", "MPFGen", err)
												cb(true);
											}
										}
									});
								} else {
									mqClient.sendMessage(`Error occurred when multi-splitting the "${object.FilePath.toString()}" for transport - Stop Code ${code}, Ticket will be dropped!`, "err", "MPFGen")
									cb(true);
								}
							});
						} else {
							const FileBase = path.resolve(path.dirname(object.FilePath.toString()))
							const FileName = path.basename(object.FilePath.toString())
							const nativeSplit = spawn("split", ["-b", "24500000", `${FileName}`, `JFS_${filepartsid}.PSF-`], {cwd: FileBase});

							nativeSplit.stderr.on("data", data => {
								Logger.printLine("MPFGen-Native", `${data}`, "info")
							});

							nativeSplit.on('error', (err) => {
								mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport - "${(err) ? err.message : "Unknown"}", Ticket will be dropped!`, "err", "MPFGen", err)
								cb(true);
							});

							nativeSplit.on("close", code => {
								if (code === 0) {
									fs.readdir(FileBase, function (err, files) {
										//handling error
										if (err) {
											mqClient.sendMessage(`Error occurred when getting split files "${object.FilePath.toString()}" for transport - ${err.message}, Ticket will be dropped!`, "err", "MPFGen", err)
											cb(true);
										} else if (files.length > 0) {
											const nativeParts = files.filter(e => e.startsWith(`JFS_${filepartsid}.PSF-`));
											if (nativeParts.length > 0) {
												setTimeout(() => {
													postSplit(nativeParts.map(e => path.join(FileBase, e)))
												}, 2000);
											} else {
												mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport - No parity parts generated, Ticket will be dropped!`, "err", "MPFGen", err)
												cb(true);
											}
										}
									});
								} else {
									mqClient.sendMessage(`Error occurred when splitting the "${object.FilePath.toString()}" for transport - Stop Code ${code}, Ticket will be dropped!`, "err", "MPFGen")
									cb(true);
								}
							});
						}
					} catch (err) {
						Logger.printLine("JobParser", "Error Parsing Local Job - " + err.message, "critical")
						console.error(err);
						cb(true);
					}
				}
			}

			const sendTo = ((systemglobal.PDP_Out_Bulk && object.Bulk && object.Bulk === true) ? ((object.Backlog && object.Backlog === true) ? systemglobal.PDP_Out_Bulk + '.backlog' : systemglobal.PDP_Out_Bulk) : ((systemglobal.PDP_Out) ? ((object.Backlog && object.Backlog === true) ? systemglobal.PDP_Out + '.backlog' : systemglobal.PDP_Out) : parameters.sendTo));;
			if (fileSize(object.FilePath.toString()) > 24.8 && object.Type.toString() !== "Proxy") {
				if (systemglobal.FW_Accepted_Images.indexOf(path.extname(object.FileName.toString()).split(".").pop().toLowerCase()) !== -1) {
					if (fileSize(object.FilePath.toString()) < 50 && systemglobal.FW_Always_Keep_Orginal_Images === false && ['gif', 'webm', 'webp'].indexOf(path.extname(object.FileName.toString()).split(".").pop().toLowerCase()) === -1) {
						if (path.extname(object.FileName.toString()).split(".").pop().toLowerCase() !== "png") {
							Logger.printLine("ParseFile", `${object.FileName.toString()} : Resize Image`, "debug", {
								fileSize: fileSize(object.FilePath.toString())
							})
							getImageData(object.FilePath.toString(), function (_date) {
								if (_date) {
									parameters.itemDateTime = _date;
									Logger.printLine("BackDate", `Image Original date is ${_date}, will backdate`, 'debug');
								} else {
									Logger.printLine("BackDate", `Failed to get a valid date from the image file!`, 'warn');
								}
								resizeImageFile(object.FilePath.toString(), function (data) {
									if (data === false) {
										mqClient.sendMessage(`Error occurred when resizing the image "${object.FilePath.toString()}" for transport, Ticket Dropped!`, "err", "", err)
										cb(true)
									} else {
										parameters.itemFileData = data
										mqClient.sendData(sendTo, parameters, function (callback) {
											if (callback) {
												Logger.printLine("KanmiMQ", `Sent to ${sendTo}`, "debug")
												if (object.Type.toString() === "Remote") {
													deleteFile(object.FilePath.toString(), function (ready) {
														// Do Nothing
													})
												}
											} else {
												Logger.printLine("KanmiMQ", `Failed to send to ${sendTo}`, "error")
											}
										});
										cb(true)
									}
								})
							})
						} else {
							Logger.printLine("ParseFile", `${object.FileName.toString()} : Large PNG Image, Resize + MultiPart Original`, "debug", {
								fileSize: fileSize(object.FilePath.toString())
							})
							sendMultiPartFile(cb)
						}
					} else {
						Logger.printLine("ParseFile", `${object.FileName.toString()} : Large Image, Resize + MultiPart Original`, "debug", {
							fileSize: fileSize(object.FilePath.toString())
						})
						sendMultiPartFile(cb)
					}
				} else if (systemglobal.FW_Accepted_Videos.indexOf(path.extname(object.FileName.toString()).split(".").pop().toLowerCase()) !== -1 && fileSize(object.FilePath.toString()) < 50 && (object.Type === 'Local' && object.OriginPath.includes("VRChat"))) {
					Logger.printLine("ParseFile", `${object.FileName.toString()} : Encode Video`, "debug", {
						fileSize: fileSize(object.FilePath.toString())
					})
					const fulfill = await encodeVideo(object.FilePath.toString(), false)
					if (fulfill) {
						parameters.itemFileData = fulfill
						mqClient.sendData(parameters.sendTo, parameters, function (callback) {
							if (callback) {
								Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
								if (object.Type.toString() === "Remote") {
									deleteFile(object.FilePath.toString(), function (ready) {
										// Do Nothing
									})
								}
								cb(true)
							} else {
								Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
								cb(false)
							}
						});
					} else {
						sendMultiPartFile(cb)
					}
				} else {
					Logger.printLine("ParseFile", `${object.FileName.toString()} : File to Large`, "debug", {
						fileSize: fileSize(object.FilePath.toString())
					})
					sendMultiPartFile(cb)
				}
			} else {
				Logger.printLine("ParseFile", `${object.FileName.toString()} : Direct Send`, "debug", {
					fileSize: fileSize(object.FilePath.toString())
				})

				function sendFile(ready) {
					fs.open(object.FilePath.toString(), 'r+', function (err, fd) {
						if (err && (err.code === 'EBUSY' || err.code === 'ENOENT')) {
							ready(false)
						} else {
							fs.close(fd, function () {
								try {
									parameters.itemFileData = fs.readFileSync(object.FilePath.toString(), {encoding: 'base64'}).toString()
									ready(true)
								} catch (e) {
									ready(false)
								}
							})
						}
					})
				}

				function sendMultiFile(preview, ready) {
					fs.open(object.FilePath.toString(), 'r+', function (err, fd) {
						if (err && (err.code === 'EBUSY' || err.code === 'ENOENT')) {
							ready(false)
						} else {
							fs.close(fd, function () {
								if (preview.length > 1) {
									parameters.extendedContent = {
										preview_image: 'FILE-0'
									}
									parameters.extendedAttachments = [
										{
											name: `${parameters.itemFileName.split('.')[0]}-t9-preview-video.${(preview[1].type === 1) ? 'gif' : 'jpg'}`,
											file: preview[1].data
										}
									]
								}
								parameters.itemFileArray = [
									{
										fileName: '' + parameters.itemFileName,
										fileData: '' + fs.readFileSync(object.FilePath.toString(), {encoding: 'base64'}).toString()
									},
									{
										fileName: `${parameters.itemFileName.split('.')[0]}-t9-preview-video.${(preview[0].type === 1) ? 'gif' : 'jpg'}`,
										fileData: '' + preview[0].data
									}
								];
								ready(true)
							})
						}
					})
				}

				if (systemglobal.FW_Accepted_Images.indexOf(object.FileName.toString().split(".").pop().toLowerCase()) !== -1) {
					getImageData(object.FilePath.toString(), function (_date) {
						if (_date) {
							parameters.itemDateTime = _date;
							Logger.printLine("BackDate", `Image Original date is ${_date}, will backdate`, 'debug');
						} else {
							Logger.printLine("BackDate", `Failed to get a valid date from the image file!`, 'warn');
						}
						sendFile(function (ready) {
							if (ready) {
								mqClient.sendData(sendTo, parameters, function (callback) {
									if (callback) {
										Logger.printLine("KanmiMQ", `Sent to ${sendTo}`, "debug")
										if (object.Type.toString() === "Remote") {
											deleteFile(object.FilePath.toString(), function (ready) {
												// Do Nothing
											})
										}
										cb(true)
									} else {
										Logger.printLine("KanmiMQ", `Failed to send to ${sendTo}`, "error")
										cb(false)
									}
								});
							}
						})
					})
				} else if (systemglobal.FW_Accepted_Videos.indexOf(object.FileName.toString().split(".").pop().toLowerCase()) !== -1) {
					// Get Video Duration
					const startPosition = await (async (filename) => {
						const exec = require('child_process').exec;
						let ffmpegParam = `ffmpeg -i "${filename}" 2>&1 | grep "Duration"| cut -d ' ' -f 4 | sed s/,// | sed 's@\\..*@@g' | awk '{ split($1, A, ":"); split(A[3], B, "."); print 3600*A[1] + 60*A[2] + B[1] }'`
						const duration = await new Promise((resolve) => {
							exec(ffmpegParam, (err, stdout, stderr) => {
								if (err) {
									console.error(err);
									resolve(false);
								}
								resolve(parseInt(stdout.split("\n").join("").trim()));
							})
						})
						if (duration) {
							return msToTime((duration * .25) * 1000)
						} else {
							return '00:00:00'
						}
					})(object.FilePath.toString());

					const preview_animated = await animateVideo(object.FilePath.toString(), startPosition)
					const preview_image = await previewVideo(object.FilePath.toString(), startPosition)

					let previews = [];
					if (preview_animated)
						previews.push({ data: preview_animated, type: 1 });
					if (preview_image)
						previews.push({ data: preview_image, type: 0 });
					if (previews.length > 0) {
						sendMultiFile(previews, function (ready) {
							if (ready) {
								mqClient.sendData(parameters.sendTo, parameters, function (callback) {
									if (callback) {
										Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
										if (object.Type.toString() === "Remote") {
											deleteFile(object.FilePath.toString(), function (ready) {
												// Do Nothing
											})
										}
										cb(true)
									} else {
										Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
										cb(false)
									}
								});
							}
						})
					} else {
						sendFile(function (ready) {
							if (ready) {
								mqClient.sendData(parameters.sendTo, parameters, function (callback) {
									if (callback) {
										Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
										if (object.Type.toString() === "Remote") {
											deleteFile(object.FilePath.toString(), function (ready) {
												// Do Nothing
											})
										}
										cb(true)
									} else {
										Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
										cb(false)
									}
								});
							}
						})
					}
				} else {
					sendFile(function (ready) {
						if (ready) {
							mqClient.sendData(parameters.sendTo, parameters, function (callback) {
								if (callback) {
									Logger.printLine("KanmiMQ", `Sent to ${parameters.sendTo}`, "debug")
									if (object.Type.toString() === "Remote") {
										deleteFile(object.FilePath.toString(), function (ready) {
											// Do Nothing
										})
									}
									cb(true)
								} else {
									Logger.printLine("KanmiMQ", `Failed to send to ${parameters.sendTo}`, "error")
									cb(false)
								}
							});
						} else {
							Logger.printLine("SendFile", `Failed to access file ${object.FileName.toString()}`, "error")
							cb(true)
						}
					})
				}
			}
		} catch (err) {
			Logger.printLine("JobParser", "Error Parsing Local Job - " + err.message, "critical")
			console.error(err);
			cb(true);
		}
	}
	start()

	if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
		setInterval(() => {
			request.get(`http://${systemglobal.Watchdog_Host}/watchdog/ping?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
				if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
					console.error(`Failed to ping watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
				}
			})
		}, 60000)
	}
})()
