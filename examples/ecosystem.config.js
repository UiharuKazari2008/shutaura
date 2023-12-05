module.exports = {
    apps : [
        {
            name   : "AuthWare",
            namespace: "june-core",
            script : "./js/authware.js",
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 300000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Discord I/O",
            namespace: "june-core",
            script : "./js/discord.js",
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 300000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "FileWorker",
            namespace: "june-dps",
            script : "./js/fileworker.js",
            cron_restart: '16 3 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 300000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Twitter",
            namespace: "june-cms",
            script : "./js/twitter.js",
            cron_restart: '16 3 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 300000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Pixiv",
            namespace: "june-cms",
            script : "./js/pixiv.js",
            cron_restart: '16 3 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Feed Parser",
            namespace: "june-cms",
            script : "./js/feed.js",
            cron_restart: '16 3 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Web Parser",
            namespace: "june-cms",
            script : "./js/webCrawer.js",
            cron_restart: '16 3 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "CDN Sync",
            namespace: "june-dps",
            script : "./js/cache.js",
            cron_restart: '0 5 * * *',
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name   : "Updater",
            namespace: "june-mon",
            script : "./js/updater.js",
            stop_exit_codes: [0],
            restart_delay: 5000,
            kill_timeout : 3000,
            exp_backoff_restart_delay: 100,
            wait_ready: true,
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ]
}
