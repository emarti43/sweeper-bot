const botHelper = require('./../botHelper.js')
const logger = require('debug')('commands::addChannel');
exports.addChannel = async function (channel, psqlHelper) {
  psqlHelper.addMonitoredChannel(channel.guild.id, channel.id);
}

exports.initialize = async function (message, psqlHelper, client) {
  const args = message.content.split(/\s+/);
  const targetChannel = await botHelper.parseChannel(args[1], client);
  if (targetChannel && message.member.hasPermission('ADMINISTRATOR')) {
    try {
      exports.addChannel(targetChannel, psqlHelper);
      botHelper.MessageResponse(message.channel, `Added channel #${targetChannel.name}`);
    } catch (err) {
      logger("Could not add Channel");
      logger(`Input ${message.content}`);
      logger(err);
    }
    botHelper.scrapeImages(psqlHelper, message.channel);
  }
}