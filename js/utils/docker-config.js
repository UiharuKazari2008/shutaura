const fwConfig = require('../../fw-config.json');
const userConfig = require('../../user-config.json');

let frameworkConfig = {
    ...fwConfig,
    ...userConfig.framework
};

if (userConfig.external_url) {
    frameworkConfig.Base_URL = userConfig.external_url
}
