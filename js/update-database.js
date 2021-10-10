(async () => {
    const fs = require("fs");
    const path = require("path");

    const facilityName = 'Toolbox';
    const db = require('./utils/shutauraSQL')(facilityName);
    const Logger = require('./utils/logSystem')(facilityName);
    console.log('Manual Database Update')

    let state = ((() => {
        if (fs.existsSync('./applied_patches.json')) {
            return require('./../applied_patches.json')
        } else {
            return {
                database: []
            }
        }
    })())
    for (const update of fs.readdirSync('./patch/').filter(e => e.endsWith('.js') && state.database.indexOf(e) === -1).sort()) {
        const updateFile = require(path.join('./../patch/', update))(Logger, db)
        if (updateFile.backupDatabase)
            if (!(await updateFile.backupDatabase()))
                process.exit(1)
        if (updateFile.prePatchDatabase)
            if (!(await updateFile.prePatchDatabase()))
                process.exit(1)
        if (updateFile.patchDatabase)
            if (!(await updateFile.patchDatabase()))
                process.exit(1)
        if (updateFile.postPatchDatabase)
            if (!(await updateFile.postPatchDatabase()))
                process.exit(1)
        console.log(`Applied patch ${update}`)
        state.database.push(update)
    }
    fs.writeFileSync('./applied_patches.json', Buffer.from(JSON.stringify(state)))
    process.exit(0);
})()

