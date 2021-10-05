module.exports = {
    apps : [
        {
            name   : "AuthWare",
            namespace: "kanmi-0",
            script : "./js/authware.js",
            args   : "",
            instances: 1,
            wait_ready: true,
            autorestart: false,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Discord I/O",
            namespace: "kanmi-0",
            script : "./js/discord.js",
            args   : "",
            instances: 1,
            wait_ready: true,
            autorestart: false,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "FileWorker",
            namespace: "kanmi-1",
            script : "./js/fileworker.js",
            args   : "",
            instances: 1,
            wait_ready: true,
            autorestart: false,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ]
}