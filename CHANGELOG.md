# Kanmi Sequenzia Framework

## v19.2.1 (RC1 JFS v1.5)
- Fixed various small issues with FileWorker
- Twitter/Discord will now report its current flow controller mode and report if the controller is mismatched to its current state
  - These will be registered as faults
- Discord requires seq.common settings to report completed file access URLs
- Fixed various FFMPEG errors with image preview and video previews
- Fixed new content notifiactions from discord and added support for multiple channels using " " delimiter
- FileWorker has default encoder configuration instead of requiring the lines in config
- Pixiv/Twitter now has chains in place to force itms to download in order and prevent async downloads and memory leaks
- Fixed Image rotation dead locking discord


## v19.2 (RC1 JFS v1.5)
- Updater
  - Accept cli arguments to allow for manual updates
  - Useing exec insted of Spawn due to situation where it will lock up
- Twitter
  - Added support to adjust flowcontrol defaults and such via config
  - Added Option for Under/Over flow schedules insted of releaseing multiple at a time 
- Discord
  - Now uses twitter provided flowcontrol values instead of the defaults
  - Dropped spanned file building support as fileworker can handle it directly now
  - Now handles cache requests
- FileWorker
  - Updated to support direct requests
  - Fixed various issues with file building
  - systemglobal.Base_URL is now used for base URL as /stream handles all file requests
  - Now automatically recreates missing symlinks

### Updater Command Line Options
**Do not use this as a way to automatically update, use the built-in service in the ecosystem**
```shell
node js/updater.js --check --install --force
```
- check
  - Checks for updates (Required at all times otherwise it will launch in service mode)
- install
  - Installs the latest updates
- force
  - Forces Install, Patching, Bypass Update Block Check, 
- soft
  - Do not use `git reset --hard`
- nopatch
  - Do not install patch files for database and configuration updates
- nobackup
  - Do not backup the affected database tables (Only use this if you failed to install an update, to be safe then sorry) 

## v19.1 (RC1 JFS v1.5)
- Corrected issue with Backup system where it could not get the Discord MQ parameters from SQL
- Added new TX2 triggers
- Cleaned up and removed unneeded NPM packages
- Added graceful shutdown to Discord I/O, restart attempts are now postpoonded if there are any active tasks or requests. Message Queues are "frozen" with sleep timers to prevent new messages from being processed but allowing existing messages to completd
- Added Automatic updater (also support any surrounding git project) that can automatically download and apply the latest updates to your server without the need for intervention.
  - By default it will only check for updates but you can enable automatic install and restarts to affected modules. 
  - You can also set the names of apps to not restart if updated
  - See the config update below for options.
- Automatic Update will automatically apply SQL updates deemed to be safe enough
- Automatic Updates will back up the database of tables that could be damaged
  - Backups are placed in "backups/"
- Automatic updates will now use commit messages to signal actions such as stopping all services before X stage of database updates or force restart
- Automatic Updates will now allow for blocked updates to force manual update when needed
- Added new "update" command to discord console to request system updates from discord
- Added new "restart" command to discord console to allow remote restarts of discord without the need to login to console
- Updated example ecosystem to no longer restart discord or authware as its not needed anymore, added updater to the ecosystem
- Preparing to implement "NFC-RPC" for same-host applications to send messages within the system bus and without the need for MQing
- Corrected small issue with Undelivered messages counter not working due to a bad variable name.
- Fixed handeling of Color values to prevent asking sequenzia to cache color
- Caches total number of parts for files to remove the requirement of discord to validate the total number of parts expected 
- Twitter CMS is now able to handle **multiple accounts as once**, simple use the new Twitter_Accounts config option or update your database values
- Decoupled status channels from status data so that the insights page can get associated data without the need to register a voice channel as a status update
- Updates ecosystem.config.js
- Added ability to set MQ prefetch values
- Removed command MQs
- Added ability to delete stored status values via console
- Added indicated if a disk status value has not been updated in over 4 hours
- Fixed issue where backup indicator would not show what host it applied to
- Backup count alerts are doubled for parts
- Fixed Flickr API not working

## Required SQL Update
- Added total spanned parts to records table to remove the need to use Discord to validate spanned files before download
- Removes file path for backups as it's not needed
```mysql
alter table kanmi_records add paritycount int null after real_filename;
alter table kanmi_records add filecached tinyint default 0 not null after attachment_extra;
alter table kanmi_records drop column cache_url;
alter table kanmi_records drop column cache_extra;

alter table kanmi_backups drop column path;

alter table discord_multipart_backups drop column path;

alter table kanmi_channels alter column autofetch set default 0;
```
## Required SQL Patch
- Caches the total number of parts expected for a file
  - If the value is NULL there will be no validation of if all parts were assembled
