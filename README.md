<img src="https://user-images.githubusercontent.com/15165770/176505424-2e88c783-7294-48d9-bb0d-ce8da8ae0302.png" width="512" /><br/>

---

# Kanmi Sequenzia Framework

The base framework for Sequenzia

Includes the following systems:
* Discord I/O
* FileWorker Upload and Download Client
* Sync and Backup System
* Kanmi CMS

## [Click here for simple Docker compose Installation](https://github.com/UiharuKazari2008/sequenzia-compose/)

## What is Kanmi / Sequenzia
A modular framework and ecosystem for image management and file storage using Discord as a Filesystem and CDN<br>

## Difference Sequenzia and Sequenzia II
Sequenzia II (This version) is a new system written from scratch in JavaScript on the following principles:
* Little to No Local Storage
  - Spanned Files are the only real storage requirements and can be adjusted to auto remove unused files
* Utilize Discord's "Free" CDN and Storage
  - Please pay for Nitro or something, dont be a mooch
* No local user handling for security
* Not be based on PHP
* Not be based on any previous Booru
* Not a Booru
* Easy to develop and manage
* Utilize the latest MySQL

## Terms, Names, and Language
Before you begin setting up Sequenzia, its important to understand terms that will be thrown around:<br/>
* Kanmi, Kanmi Framework, or Sequenzia Framework
  - The backend / data management side of Sequenzia
  - The stuff the users will never see
* Sequenzia / Sequenzia Web
  - The frontend to access images and files that are stored in the database
  - The stuff users see
* JuneFS
  - The filesystem and structured data that comprises all data stored in Kanmi
* Spanned Files
  - Packed and Unpacked Files that are over Discords file size limit and are segmented into 8MB pieces
  - These file can not be accessed directly via the Discord CDS and require a FileWorker and Sequenzia CDS, File share, or a Web server to use
* CDS - Sequenzia Content Distribution and Auditing System
  - Component of Sequenzia that is responsible for serving and auditing access to Unpacked Spanned Files
  - This data is stored and served from your side
* CMS - Kanmi Content Management System
  - A group of components and systems that are used to ingest data from sources such as Twitter, Pixiv, Flickr, RSS Feeds, Web Scrapers, etc.
  - A system within the Data Storage Servers to approve/decline incoming pending posts from Twitter, Pixiv, and Flickr
* ADS - Sequenzia Ambient Display System
  - System of application and APIs to provide a "digital picture frame" like system to see random images from Sequenzia
  - Created for system that contains so much data that images can get lost of forgot and will attempt to dig them out
* DWS - Dynamic Wallpaper Service or an extension of ADS
  - Software and API for dynamic wallpapers on desktops and mobile phones similar to the way ADS works
* AuthWare
  - The system responsible for all user management and logins

## Preparations
* Discord Account
* [Discord Developer Account](https://ptb.discord.com/developers/)
* Linux/Unix Operating system capable of running NodeJS
  - If you want to be cute and special then your on your own distro or choice...
  - There will only ever be support for Debian-like, FreeBSD, and Windows
* You have SSH access to the server(s)
* You have administrative access to your server
* You understand at least how to use Linux some what
* You have installed "MySQL Workbench" or another GUI tool on your workstation
  - There are parts of Sequenzia and Kanmi that still rely on manual Database entries.
  - MySQL WB is not a hard requirement but is what I will use for demonstrations, any tool that talks to MySQL will work
* A Valid publicly accessible domain name with valid SSL Certificate for access outside of home
  - Free Public Domain names - https://freedns.afraid.org/
  - Cheap Private Domain Names - https://www.namecheap.com/domains/
  - Free SSL Certificates - https://certbot.eff.org/

### Multi-Sever Deployments
If you are wanting a multi-server setup for performance, the following is needed:
* **Oracle MySQL Server with Global Transaction ID's Enabled** (Usually by default)
  - With some manual modifications to the database file you can use this with open source MySQL, but there will be no support active for MariaDB
* RabbitMQ AMQP Server for inner process communication and queueing
  - In production, we use FreeBSD for MySQL and RabbitMQ
* Graylog Server to store long term logging
  -Not required but without it you must capture the console logs
* Reverse Proxy Server like Nginx
* Shared Storage for storage between Sequenzia web servers
  - This can be as simple as a samba share mounted on all the servers

MySQL, RabbitMQ, and Graylog can be located on another host centralized host or spread out depending on your use case and resources.<br/>
You can run multiple Sequenzia Servers to distribute load, But you can not run multiple Discord I/O processes. (If you do, there is a risk of data loss or incomplete actions).<br/>

## System Requirements
* 4 CPU Cores
* 4 GB of RAM **MINIMUM**
* 32 GB of Storage
* Fast Low latency disk are required for MySQL Databases
  - **Hrd Drives are not recommended due to the excessive writes that can and will damage the disks over time**

## Installation
Please refer to the embedded Wiki page of this repo for all guides
