require('dotenv').config();
const COMMAND_DESCRIPTIONS = require('./commandDescriptions.js');
const botHelper = require('./botHelper.js');
const logger = require('debug')('logs');

exports.showHelp = function(channel) {
    logger("showing help");
    let content = ''
    Object.keys(COMMAND_DESCRIPTIONS).forEach(commandName => {
        content += `\`${commandName}\` - ${COMMAND_DESCRIPTIONS[commandName]} \n`;
    });
    botHelper.MessageResponse(channel, content);
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