```shell
node ./patch/17_1-001.js
```

## v19 (RC1 JFS v1.5)
### Important Notes
This update requires the usage of the included update-databse.js script, this will convert URLs to Hash values in the database. This must be done before applying the secound part of the SQL database updates. Failure to follow this order will result in all data in the database losing the file records and will require a full database repair from the Discord console. You dont want to wait for that so do the right thing and read...
### Amendments to Framework Role in Kanmi Storage Servers
__This is not a requirement but is suggested depending your security stance.__<br>

Its recommended that you create a new role called "Framework (Read-Only)" to all storage servers.
Assign "View Channel". "Read Message History". for all channels that framework has rights to. Assign the same rights as Framework to the new read only role to the System Status parent where logging and notification channels are.

Move Authware and Maintenance (used by Backup system)  to Read-Only and remove Framework

With the new threads system ensure that Framework has rights to "Send messages in threads", "Manage Threads", "Create new Threads"

### Change Log
Severity: **Critical**<br>
**This backup will not incude the new Sync system that replaces Backup I/O, the backup system will still work as normal**<br>
**Please refer to the Wiki for config-options to verify your confiurations values and keys**<br>
**Please upgrade your NPM packages with npm upgrade to fix various bugs in Eris and Thread Management**<br>
- New JuneFS Standard Version 1.5
- webcrawler.json is now removed
- Legacy API has been completely removed, Use Webhooks now
- Fixed fall through condition for Pixiv CMS to Twitter where threads parents were not checked if they were NSFW as threads do not contain this property. Causing it to fall trough and send NSFW posts into the outbox of the primary account
- Fixed a issue on messageUpdate where it assumed that there was going to be content
- Corrected santax that caused all Move requests to be sent to the fileworker
- Corrected issue where remote move requests would lock up queue due to no callback
- Fixed issue where Twitter flow control was permanently locked out if not in a overflow condition (Test error)
- Updated ecosystem file for PM2
- Replaced yeild with async/await for Pixiv CMS
- Moved Pixiv recommended illustrations from Node Persistent to SQL
- Added 2 new queues for packed/message arrays, this is a group of messages that will be sent as one instead of clogging the main queues
- Twitter and Pixiv has been migrated to sending messages as message arrays instead of individual messages
- Added juzo jfs rlch command (Relocate Channel) to move all messages from one channel to another channel
  Has 2 modes db or deep, db will use data stored in the database and deep will pull the contents of the channel from discord to move them (this is not recommended for large channels)
- Now can properly move spanned files cross-server boundaries. Parts are moved along with message records
- Updated remote status system to support sending data objects for extended status information that can be displayed by the Status embed
- Status Embed (Insight Status) now will set its color to yellow or red if it detects a warning or fault that you should know about
- Added MQ backed undelivered Queue, If you have a deliverable channel setup it will send messages here only if it was not able to send it there, else if you do not use that feature it will be sent there. This is a absolute last resort to prevent messages from dropping. You have to manually use a shovel to move the data back to discord MQ
- Added a retry for adding message reactions, Max 3 times
- Fixed issue where posts from Twitter or Pixiv that did not have there attachments connect to the embed could not be approved
- Watchdog system has had MQ support removed so prevent watchdog from becoming unavailable if the MQ fails
- A lot of code is not Async/Await
- Added Thread Management for CMS Threads, Will auto unarchive threads, mark completed threads that are terminated, delete old threads past a threshold, exclude unarching channels by search text
- Pixiv supports Unified threads and channels and uses color encoding to set the image type (same as twitter does for listid)
- Removed embedded image preview generation now that Discord Media CDN can do all that for free
- Accept Video Preview Images only for embedded t9 cache
- Unified all Message Create and Update proccess to ensure no future feature miss match and all database write are done the same between all proccesses
- Added support to repair parity cache by "jfs repair parts"
- Added storeage of extended status update data that will be stored in the database to enhance the results on the Insights embed in discord
- Extended Status Updates data is cached in discord and is writen to the database every 3 minutes to prevent flooding of this non critical data
- Added Active Alarms and Warnings to Insights
- Added Active Jobs and Pending Jobs to insights display
- Discord and AuthWare no longer need daily reboots
- Added Undelivered MQ for failed messages even if no undelivered channel is set or failed to send to that channel
- No longer will use typing as a method of verifying channel access. For now this is removed permanently as messages with incorrect channels are redirected to failed MQ
- Pixiv with new create new threads for "Expand Search", Download User, Download Recommended to Post, etc.
- Twitter now can download entire users tweets (up to 3200) and media only
- Twitter will create new threads when downloading a users tweets
- Added option for adding "FORCE" to the end of a download request in download channel this will allow downloading duplicate items
- Twitter adds time of day that the message was ingested to aid in knowing your place in a timeline
- Better handling of message parts for FileWorker, needed to use Async/Await to ensure messages are sent sync
- Added support to allow for 2-Factor login support for Account elevation in Authware for better security and to prevent client side attacks
- Added database application configuration as well as config.json values, database values are refreshed on a interval. Please refer to the wiki for updates to configuration names and values
- Backup tracking is now in a seperate table
- Message attachemnts are now hashed and no longer use full discord URLs as its not needed
- Insighs now shows backup status and waiting items per host as well as if host has not checked in recently
- Added support to allow webhook users to be considers normal users to allow for messages sent by them to be imported into the database for remote uploads and such
- Added Alarm clocks to Discord that will send messages and mention a user (if set) they will also be shown in the Insight display
- Pixiv can now get posts recommended to a specifed URL when sent into downloads channel with " RECOM" added to the end
- Twitter has now dropped support for Node persistent is will now just store uploads as normal files, this is due to the unreliability of node-persistant
- Reducing the amount of times that discord is called to retrive data that is possibly stored in the Eris cache.
- LOTS OF CLEAN UP

