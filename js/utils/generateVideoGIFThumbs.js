(async () => {
    let systemglobal = require('../../config.json');
    if (process.env.SYSTEM_NAME && process.env.SYSTEM_NAME.trim().length > 0)
        systemglobal.SystemName = process.env.SYSTEM_NAME.trim()
    const facilityName = 'Cache-Correction';

    const db = require('./shutauraSQL')(facilityName);
    const mqClient = require('./mqClient')(facilityName, systemglobal);

    const fileworker = 'inbox.fileworker'

    const results = await db.query(`SELECT id, real_filename FROM kanmi_records WHERE (real_filename LIKE '%.mov' OR real_filename LIKE '%.mp4' OR real_filename LIKE '%.avi' OR real_filename LIKE '%.mkv' OR real_filename LIKE '%.ts' ) AND (cache_proxy IS NULL OR cache_proxy NOT LIKE '%.gif') AND filecached = 1 ORDER BY eid DESC LIMIT 10`)
    console.log(`There are ${results.rows.length} thumbnails to be regenerated`)
    results.rows.map(message => {
        mqClient.sendData(systemglobal.FileWorker_In, {
            messageReturn: false,
            messageID: message.id,
            messageAction: 'GenerateVideoPreview',
            forceRefresh: true,
            messageType: 'command'
        }, function (ok) {
            if (ok) {
                console.log(`Sent ${message.real_filename} for generation...`)
            } else {
                console.error(`Failed to send ${message.real_filename} for generation`)
            }
        })
    })
})()
