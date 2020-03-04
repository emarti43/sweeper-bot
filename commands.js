require('dotenv').config();
const COMMAND_DESCRIPTIONS = require('./commandDescriptions.js');
const botHelper = require('./botHelper.js');
const clientAddress = process.env.CLIENT_ADDRESS;
const axios = require('axios');
const logger = require('debug')('logs');

exports.showHelp = function(channel) {
    logger("showing help");
    let content = ''
    Object.keys(COMMAND_DESCRIPTIONS).forEach(commandName => {
        content += `\`${commandName}\` - ${COMMAND_DESCRIPTIONS[commandName]} \n`;
    });
    botHelper.MessageResponse(channel, content);
}

exports.serverStats = async function(psqlHelper, channel) {
    logger("Posting logging activity on client server")
    let response = await psqlHelper.getChannelActivity(channel.guild.id);
    response.forEach(element => {
        element.channels.forEach(channelLog => {
            let existingChannel = channel.guild.channels.get(channelLog.id);
            channelLog.name = existingChannel ? '#' + existingChannel.name : '#Deleted Channel';
        });
    });
    axios({
        method: 'post',
        url: `http://${clientAddress}/servers/logs/${channel.guild.id}`,
        data: {
            name: channel.guild.name,
            logs: response
        }
    }).then(response => {
        logger("Channel Activity successfully posted");
    }).catch(error => {
        logger(error);
    });
    botHelper.MessageResponse(channel, 'http://' + clientAddress + '/servers/' + channel.guild.id);
}

exports.showMonitoredChannels = async function (psqlHelper, channel) {
    logger("showing Monitored Channels");
    let server = await channel.guild;
    let channels = await psqlHelper.fetchChannels(server.id);
    if (channels.length > 0) {
        channel.send(await botHelper.formatChannels(channels));
    } else {
        channel.send('No channels are being tracked. Please use !add_channel to begin tracking a channel\'s history');
    }
}

exports.enableImageSweep =  async function (psqlHelper, userId, channelId) {
    psqlHelper.enableImageSweep(userId, channelId);
}

exports.disableImageSweep =  async function (psqlHelper, userId, channelId) {
    psqlHelper.disableImageSweep(userId, channelId);
}

// NOTE: targetUser must be of type User, not GuildMember or anything else
exports.purgeImages = async function (psqlHelper, targetUser, targetChannel) {
    logger('Purge initiated for %o', targetUser.username);
    try {
        var serverId = await targetChannel.guild.id;
        var response = await psqlHelper.fetchImages(targetUser.id, targetChannel.id, serverId);
    } catch (error) {
        logger(error);
    }

    let imageCount = 0;
    if (response.rows) {
        imageCount = response.rows.length;
        for (let i = 0; i < response.rows.length; i++) {
            try {
                var message = await targetChannel.fetchMessage(response.rows[i].message_id);
            } catch (err) {
                logger('fetched nonexistent key');
                psqlHelper.deleteImage(response.rows[i].message_id, targetChannel.id, serverId);
                continue;
            }
            if (message) {
                message.delete();
                logger('Deleting image for %o (%o out of %o).', targetUser.username, (i + 1), imageCount);
                psqlHelper.deleteImage(message.id, targetChannel.id, serverId);
            }
            await botHelper.sleep(1000);
        }
    }
    try {
        await psqlHelper.removeUserCheckpoint(targetUser.id, targetChannel.id);
    } catch (err) {
        logger('failed to remove checkpoint');
        logger(error);
    }
    targetUser.send(`Hi ${targetUser.username}. I've deleted ${imageCount} images from ${targetChannel.name}. Please check if any recent images you've uploaded are not deleted.`);
}