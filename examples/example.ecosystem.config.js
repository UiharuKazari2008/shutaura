module.exports = {
    apps : [
        {
            name   : "AuthWare",
            namespace: "kanmi-0",
            script : "./js/authware.js",
            args   : "",
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
            name   : "Discord I/O",
            namespace: "kanmi-0",
            script : "./js/discord.js",
            args   : "",
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
            name   : "FileWorker",
            namespace: "kanmi-1",
            script : "./js/fileworker.js",
            args   : "",
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
            name   : "Twitter",
            namespace: "kanmi-2",
            script : "./js/twitter.js",
            args   : "",
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
            name   : "Pixiv",
            namespace: "kanmi-2",
            script : "./js/pixiv.js",
            args   : "",
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
            namespace: "kanmi-3",
            script : "./js/feed.js",
            args   : "",
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
            namespace: "kanmi-3",
            script : "./js/webCrawer.js",
            args   : "",
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
            name   : "Backup I/O",
            namespace: "kanmi-4",
            script : "./js/backup.js",
            args   : "",
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
        }
    ]
}