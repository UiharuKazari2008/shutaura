const systemglobal = require("../config.json");
(async () => {
    const facilityName = 'Updater';
    const path = require('path');
    const cron = require('node-cron');
    const {spawn, exec} = require("child_process");
    const fs = require("fs");
    const pm2 = require("pm2");
    const tx2 = require('tx2')
    let systemglobal = require('./../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
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
            exec(['git', ...options].join(' '), { cwd : path.join(process.cwd(), `./${(project) ? '../' + project : ''}`), timeout: 60000, encoding: 'utf8' }, (err, stdout, stderr) => {
                if (err) {
                    console.error(err)
                    resolve(false)
                } else {
                    if (stderr.length > 1)
                        console.error(stderr);
                    resolve(stdout.split('\n').filter(e => e.length > 0 && e !== ''))
                }
            });
        }))
    }
    async function npmUpdate (project) {
        return await new Promise((resolve => {
            exec('npm install', { cwd : path.join(process.cwd(), `./${(project) ? '../' + project : ''}`), encoding: 'utf8' }, (err, stdout, stderr) => {
                if (err) {
                    console.error(err)
                    resolve(false)
                } else {
                    if (stderr.length > 1)
                        console.error(stderr)
                    if (stdout.length > 1)
                        console.log(stdout)
                    resolve(true)
                }
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
        const update = await git(['remote', 'update'], project)
        if (branch)
            await git(['checkout', branch], project)
        return (update) ? await git(['--no-pager', 'diff', '--name-only', 'FETCH_HEAD'], project) : false
    }
    async function commitMessages(project) {
        return await git(['log', '--pretty=format:%s', 'HEAD^..FETCH_HEAD'], project)
    }

    async function updateProject(project, branch) {
        let filesToUpdate
        const updatesAvailable = await isUpdateAvailable(project, branch);
        const commits = await commitMessages(project);
        if (commits === false) {
            await Logger.printLine('GetUpdated', `Failed get commits from repo! Timeout`, 'critical');
            return false;
        }
        const updateBlocked = (commits.filter(e => e.includes('MANUAL') || (e.includes('DOWNTIME') && systemglobal.NoDowntimeAllowed && systemglobal.NoDowntimeAllowed === true) || e.includes('NOAUTO') || e.includes('VLOCK')).length > 0)
        if (!updatesAvailable) {
            await mqClient.sendMessage(`Unable to check for update!`, 'error', 'GetUpdated');
            if (args.check && last)
                process.exit(1)
            return false
        } else {
            filesToUpdate = [...updatesAvailable]
        }
        const pm2Procs = await getRunningProccess()
        if (pm2Procs.length === 0 || pm2Procs === false) {
            await mqClient.sendMessage(`Unable to access PM2 proccess list!`, 'critical', 'GetUpdated');
            return false
        }
        const activeProc = Array.from(pm2Procs).filter(e => e.pm2_env.pm_cwd.endsWith((project) ? project : 'sequenzia-framework'));
        const allApps = activeProc.filter(e => (e.name !== "Updater" || args.install))
        const appNeedToRestart = activeProc.filter(e => (e.name !== "Updater" || args.install) && (systemglobal.AlwaysRestart && systemglobal.AlwaysRestart.indexOf(e.name) !== -1 || filesToUpdate.filter(f => (f === e.pm2_env.pm_exec_path.replace(e.pm2_env.pm_cwd + '/', '') || f.startsWith('js/utils/'))).length > 0) && e.pm2_env.status === "online")
        const dontRestart = appNeedToRestart.filter(e => systemglobal.DontRestart && systemglobal.DontRestart.indexOf(e.name) !== -1)
        const appToRestart = appNeedToRestart.filter(e => dontRestart.filter(f => f.name === e.name).length === 0)
        const isNpmUpdatesNeeded = (filesToUpdate.filter(e => e === 'package.json').length > 0)
        const isUpdateSelf = (filesToUpdate.filter(e => e === 'js/updater.js').length > 0)
        const applyPatch = (commits.filter(e => e.includes('APPLYPATCH')).length > 0)


        if (filesToUpdate.length > 0 && (appNeedToRestart.length > 0 || isNpmUpdatesNeeded || isUpdateSelf || project || args.force)) {
            Logger.printLine('GetUpdates', `${filesToUpdate.length} Updates are available for ${(project) ? project : 'sequenzia-framework'}\n${filesToUpdate.join('\n')}`, 'info')
            if (args.force || (( systemglobal.AutomaticUpdates && systemglobal.AutomaticUpdates === true || args.install) && !updateBlocked && !(applyPatch && args.nopatch))) {
                if (!systemglobal.SoftUpdateRepos || args.soft) {
                    if (await git(['reset', '--hard', `origin${(branch) ? '/' + branch : ''}`], project) === false) {
                        await Logger.printLine('GetUpdated', `Failed reset repo! Timeout`, 'critical');
                        return false;
                    }
                }
                if (await git(['pull'], project) === false) {
                    await Logger.printLine('GetUpdated', `Failed pull repo! Timeout`, 'critical');
                    return false;
                }
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
                if ((systemglobal.AutomaticRestart && systemglobal.AutomaticRestart === true) || args.install) {
                    if (!project && !systemglobal.DisablePatching && (!args.nopatch || args.force) && applyPatch) {
                        await mqClient.sendMessage(`Patch for ${(project) ? project : 'sequenzia-framework'} will be performed!`, 'warning', 'GetUpdates')
                        let databaseState = (fs.existsSync('./applied_patches.json')) ? require('./../applied_patches.json') : {  database: [] };
                        for (const update of fs.readdirSync('./patch/').filter(e => e.endsWith('.js') && databaseState.database.indexOf(e) === -1).sort()) {
                            const updateFile = require(path.join('./../patch/', update))(Logger, db);
                            if (commits.filter(e => e.includes('STAGE0KILL')).length > 0) {
                                for (const proc of allApps) {
                                    await stopProccess(proc.name)
                                }
                            }
                            if (updateFile.backupDatabase !== undefined && !args.nobackup) {
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
                    for (const proc of ((commits.filter(e => e.includes('STAGE0KILL') || e.includes('STAGE1KILL') || e.includes('STAGE2KILL') || e.includes('STAGE3KILL') || e.includes('FULLRESTART')).length > 0 && !systemglobal.DisablePatching && !args.nopatch) ? allApps : appToRestart)) {
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
                    await mqClient.sendMessage(`${filesToUpdate.length} Updates were downloaded for ${(project) ? project : 'sequenzia-framework'} with ${appNeedToRestart.length} pending restarts${(applyPatch) ? '\n**This update requires a patch to be applied, Run updater manually with --force or run the update-database script**' : ''}`, 'notify', 'GetUpdated', appNeedToRestart.map(e => e.name).join('\n'))
                }
            } else if (updateBlocked) {
                await mqClient.sendMessage(`${filesToUpdate.length} Updates are available for for ${(project) ? project : 'sequenzia-framework'}\n**This update is blocked from automatic application and requires manual intervention**${(applyPatch) ? '\n**This update requires a patch to be applied, Run updater manually with --force or run the update-database script**' : ''}`, 'notify', 'GetUpdated')
            } else {
                await mqClient.sendMessage(`${filesToUpdate.length} Updates are available for ${(project) ? project : 'sequenzia-framework'}${(applyPatch) ? '\n**This update requires a patch to be applied, Run updater manually with --force or run the update-database script**' : ''}`, 'notify', 'GetUpdated')
            }
        } else {
            await Logger.printLine('GetUpdates', `No Updates are available for ${(project) ? project : 'sequenzia-framework'}`, 'info')
        }
        return true
    }
    
    if (systemglobal.UpdateProjects) {
         await Promise.all(systemglobal.UpdateProjects.map(async project => {
             await updateProject(project.name, (project.branch) ? project.branch : (project.name) ? 'main' : undefined)
             if (!args.check && cron.validate(project.schedule)) {
                 cron.schedule(project.schedule, () => {
                     updateProject(project.name, (project.branch) ? project.branch : (project.name) ? 'main' : undefined)
                 })
             }
        }))
        if (args.check)
            process.exit(0)
    }
    else {
        await updateProject(undefined, undefined);
        if (!args.check)
            cron.schedule('3 5 * * *', () => { updateProject() })
        if (args.check)
            process.exit(0)
    }

    if (!args.check) {
        tx2.action('update-now', async (reply) => {
            if (systemglobal.UpdateProjects) {
                await Promise.all(systemglobal.UpdateProjects.map(async project => {
                    updateProject(project.name, (project.branch) ? project.branch : (project.name) ? 'main' : undefined)
                }))
                reply({answer: `Updated ${systemglobal.UpdateProjects.length} projects`})
            } else {
                updateProject()
                reply({answer: `Updated project`})
            }
        })
    }

    process.on('uncaughtException', function(err) {
        Logger.printLine("uncaughtException", err.message, "critical", err)
        process.exit(1)
    });
})()
