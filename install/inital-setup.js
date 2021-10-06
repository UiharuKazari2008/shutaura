// noinspection ES6MissingAwait

let systemglobal = require('./config.json');
const path = require('path');
const amqp = require('amqplib/callback_api');
const crypto = require("crypto");
const colors = require('colors');
const remoteSize = require('remote-file-size')
let amqpConn = null;
let pubChannel = null;
let selfstatic = {};
const RateLimiter = require('limiter').RateLimiter;
const limiter1 = new RateLimiter(1, 250);
const limiter2 = new RateLimiter(1, 250);
const request = require('request').defaults({ encoding: null });
const moment = require('moment');
const minimist = require("minimist");
const eris = require("eris");
let args = minimist(process.argv.slice(2));

const db = require('./js/utils/shutauraSQL')("InitSetup");

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
let discordClient = null;
let authwareOnly = false;
rl.question("(a/d) Are you settings up a (a)uthware server or (d)ata server: ", async function(server_select) {
    if (server_select.toLowerCase().startsWith('d')) {
        discordClient = new eris.CommandClient(systemglobal.Discord_Key, {
            compress: true,
            restMode: true,
        }, {
            name: "Kanmi Maintenance",
            description: "Sequenzia Maintenance Framework",
            owner: "Yukimi Kazari",
            prefix: "man ",
            restMode: true,
        });
        authwareOnly = false;
    } else if (server_select.toLowerCase().startsWith('a')) {
        discordClient = new eris.CommandClient(systemglobal.Authware_Key, {
            compress: true,
            restMode: true,
        }, {
            name: "Kanmi Maintenance",
            description: "Sequenzia Maintenance Framework",
            owner: "Yukimi Kazari",
            prefix: "man ",
            restMode: true,
        });
        authwareOnly = true;
    } else {
        console.log("Invalid Type")
        process.exit(1);
    }
    console.log("Getting Ready")
    discordClient.on("ready", async () => {
        await rl.question("(y/n) Clear Tables (Only do this if you need to erase everything): ", async function(clearTables) {
            if (clearTables.toLowerCase().startsWith('y') || clearTables.toLowerCase().startsWith('t')) {
                await db.query(`DELETE FROM discord_permissons`);
                await db.query(`DELETE FROM discord_reactions`);
                await db.query(`DELETE FROM discord_reactions_autoadd`);
                await db.query(`DELETE FROM kanmi_channels`);
                await db.query(`DELETE FROM kanmi_virtual_channels`);
                await db.query(`DELETE FROM discord_servers`);
                await db.query(`DELETE FROM kanmi_virtual_channels`);
                await db.query(`DELETE FROM sequenzia_superclass`);
                await db.query(`DELETE FROM sequenzia_class`);
            }
            const searchParents = [
                "Control Center",
                "System Status",
                "System Data",
                "Timeline",
                "Pictures",
                "Files",
                "Archives",
            ];
            let parentMap = [];
            let serverMap = {};
            let channels = [];

            discordClient.getRESTGuilds()
                .then(async function (guilds) {
                    console.log(`DANGER: NEVER import an exsisting server again as it will erase all data associated with that server!\n`);
                    console.log('Available Servers:')
                    console.log(guilds.map(m => `${m.id} => ${m.name}`));
                    await rl.question("Enter the server ID that you want to setup: ", async function(serverID) {
                        let guild = guilds.filter(e => e.id.toString() === serverID.trim())
                        if (serverID.length > 5 && guild.length > 0) {
                            if (authwareOnly) {
                                console.log("Reading Roles...")
                                await discordClient.getRESTGuildRoles(guild[0].id)
                                    .then(async (roles) => {
                                        let rolesRecords = []
                                        await roles.forEach(e => {
                                            if (e.name.endsWith(" Read") || e.name.endsWith(" Write") || e.name.endsWith(" Manage")) {
                                                rolesRecords.push({
                                                    name: e.name.toLowerCase().split(' ').join('_'),
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Sequenzia Access") {
                                                rolesRecords.push({
                                                    name: 'system_user',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Content Manager") {
                                                rolesRecords.push({
                                                    name: 'system_interact',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Framework") {
                                                rolesRecords.push({
                                                    name: 'sysbot',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Admin Mode") {
                                                rolesRecords.push({
                                                    name: 'syselevated',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Server Manager") {
                                                rolesRecords.push({
                                                    name: 'system_admin',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            }
                                        })
                                        await rolesRecords.forEach(async e => {
                                            console.log(` - Created ${e.name}`)
                                            await db.query(`REPLACE INTO discord_permissons SET ?`, e);
                                        })
                                        console.log("Roles Setup");
                                        const exsistingServer = await db.query(`SELECT * FROM discord_servers WHERE serverid = ?`, [guild[0].id])
                                        if (exsistingServer && exsistingServer.rows && exsistingServer.rows.length > 0) {
                                            console.log(`${guild[0].name} already exists!`)
                                            await rl.question(`(y/n) Disable Login from ${guild[0].name} (${guild[0].id}): `, async function(clearTables) {
                                                if (clearTables.toLowerCase().startsWith('y') || clearTables.toLowerCase().startsWith('t')) {
                                                    await db.query('UPDATE discord_servers SET ? WHERE serverid = ?', [{
                                                        serverid: guild[0].id,
                                                        short_name: guild[0].name.substring(0,3).toUpperCase(),
                                                        authware_enabled: 0,
                                                    }, guild[0].id]);
                                                } else {
                                                    await db.query('UPDATE discord_servers SET ? WHERE serverid = ?', [{
                                                        serverid: guild[0].id,
                                                        short_name: guild[0].name.substring(0,3).toUpperCase(),
                                                        authware_enabled: 1,
                                                    }, guild[0].id]);
                                                }
                                                console.log('Server Installed')
                                            })
                                        } else {
                                            await db.query('REPLACE INTO discord_servers SET ?', {
                                                serverid: guild[0].id,
                                                short_name: guild[0].name.substring(0,3).toUpperCase(),
                                                authware_enabled: 1,
                                            });
                                        }
                                    })
                                    .catch(function (e) {
                                        console.log(e);
                                    })
                            } else {
                                console.log("Reading Roles...")
                                await discordClient.getRESTGuildRoles(guild[0].id)
                                    .then(async (roles) => {
                                        let rolesRecords = []
                                        await roles.forEach(e => {
                                            if (e.name.endsWith(" Read") || e.name.endsWith(" Write") || e.name.endsWith(" Manage")) {
                                                rolesRecords.push({
                                                    name: e.name.toLowerCase().split(' ').join('_'),
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Sequenzia Access") {
                                                rolesRecords.push({
                                                    name: 'system_user',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Content Manager") {
                                                rolesRecords.push({
                                                    name: 'system_interact',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Framework") {
                                                rolesRecords.push({
                                                    name: 'sysbot',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Admin Mode") {
                                                rolesRecords.push({
                                                    name: 'syselevated',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            } else if (e.name === "Server Manager") {
                                                rolesRecords.push({
                                                    name: 'system_admin',
                                                    role: e.id,
                                                    server: guild[0].id
                                                })
                                            }
                                        })
                                        await rolesRecords.forEach(async e => {
                                            console.log(` - Created ${e.name}`)
                                            await db.query(`REPLACE INTO discord_permissons SET ?`, e);
                                        })
                                        console.log("Roles Setup")
                                    })
                                    .catch(function (e) {
                                        console.log(e);
                                    })
                                console.log("Reading Channels...")
                                await discordClient.getRESTGuildChannels(guild[0].id)
                                    .then(async chs => {
                                        serverMap = {
                                            serverid: guild[0].id,
                                            position: 0,
                                            short_name: "SEQ",
                                            nice_name: null,
                                            authware_enabled: 1
                                        };
                                        await chs.filter(e => e.type === 4 && searchParents.indexOf(e.name) !== -1).forEach(async channel => {
                                            let values = {
                                                source: 0,
                                                channelid: channel.id,
                                                serverid: guild[0].id,
                                                position: channel.position,
                                                name: channel.name,
                                                short_name: channel.name.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '').trim(),
                                                parent: 'isparent',
                                                nsfw: (channel.nsfw) ? 1 : 0,
                                                last_message: "0",
                                                description: null,
                                            }
                                            switch (searchParents.indexOf(channel.name)) {
                                                case 0:
                                                case 1:
                                                case 2:
                                                    values.classification = "system";
                                                    values.role = null;
                                                    values.role_write = null;
                                                    values.role_manage = null;
                                                    break;
                                                case 3:
                                                    values.classification = "timeline";
                                                    values.role = null;
                                                    values.role_write = null;
                                                    values.role_manage = null;
                                                    break;
                                                case 4:
                                                    values.classification = "pictures";
                                                    values.role = "photo_read";
                                                    values.role_write = 'photo_write';
                                                    values.role_manage = 'photo_manage';
                                                    break;
                                                case 5:
                                                    values.classification = "data";
                                                    values.role = "files_read";
                                                    values.role_write = 'files_write';
                                                    values.role_manage = 'files_manage';
                                                    break;
                                                case 6:
                                                    values.classification = "archives";
                                                    values.role = "admin";
                                                    values.role_write = 'admin';
                                                    values.role_manage = 'admin';
                                                    break;
                                                default:
                                                    values.classification = null;
                                                    values.role = null;
                                                    values.role_write = null;
                                                    values.role_manage = null;
                                                    break;
                                            }
                                            parentMap.push({
                                                id: channel.id,
                                                name: channel.name,
                                                class: values.classification,
                                                role: values.role,
                                                write: values.role_write,
                                                manage: values.role_manage
                                            })
                                            channels.push(values)
                                        })
                                        await chs.filter(e => e.type === 0).forEach(async channel => {
                                            let values = {
                                                source: 0,
                                                channelid: channel.id,
                                                serverid: guild[0].id,
                                                position: channel.position,
                                                name: channel.name,
                                                short_name: channel.name.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '').trim(),
                                                parent: channel.parentID,
                                                nsfw: (channel.nsfw) ? 1 : 0,
                                                last_message: (channel.lastMessageID) ? channel.lastMessageID : null,
                                                description: (channel.topic) ? channel.topic : null,
                                            }
                                            const parent = parentMap.filter(e => e.id === channel.parentID)
                                            if (parent.length > 0) {
                                                values.classification = parent[0].class;
                                                values.role = parent[0].role;
                                                values.role_write = parent[0].write;
                                                values.role_manage = parent[0].manage;
                                            } else if (channel.name === 'notes' || channel.name === 'bookmarks') {
                                                values.classification = 'notes';
                                                values.role = 'admin';
                                                values.role_write = 'admin';
                                                values.role_manage = 'admin';
                                            } else if (channel.name === "downloads") {
                                                values.classification = 'data';
                                                values.role = 'admin';
                                                values.role_write = 'admin';
                                                values.role_manage = 'admin';
                                            } else if (channel.name === "root-fs") {
                                                values.watch_folder = `Data`;
                                                values.classification = 'data';
                                                values.role = 'admin';
                                                values.role_write = 'admin';
                                                values.role_manage = 'admin';
                                            } else if (channel.name === "tripcode") {
                                                values.watch_folder = `Tripcode`;
                                                values.classification = 'data';
                                                values.role = 'admin';
                                                values.role_write = 'admin';
                                                values.role_manage = 'admin';
                                            } else {
                                                values.classification = null;
                                                values.role = null;
                                                values.role_write = null;
                                                values.role_manage = null;
                                            }
                                            if (channel.name === "downloads") {
                                                serverMap.chid_download = channel.id;
                                                serverMap.chid_download_video = channel.id;
                                            } else if (channel.name === "console" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_system = channel.id;
                                            } else if (channel.name === "system-file-parity" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_filedata = channel.id;
                                            } else if (channel.name === "system-cache" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_filecache = channel.id;
                                            } else if (channel.name === "archives-root" && parent.length > 0 && parent[0].class === "archives") {
                                                serverMap.chid_archive = channel.id;
                                            } else if (channel.name === "archives-nsfw" && parent.length > 0 && parent[0].class === "archives") {
                                                serverMap.chid_archive_nsfw = channel.id;
                                            } else if (channel.name === "info" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_msg_info = channel.id;
                                            } else if (channel.name === "warnings" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_msg_warn = channel.id;
                                            } else if (channel.name === "errors" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_msg_err = channel.id;
                                            } else if (channel.name === "critical" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_msg_crit = channel.id;
                                            } else if (channel.name === "notifications" && parent.length > 0 && parent[0].class === "system") {
                                                serverMap.chid_msg_notif = channel.id;
                                            }

                                            channels.push(values);
                                        })
                                    })
                                    .catch(function (e) {
                                        console.log(e);
                                    })
                                await discordClient.getRESTGuildEmojis(guild[0].id)
                                    .then(async emojis => {
                                        const expectedEmojis = [
                                            {
                                                serverid: guild[0].id,
                                                position: 0,
                                                reaction_name: "Clear",
                                                readd: 0,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 1,
                                                reaction_name: "Download",
                                                readd: 0,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 1,
                                                reaction_name: "WatchLaterYT",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 2,
                                                reaction_name: "Check",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 2,
                                                reaction_name: "LikeRT",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 3,
                                                reaction_name: "Like",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 4,
                                                reaction_name: "Retweet",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 5,
                                                reaction_name: "ReplyTweet",
                                                readd: 0,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 6,
                                                reaction_name: "AddUser",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 7,
                                                reaction_name: "ExpandSearch",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 20,
                                                reaction_name: "Pin",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 98,
                                                reaction_name: "MoveMessage",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 99,
                                                reaction_name: "ReqFile",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 100,
                                                reaction_name: "Archive",
                                                readd: 1,
                                            },
                                            {
                                                serverid: guild[0].id,
                                                position: 101,
                                                reaction_name: "RemoveFile",
                                                readd: 1,
                                            },
                                        ];
                                        await emojis.forEach(async emoji => {
                                            const preparedEmoji = expectedEmojis.filter(e => e.reaction_name.toLowerCase() === emoji.name.toLowerCase() && emoji.id);
                                            if (preparedEmoji.length === 0) {
                                                console.error(` - ${emoji.name} skipped, not expected`);
                                            } else {
                                                let values = preparedEmoji[0];
                                                values.reaction_emoji = emoji.name;
                                                values.reaction_custom = `${emoji.name}:${emoji.id}`;

                                                await db.query('REPLACE INTO discord_reactions SET ?', values);
                                                console.log(` - ${values.reaction_name} => ${values.reaction_custom}`);
                                            }
                                        })
                                    })
                                    .catch(function (e) {
                                        console.log(e);
                                    })

                                await db.query('REPLACE INTO discord_servers SET ?', serverMap);
                                console.log("Installed Server");
                                await channels.forEach(async c => {
                                    console.log(` - Created ${c.name}`)
                                    await db.query(`REPLACE INTO kanmi_channels SET ?`, c);
                                })
                                console.log("Installed Channels");

                                console.log('Settings Up Seq Super/Classes....')
                                const superClass = [
                                    {
                                        super: `images`,
                                        position: 1,
                                        name: 'Photos',
                                        uri: 'gallery'
                                    },
                                    {
                                        super: `files`,
                                        position: 10,
                                        name: 'Files',
                                        uri: 'files'
                                    },
                                    {
                                        super: `cards`,
                                        position: 20,
                                        name: 'Cards',
                                        uri: 'cards'
                                    }
                                ]
                                const classes = [
                                    {
                                        class: 'pictures',
                                        super: 'images',
                                        position: 0,
                                        name: 'Pictures',
                                        icon: 'fa-image'
                                    },
                                    {
                                        class: 'data',
                                        super: 'files',
                                        position: 0,
                                        name: 'Files',
                                        icon: 'fa-folder'
                                    },
                                    {
                                        class: 'archives',
                                        super: 'files',
                                        position: 99,
                                        name: 'Archives',
                                        icon: 'fa-archive'
                                    },
                                    {
                                        class: 'notes',
                                        super: 'cards',
                                        position: 0,
                                        name: 'Notes',
                                        icon: 'fa-clipboard'
                                    },
                                ]
                                await superClass.forEach(async (e) => {
                                    await db.query(`REPLACE INTO sequenzia_superclass SET ?`, e);
                                })
                                await classes.forEach(async (e, i) => {
                                    await db.query(`REPLACE INTO sequenzia_class SET ?`, e);
                                })
                                console.log(`Installed Basic Sequenzia Classes`)
                            }
                            console.log(`All Done! Waiting for background tasks to sync...`)

                            setTimeout(() => {
                                process.exit(0);
                            }, 30000);
                        } else {
                            console.log('You must enter a valid server ID!')
                            process.exit(1);
                        }
                    })
                })
                .catch(function (e) {
                    console.log(e);
                })
        });
    });

    rl.on("close", function() {
        console.log("\nBye!");
        process.exit(0);
    });

    discordClient.on("error", (err) => {
        console.error(err);
        discordClient.connect()
    });

    discordClient.connect().catch((er) => { console.error(er) });
})


