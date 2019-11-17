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

exports.showChannelActivity = async function(psqlHelper, channel) {
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
        logger(response);
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