### SQL Updates (Part 1)
- Creates Extended Status Data storeage
- Creates new storage for recommended posts for Pixiv
- Updates Pixiv and Twitter Account systems to match new requirements
- Added Podcast episode title storeage in the case that the URL is changed
- Addes 2-Factor login for AuthWare elevation
- Addes Class and Channel URL overides for Sequenzia
- Added option to hide ambient display from history view in gallery
- Added support to automaticly download illustrations from a user on Pixiv
- Added new global parameters table
- Added new backup tracking table
- Added is valid tracking for parity files so that discord can revalidate the files
- Added new Discord Alarms table
- Allows listid to be null for previouly downloaded tweets
- Addes new attachemnt hash storage

```mysql
CREATE TABLE `discord_status_records` (
  `name` varchar(128) NOT NULL,
  `data` json NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `pixiv_recomm_illu` (
  `paccount` int NOT NULL DEFAULT '0',
  `id` varchar(128) NOT NULL,
  `user` varchar(128) NOT NULL,
  `data` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
DROP TABLE IF EXISTS `pixiv_accounts`;
DROP TABLE IF EXISTS `twitter_list`;
CREATE TABLE `pixiv_accounts` (
  `paccount` int NOT NULL,
  `feed_channelid` varchar(128) NOT NULL,
  `feed_channelid_nsfw` varchar(128) DEFAULT NULL,
  `recom_channelid` varchar(128) DEFAULT NULL,
  `recom_channelid_nsfw` varchar(128) DEFAULT NULL,
  `save_channelid` varchar(128) NOT NULL,
  `save_channelid_nsfw` varchar(128) NOT NULL,
  `download_channelid` varchar(128) NOT NULL,
  `like_taccount` int DEFAULT NULL,
  `like_taccount_nsfw` int DEFAULT NULL,
  `authtoken` varchar(128) DEFAULT NULL,
  `refreshtoken` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`paccount`),
  UNIQUE KEY `paccount_UNIQUE` (`paccount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `twitter_list` (
  `id` int NOT NULL,
  `listid` varchar(128) NOT NULL DEFAULT '0',
  `taccount` int NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '0',
  `channelid` varchar(128) DEFAULT '0',
  `channelid_rt` varchar(128) DEFAULT NULL,
  `saveid` varchar(128) NOT NULL DEFAULT '0',
  `textallowed` tinyint(1) NOT NULL DEFAULT '1',
  `getretweets` tinyint(1) NOT NULL DEFAULT '1',
  `nsfw` tinyint(1) NOT NULL DEFAULT '0',
  `replyenabled` tinyint(1) DEFAULT '1',
  `blockselfrt` tinyint(1) DEFAULT '0',
  `mergelike` tinyint(1) DEFAULT '0',
  `disablelike` tinyint(1) DEFAULT '0',
  `autolike` tinyint(1) DEFAULT '0',
  `bypasscds` tinyint(1) DEFAULT '0',
  `flowcontrol` tinyint(1) DEFAULT '0',
  `redirect_taccount` int DEFAULT '1',
  `active_thread` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `twitter_list_id_uindex` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE `twitter_accounts` add `name` text;
alter table `twitter_accounts` modify `activity_userid` varchar(128) DEFAULT NULL;

ALTER TABLE `podcast_history` ADD `thash` text;
ALTER TABLE `discord_users` ADD `2fa_key` varchar(128) DEFAULT NULL;
ALTER TABLE `discord_users` ADD `nice_name` text;
ALTER TABLE `sequenzia_class` ADD `uri` varchar(64) DEFAULT NULL;
ALTER TABLE `kanmi_channels` ADD `uri` varchar(64) DEFAULT NULL;
ALTER TABLE `kanmi_virtual_channels` ADD `uri` varchar(64) DEFAULT NULL;
ALTER TABLE `sequenzia_display_config` ADD `showHistory` tinyint(1) NOT NULL DEFAULT '1';
create table pixiv_autodownload
(
    user_id varchar(128) not null,
    channelid varchar(128) null,
    constraint pixiv_autodownload_pk
        primary key (user_id)
);
create table global_parameters
(
    system_name varchar(128) null,
    application varchar(128) null,
    account int null,
    serverid int null,
    param_key varchar(128) not null,
    param_value text null,
    param_data json null
);
create table kanmi_backups
(
    bid varchar(156) not null,
    eid int not null,
    path text not null,
    system_name varchar(128) not null
);

create unique index kanmi_backups_bid_uindex
    on kanmi_backups (bid);

alter table kanmi_backups
    add constraint kanmi_backups_pk
        primary key (bid);
create table discord_multipart_backups
(
  bid varchar(156) not null,
  messageid varchar(128) not null,
  path text not null,
  system_name varchar(128) not null
);

create unique index discord_multipart_backups_bid_uindex
  on discord_multipart_backups (bid);

alter table discord_multipart_backups
  add constraint discord_multipart_backups_pk
    primary key (bid);
alter table discord_multipart_files drop column backup;

alter table discord_multipart_files
  add valid tinyint(1) default 1 not null;
create table discord_alarms
(
  id int,
  channel varchar(128) null,
  schedule varchar(128) not null,
  mention varchar(128) null,
  text text null,
  snoozeable int null,
  expires int null
);

create unique index discord_alarms_id_uindex
  on discord_alarms (id);

alter table discord_alarms
  add constraint discord_alarms_pk
    primary key (id);

alter table discord_alarms modify id int auto_increment;
alter table kanmi_records
  add attachment_hash varchar(512) null after attachment_url;
alter table twitter_history_inbound modify listid varchar(128) null;
```
### Database Transformation Script
**This can be applied live (You have to run it again if any files are uploaded during the proccess) but the part 2 operation to remove the old columns must be done with ALL SYSTEMS THAT TOUCH KANMI TO BE SHUTDOWN**

- Extract and convert attachment urls to hashs
- Correct incorrect filenames to their actual name according to the hash (this filename is very important now due to discord being case-sensitive!)<br>

This will save space in the database and decrease backup sizes. As well as storing attachment urls are a waste as they all contain similar information and all you need is the hash<br>

```shell
cd ~/kanmi
wget https://code.acr.moe/kazari/sequenzia-framework/-/raw/57fb4f50296f7469bf0e8b693a67a56a20f24795/patch/17-001.js
node ./17-001.js
```
Please run one more time after running to ensure that everything is done correctly

### SQL Updates (Part 2)
**Theses should ONLY be applied after you have ran the updates database script! Its also a good idea to backup your database first**<br>
**After applying this update Sequenzia has to be updated or no images will be returned**<br>

You must also update **and shutdown** the following before applying:
- Discord I/O
- FileWorker
- Backup or Sync
- Sequenzia
- Honey for Sequenzia
```mysql
alter table kanmi_records drop column attachment_url;
alter table kanmi_records drop column attachment_proxy;
alter table kanmi_records drop column pinned;
alter table kanmi_records drop column tags;
alter table kanmi_records drop column backup;
```

## v18 (RC1 JFS v1.4)
Severity: **Medium**
- Added support for recycling bin, this is a channel that any undeliverable message will be sent to.
  To setup, Create `system-undeliverable` channel under `System Data` parent. Set `Discord_Recycling_Bin` in your config file to the channel id
- No longer will drop messages that fail to access channel if recycling bin is setup, they will only be dropped if it failed to write to the bin
- Added config option to rate limit the ingress of jobs with the active request handler limits. ELIF: Only send data as fast as discord is willing to accept it, wait for previous actions to complete before closing ticket (This could fix segmentation faults on Raspberry Pi)
- Added `juzo status` command that will print out system internals status and for the message queue
- FileWorker now generates video preview images for uploaded videos
- Discord can now generate video previews for files if preview video is both directly accessable from discord or using spanned file inspection (using a part of file attempt to generate the thumbnail), if either fail the task is sent to the FileWork where compiled files can be checked
- Discord no longer needs messageType in messages, it will now determin the message type and contents from the fields
- JuneFS Repair command has been re-added and updated to support both embedded preview images and polyfills
- Discord can now move files larger then 8MB using the FileWorker for assistance

## v17 Patch 1 (RC1 JFS v1.4)
Severity: Low (Non Critical Update but recommended)
- Updated FileWorker to handle GIF images and bypass resize operation if under 12MB
- AuthWare will now delete your elevate command if 2FA was used

## v17 (RC1 JFS v1.4)
Severity: Low
** REQUIRES `npm install` to install 2fa package for authware**
- Updated discord to use newer MySQL aync/await query on startup, this allows on the fly updates to SQL cache without restarting the bot. More parts will be updated later over time.
- Fixes various issues with Thread Manager
- User account elevation requires the user to be registered into AuthWare due to requirement to check if 2FA is enabled
- Added 2FA code requirement when using `!authware sudo` to elevate user account, use `!authware 2fa` setup to generate a qr code. Its suggest that you use this feature to prevent client hijack attacks. To disable you must NULL the 2fa_key field, it can not be done from the console for obvious security reasons
- Pixiv now uses color encoding to specify source and data type. Just like twitter
- Now updates status to indicate request handlers queue depth so you know if there are pending actions
- Will now NOT RESTART immediately on uncaught exception, will require the request queue to empty first to ensure all tasks are completed
- Fixed Pixiv like sending to wrong twitter account, now disabled until proper fix can be found
- Added "DeleteThread" emoji support to delete thread, this emoji will be added to a final message that added to a thread before its cycled to allow for deleting of threads without elevation, Requires interact permission
- Various other fixes

## v16 (RC1 JFS v1.4)
Severity: Low
- Added automatic thread management and creation
- Added automatic time codes to thread switch over
- Added Server ID support for reactions
- Pixiv will now get its config on each pull cycle to make sure its using the correct channels on update
- Fixed issue were Pixiv interactions would not be sent from the correct twitter account due to lack of data
- Prints unregistered emojis on emoji changes

## v15 (RC1 JFS v1.4)
Severity: Critical
- Added User Agents and other headers to requests to all external download requests

This update updates almost all components and should be applied as soon as possible. If not applied there is a risk of downloading or uploading of empty data

## v14 (RC1 JFS v1.4)
Severity: Low
- Added support to handle incoming messages from Websocket Bots

## v13 (RC1 JFS v1.4)
Severity: High
- Corrected possible issue where priority files can get missed when using very high speed storage and the process stream will loose track of messages. To combat this, the processor will now search for files after completed splitting
- Removed API.js, use webhooks or RabbitMQ HTTP API to send remote messages

## v12 (RC1 JFS v1.4)
Severity: Low
Addresses crash when new messages from websocket bots are received. For now those messages will be ignored

## v11 (RC1 JFS v1.4)
Severity: Low
- Added support to disable fetch on channels with autofetch set to 0

## v10 (RC1 JFS v1.4)
Severity: Low
- Updated FileWorker to use a new cross-compatible Parity generator. This new system used native linux file splitting for much faster and efficient splitting of files
- Correct incorrect file name being written for spanned files that are images due to file size being overwrithen by the size of the preview
- Corrects issue where filename will always be prefixed with a undercore

## v9 (RC1 JFS v1.4)

## v8 (RC1 JFS v1.4)

## v7 (RC1 JFS v1.4)
Severity: Low
- Addresses various record keeping issues when managing data between servers
- Added catch to a function in fileworker to log issues that may occur and are not caught by the normal systems
- Other small fixes

## v6 (RC1 JFS v1.4)
Update 6 for Kanmi Framework
**Gateway Version has been bumped to v9!! This mean you must update the npm packages**
```
rm -rf node_modules/eris/
npm install
```
- Fixed download filenames being download.ext
- Added support for handling events that happened threads
- Now using v9 Gateway (Expreimental and still in development only use v9 versions if you want the latest features and to get off the old v6 gateway)
- Added new color encoding to embeds where the color value is shifted slightly to denote twitter list it belongs to

