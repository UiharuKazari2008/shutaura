const getUrls = require('get-urls');
const fs = require('fs');

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    let copy = obj.constructor();
    for (let attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function filterItems(arr, query) {
    return arr.filter(function(el) {
        return el.toLowerCase().indexOf(query.toLowerCase()) !== -1
    })
}
function removeItemAll(arr, values) {
    let _outArray = [];
    for (let i of arr) {
        if (values.indexOf(i) === -1) {
            _outArray.push(i);
        }
    }
    return _outArray;
}
function findTwitterListKey(value, twitterlist) {
    for (let item of twitterlist)
        if (item.channelid == value || item.channelid_rt == value) return item.listid;
    return "";
}
function getIDfromText(message){
    const url = Array.from(getUrls(message, { exclude : ["https://t.co/"] }))
    return url.pop().toString().split(`/`).pop().toString()
}
function getURLfromText(message){
    return Array.from(getUrls(message, {exclude: ["https://t.co/"]}))
}
function getVideofromURL(message){
    const url = Array.from(getUrls(message))
    return '' + url[0].toString().split('=').pop().toString();
}
function fileSize(filename) {
    try {
        const stats = fs.statSync(filename);
        const fileSizeInBytes = stats["size"]
        return fileSizeInBytes / 1000000.0
    } catch (e) {
        console.error(`Failed to read ${filename}`)
        return 0
    }
}
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

function convertIDtoUnix(id) {
    /* Note: id has to be str */
    var bin = (+id).toString(2);
    var unixbin = '';
    var unix = '';
    var m = 64 - bin.length;
    unixbin = bin.substring(0, 42-m);
    unix = parseInt(unixbin, 2) + 1420070400000;
    return unix;
}
function msConversion(millis) {
    let sec = Math.floor(millis / 1000);
    let hrs = Math.floor(sec / 3600);
    sec -= hrs * 3600;
    let min = Math.floor(sec / 60);
    sec -= min * 60;

    sec = '' + sec;
    sec = ('00' + sec).substring(sec.length);

    if (hrs > 0) {
        min = '' + min;
        min = ('00' + min).substring(min.length);
        return hrs + ":" + min + ":" + sec;
    }
    else {
        return min + ":" + sec;
    }
}

module.exports = {
    clone,
    shuffle,
    filterItems,
    removeItemAll,
    findTwitterListKey,
    convertIDtoUnix,
    getIDfromText,
    getURLfromText,
    getVideofromURL,
    fileSize,
    asyncForEach,
    msConversion
};
