const botHelper = require('./../botHelper.js')
const logger = require('debug')('commands::addChannel');
exports.addChannel = async function (channel, psqlHelper) {
  psqlHelper.addMonitoredChannel(channel.guild.id, channel.id);
}

exports.initialize = async function (message, psqlHelper, client) {
  const args = message.content.split(/\s+/);
  const parsedChannel = await botHelper.parseChannel(args[1], client);
  if (parsedChannel && message.member.hasPermission('ADMINISTRATOR')) {
    try {
      exports.addChannel(parsedChannel, psqlHelper);
      botHelper.MessageResponse(message.channel, `Added channel #${parsedChannel.name}`);
    } catch (err) {
      logger("Could not add Channnel");
      logger(`Input ${message.content}`);
      logger(err);
    }
    botHelper.scrapeImages(psqlHelper, message.channel);
  }
}