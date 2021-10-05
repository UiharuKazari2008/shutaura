let systemglobal = require('./config.json');
const fs = require("fs");

const db = require('../utils/shutauraSQL')("Toolbox");
(async () => {
    console.log("Getting items extract/transfer hash...");
    const messagesUpdate = await db.query(`SELECT eid, channel, attachment_name, attachment_url
                                           FROM kanmi_records
                                           WHERE attachment_hash IS NULL
                                             AND attachment_url != 'multi'
                                             AND attachment_url IS NOT NULL
                                             AND source = 0`);
    if (messagesUpdate.error) {
        console.error("Database error: " + messagesUpdate.error.sqlMessage)
        process.exit(1)
    } else if (messagesUpdate.rows.length > 0) {
        console.log(`Got ${messagesUpdate.rows.length} Items!`)
        await Promise.all(messagesUpdate.rows.map(async e => {
            const urlParts = e.attachment_url.split(`https://cdn.discordapp.com/attachments/`)
            if (urlParts.length === 2) {
                let hashValue = urlParts[1]
                if (hashValue.startsWith(`${e.channel}/`)) {
                    hashValue = hashValue.split('/')[1]
                } else {
                    console.warn(`Hash is not a member of channel ${hashValue} - Will Store larger hash value :(`)
                }
                //console.log(urlParts[1])
                if (urlParts[1].includes(e.attachment_name)) {
                    const updated = await db.query(`UPDATE kanmi_records
                                                        SET attachment_hash = ?
                                                        WHERE eid = ?`, [hashValue, e.eid])
                    if (updated.error) {
                        console.error("Database error: " + updated.error.sqlMessage)
                        process.exit(1)
                    }
                } else {
                    console.warn(`Hash filename missmatch, will update to "${e.attachment_name}" => "${urlParts[1].split('/')[2]}"`)
                    const filename = urlParts[1].split('/')[2]
                    const updated = await db.query(`UPDATE kanmi_records
                                                        SET attachment_hash = ?,
                                                            attachment_name = ?
                                                        WHERE eid = ?`, [hashValue, filename, e.eid])
                    if (updated.error) {
                        console.error("Database error: " + updated.error.sqlMessage)
                        process.exit(1)
                    }
                }
            } else {
                console.error(`${e.eid} URL is incongruent with its assigned channel, you may need to repair the database from JFS Console`)
                console.error(`${e.channel} =/=> ${e.attachment_url}`)
                process.exit(1);
            }
        }))
        console.log(`Updated ${messagesUpdate.rows.length} Items!`)
    } else {
        console.log('Nothing to update, all items have hash values! :)')
    }

    console.log("Getting items clear urls...");
    const messagesPurge = await db.query(`SELECT x.*, y.cache_id FROM (SELECT channel, id, cache_proxy FROM kanmi_records WHERE attachment_hash IS NOT NULL AND cache_proxy LIKE '%-t9-preview.jpg' AND source = 0) x LEFT JOIN (SELECT cache, id AS cache_id FROM discord_cache)y ON (x.id = y.cache_id)`);
    if (messagesPurge.error) {
        console.error("Database error: " + messagesPurge.error.sqlMessage)
        process.exit(1)
    } else if (messagesPurge.rows.length > 0) {
        console.log(`Got ${messagesPurge.rows.length} Items!`)
        let listOfDeadPolyfills = [];
        await Promise.all(messagesPurge.rows.filter(e => !e.cache_proxy.includes(`/attachments/${e.channel}/`)).map(async e => {
            const updated = await db.query(`DELETE FROM discord_cache WHERE id = ?`, [e.id])
            const updated1 = await db.query(`UPDATE kanmi_records SET cache_proxy = null WHERE id = ?`, [e.id])
            if (updated.error) {
                console.error("Database error: " + updated.error.sqlMessage)
                process.exit(1)
            } else if (updated1.error) {
                console.error("Database error: " + updated1.error.sqlMessage)
                process.exit(1)
            } else {
                listOfDeadPolyfills.push(e.cache_id)
            }
        }))
        fs.writeFileSync(`deadpolyfils.json`, Buffer.from(JSON.stringify({ msgDelete : listOfDeadPolyfills })))
        await Promise.all(messagesPurge.rows.filter(e => e.cache_proxy.includes(`/attachments/${e.channel}/`)).map(async e => {
           const updated1 = await db.query(`UPDATE kanmi_records SET cache_proxy = null WHERE id = ?`, [e.id])
            if (updated1.error) {
                console.error("Database error: " + updated1.error.sqlMessage)
                process.exit(1)
            }
        }))
        console.log(`Updated ${messagesPurge.rows.length} Items!`)
    } else {
        console.log('Nothing to update, all items have had there urls wiped! :)')
    }
})()