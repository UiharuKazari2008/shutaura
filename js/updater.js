(async () => {
    const facilityName = 'Updater';
    const path = require('path');
    const cron = require('node-cron');
    const {spawn} = require("child_process");
    const fs = require("fs");
    const pm2 = require("pm2");
    const tx2 = require('tx2')
    let systemglobal = require('./../config.json');
    const minimist = require("minimist");
    const request = require('request').defaults({ encoding: null });
    let args = minimist(process.argv.slice(2));

    const db = require('./utils/shutauraSQL')(facilityName);
    const Logger = require('./utils/logSystem')(facilityName);

    Logger.printLine("Init", "Updater", "info");

    async function loadDatabaseCache() {
        Logger.printLine("SQL", "Getting System Parameters", "debug")
        const _systemparams = await db.query(`SELECT * FROM global_parameters WHERE (system_name = ? OR system_name IS NULL) AND (application = 'updater' OR application IS NULL) ORDER BY system_name, application, account`, [systemglobal.SystemName])
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
            const _home_guild = systemparams_sql.filter(e => e.param_key === 'discord.home_guild');
            if (_home_guild.length > 0 && _home_guild[0].param_value) {
                systemglobal.DiscordHomeGuild = _home_guild[0].param_value;
            }
            // Home Discord Server - Required - Dynamic
            // DiscordHomeGuild = 1234567890
            // discord.home_guild = 1234567890
            const _mq_discord_out = systemparams_sql.filter(e => e.param_key === 'mq.discord.out');
            if (_mq_discord_out.length > 0 && _mq_discord_out[0].param_value) {
                systemglobal.Discord_Out = _mq_discord_out[0].param_value;
            }
            // Discord Outbox MQ - Required - Dynamic
            // Discord_Out = "outbox.discord"
            // mq.discord.out = "outbox.discord"
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
        }

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
    const mqClient = require('./utils/mqClient')(facilityName, systemglobal);

    const selectedBranch = (systemglobal.UpdateBranch) ? systemglobal.UpdateBranch : 'main'
    const waitForShutdown = [ 'Discord I/O' ]

    async function git (options, project) {
        return await new Promise((resolve => {
            let results = ''
            const child = spawn('git', options, { cwd : path.join(process.cwd(), `./${(project) ? '../' + project : ''}`) });
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', function (data) {
                if (data.toString().trim().length > 0)
                    results += data.toString()
            });
            child.stderr.setEncoding('utf8');
            child.stderr.on('data', function (data) {
                if (data.toString().trim().length > 0)
                    results += data.toString()
                console.error(data);
            });
            child.on('close', function (code) {
                resolve(results.split('\n').filter(e => e.length > 0 && e !== ''))
            });
        }))
    }
    async function npmUpdate (project) {
        return await new Promise((resolve => {
            let results = ''
            const child = spawn('npm', ['install'], { cwd : path.join(process.cwd(), `./${(project) ? '../' + project : ''}`) });
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', function (data) {
                results += data.toString()
            });
            child.stderr.setEncoding('utf8');
            child.stderr.on('data', function (data) {
                results += data.toString()
                console.error(data);
            });
            child.on('close', function (code) {
                resolve((code === 0))
            });
        }))
    }
    async function getRunningProccess() {
        return await new Promise(resolve => {
            pm2.connect(err => {
                if (err) {
                    Logger.printLine("Updater@PM2", `Failed to connect to PM2 - ${err.message}`, 'error');
                    resolve([]);
                }
                pm2.list((err, list) => {
                    if (err) {
                        Logger.printLine("Updater@PM2", `Failed to list PM2 processes - ${err.message}`, 'error');
                        resolve([]);
                    }
                    pm2.disconnect()
                    resolve(list)
                })
            })
        })
    }
    async function restartProccess(proc) {
        return await new Promise(resolve => {
            pm2.connect(err => {
                if (err) {
                    mqClient.printLine("Updater@PM2", `Failed to connect to PM2 - ${err.message}`, 'error');
                    resolve(false);
                }
                if (waitForShutdown.indexOf(proc) !== -1) {
                    pm2.reload(proc, err1 => {
                        if (err1)
                            mqClient.printLine("Updater@PM2", `Failed to soft restart PM2 processes - ${err1.message}`, 'error');
                        pm2.disconnect()
                        resolve(!err1)
                    })
                } else {
                    pm2.restart(proc, (err1) => {
                        if (err1)
                            mqClient.printLine("Updater@PM2", `Failed to restart PM2 processes - ${err1.message}`, 'error');
                        pm2.disconnect()
                        resolve(!err1)
                    })
                }
            })
        })
    }
    async function stopProccess(proc) {
        return await new Promise(resolve => {
            pm2.connect(err => {
                if (err) {
                    mqClient.printLine("Updater@PM2", `Failed to connect to PM2 - ${err.message}`, 'error');
                    resolve(false);
                }
                pm2.stop(proc, (err1) => {
                    if (err1)
                        mqClient.printLine("Updater@PM2", `Failed to restart PM2 processes - ${err1.message}`, 'error');
                    pm2.disconnect()
                    resolve(!err1)
                })
            })
        })
    }
    async function isUpdateAvailable(project, branch) {
        await git(['remote', 'update'], project)
        return await git(['--no-pager', 'diff', '--name-only', 'FETCH_HEAD', (branch)? branch : selectedBranch], project)
    }
    async function commitMessages(project) {
        return await git(['log', '--pretty=format:%s', 'HEAD^..FETCH_HEAD'], project)
    }

    async function updateProject(project, branch) {
        let filesToUpdate
        const updatesAvailable = await isUpdateAvailable(project, branch);
        const commits = await commitMessages(project);
        const updateBlocked = (commits.filter(e => e.includes('MANUAL') || (e.includes('DOWNTIME') && systemglobal.NoDowntimeAllowed && systemglobal.NoDowntimeAllowed === true) || e.includes('NOAUTO') || e.includes('VLOCK')).length > 0)
        if (!updatesAvailable) {
            await mqClient.sendMessage(`Unable to check for update!`, 'error', 'GetUpdated');
            return false
        } else {
            filesToUpdate = [...updatesAvailable]
        }
        const pm2Procs = await getRunningProccess()
        if (pm2Procs.length === 0) {
            await mqClient.sendMessage(`Unable to access PM2 proccess list!`, 'critical', 'GetUpdated');
            return false
        }
        const activeProc = Array.from(pm2Procs).filter(e => e.pm2_env.pm_cwd.endsWith((project) ? project : 'sequenzia-framework'));
        console.log(filesToUpdate)
        const allApps = activeProc.filter(e => e.name !== "Updater")
        const appNeedToRestart = activeProc.filter(e => e.name !== "Updater" && (systemglobal.AlwaysRestart && systemglobal.AlwaysRestart.indexOf(e.name) !== -1 || filesToUpdate.filter(f => (f === e.pm2_env.pm_exec_path.replace(e.pm2_env.pm_cwd + '/', '') || f.startsWith('js/utils/'))).length > 0) && e.pm2_env.status === "online")
        const dontRestart = appNeedToRestart.filter(e => systemglobal.DontRestart && systemglobal.DontRestart.indexOf(e.name) !== -1)
        const appToRestart = appNeedToRestart.filter(e => dontRestart.filter(f => f.name === e.name).length === 0)
        const isNpmUpdatesNeeded = (filesToUpdate.filter(e => e === 'package.json').length > 0)
        const isUpdateSelf = (filesToUpdate.filter(e => e === 'js/updater.js').length > 0)


        if (filesToUpdate.length > 0 && (appNeedToRestart.length > 0 || isNpmUpdatesNeeded || isUpdateSelf || project)) {
            Logger.printLine('GetUpdates', `${filesToUpdate.length} Updates are available for ${(project) ? project : 'sequenzia-framework'}`, 'info')
            if (systemglobal.AutomaticUpdates && systemglobal.AutomaticUpdates === true && !updateBlocked) {
                if (!systemglobal.SoftUpdateRepos) {
                    await git(['reset', '--hard', 'origin'], project);
                }
                await git(['pull'], project)
                if (filesToUpdate.filter(e => e.startsWith('js/utils/')).length > 0) {
                    await mqClient.sendMessage(`Core utilities for ${(project) ? project : 'sequenzia-framework'} updates are available! This will restart all processes!`, 'warning', 'GetUpdates')
                }
                if (isNpmUpdatesNeeded) {
                    if (await npmUpdate(project)) {
                        await mqClient.sendMessage(`NPM Packages for ${(project) ? project : 'sequenzia-framework'} were updated successfully`, 'info', 'GetUpdates')
                    } else {
                        await mqClient.sendMessage(`Failed to update NPM Packages for ${(project) ? project : 'sequenzia-framework'}, please try to update NPM manually!`, 'critical', 'GetUpdated')
                        return false
                    }
                }
                if (systemglobal.AutomaticRestart && systemglobal.AutomaticRestart === true) {
                    if (!project && !systemglobal.DisablePatching && (filesToUpdate.filter(e => e.startsWith('patch/')).length > 0 || commits.filter(e => e.includes('APPLYPATCH')).length > 0)) {
                        await mqClient.sendMessage(`Patch for ${(project) ? project : 'sequenzia-framework'} will be performed!`, 'warning', 'GetUpdates')
                        let databaseState = (fs.existsSync('./applied_patches.json')) ? require('./../applied_patches.json') : {  database: [] };
                        for (const update of fs.readdirSync('./patch/').filter(e => e.endsWith('.js') && databaseState.database.indexOf(e) === -1).sort()) {
                            const updateFile = require(path.join('./../patch/', update))(Logger, db);
                            if (commits.filter(e => e.includes('STAGE0KILL')).length > 0) {
                                for (const proc of allApps) {
                                    await stopProccess(proc.name)
                                }
                            }
                            if (updateFile.backupDatabase !== undefined) {
                                if (!(await updateFile.backupDatabase())) {
                                    await mqClient.sendMessage(`Automatic Update failed to backup the database for ${(project) ? project : 'sequenzia-framework'}\nUpdate canceled`, 'critical', 'GetUpdated')
                                    return false
                                }
                            }
                            if (commits.filter(e => e.includes('STAGE1KILL')).length > 0) {
                                for (const proc of allApps) {
                                    await stopProccess(proc.name)
                                }
                            }
                            if (updateFile.prePatchDatabase !== undefined) {
                                if (!(await updateFile.prePatchDatabase())) {
                                    await mqClient.sendMessage(`Automatic Update failed to preform phase 1 patches for ${(project) ? project : 'sequenzia-framework'}\nCheck the console or apply manually with js/update-datebase.js`, 'critical', 'GetUpdated')
                                    return false
                                }
                            }

                            if (commits.filter(e => e.includes('STAGE2KILL')).length > 0) {
                                for (const proc of allApps) {
                                    await stopProccess(proc.name)
                                }
                            }
                            if (updateFile.patchDatabase !== undefined) {
                                if (!(await updateFile.patchDatabase())) {
                                    await mqClient.sendMessage(`Automatic Update failed to preform phase 2 patches for ${(project) ? project : 'sequenzia-framework'}\nCheck the console or apply manually with js/update-datebase.js`, 'critical', 'GetUpdated')
                                    return false
                                }
                            }
                            if (commits.filter(e => e.includes('STAGE3KILL')).length > 0) {
                                for (const proc of allApps) {
                                    await stopProccess(proc.name)
                                }
                            }
                            if (updateFile.postPatchDatabase !== undefined) {
                                if (!(await updateFile.postPatchDatabase())) {
                                    await mqClient.sendMessage(`Automatic Update failed to preform phase 3 patches for ${(project) ? project : 'sequenzia-framework'}\nCheck the console or apply manually with js/update-datebase.js`, 'critical', 'GetUpdated')
                                    return false
                                }
                            }
                            databaseState.database.push(update)
                            await mqClient.sendMessage(`Successfully applied patches for ${(project) ? project : 'sequenzia-framework'} with ${update}`, 'info', 'GetUpdated');
                        }
                        fs.writeFileSync('./applied_patches.json', Buffer.from(JSON.stringify(databaseState)))
                        await mqClient.sendMessage(`Successfully applied all required patches for ${(project) ? project : 'sequenzia-framework'}`, 'info', 'GetUpdated');
                    }
                    for (const proc of ((commits.filter(e => e.includes('STAGE0KILL') || e.includes('STAGE1KILL') || e.includes('STAGE2KILL') || e.includes('STAGE3KILL') || e.includes('FULLRESTART')).length > 0 && !systemglobal.DisablePatching) ? allApps : appToRestart)) {
                        if (await restartProccess(proc.name)) {
                            await mqClient.sendMessage(`Updated and Restarted ${proc.name} for ${(project) ? project : 'sequenzia-framework'}`, 'info', 'GetUpdated')
                        } else {
                            await mqClient.sendMessage(`Failed to restart system ${proc.name} for ${(project) ? project : 'sequenzia-framework'}`, 'critical', 'GetUpdated')
                        }
                    }
                    for (const proc of dontRestart) {
                        await mqClient.sendMessage(`Updated ${proc.name} for ${(project) ? project : 'sequenzia-framework'} with pending restart required!`, 'info', 'GetUpdated')
                    }
                    if  (isUpdateSelf) {
                        await Logger.printLine('GetUpdates', `Updater was updated! See you on the other side!`, 'info')
                        setTimeout(() => process.exit(100), 10000)
                    }
                } else {
                    await mqClient.sendMessage(`${filesToUpdate.length} Updates were downloaded for ${(project) ? project : 'sequenzia-framework'} with ${appNeedToRestart.length} pending restarts`, 'notify', 'GetUpdated', appNeedToRestart.map(e => e.name).join('\n'))
                }
            } else if (updateBlocked) {
                await mqClient.sendMessage(`${filesToUpdate.length} Updates are available for for ${(project) ? project : 'sequenzia-framework'}\n**This update is blocked from automatic application and requires manual intervention**`, 'notify', 'GetUpdated')
            } else {
                await mqClient.sendMessage(`${filesToUpdate.length} Updates are available for ${(project) ? project : 'sequenzia-framework'}`, 'notify', 'GetUpdated')
            }
        } else {
            await mqClient.sendMessage(`No Updates are available for ${(project) ? project : 'sequenzia-framework'}`, 'info', 'GetUpdates')
        }
        return true
    }
    if (systemglobal.UpdateProjects) {
        systemglobal.UpdateProjects.forEach(async project => {
            updateProject(project.name, (project.branch) ? project.branch : (project.name) ? 'main' : undefined)
            if (cron.validate(project.schedule)) {
                cron.schedule(project.schedule, () => {
                    updateProject(project.name, (project.branch) ? project.branch : (project.name) ? 'main' : undefined)
                })
            }
        })
    } else {
        updateProject();
        cron.schedule('3 5 * * *', () => { updateProject() })
    }

    tx2.action('update-now', async (reply) => {
        if (systemglobal.UpdateProjects) {
            await Promise.all(systemglobal.UpdateProjects.map(async project => {
                updateProject(project.name, (project.branch) ? project.branch : (project.name) ? 'main' : undefined)
            }))
            reply({ answer : `Updated ${systemglobal.UpdateProjects.length} projects` })
        } else {
            updateProject()
            reply({ answer : `Updated project` })
        }
    })


    if (systemglobal.Watchdog_Host && systemglobal.Watchdog_ID) {
        setTimeout(() => {
            request.get(`http://${systemglobal.Watchdog_Host}/watchdog/init?id=${systemglobal.Watchdog_ID}&entity=${facilityName}-${systemglobal.SystemName}`, async (err, res) => {
                if (err || res && res.statusCode !== undefined && res.statusCode !== 200) {
                    console.error(`Failed to init watchdog server ${systemglobal.Watchdog_Host} as ${facilityName}:${systemglobal.Watchdog_ID}`);
                }
            })
        }, 5000)
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