const botHelper = require('./../botHelper.js')

exports.addChannel = async function (channel, psqlHelper) {
  psqlHelper.addMonitoredChannel(channel.guild.id, channel.id);
}

exports.initialize = async function (message, psqlHelper, client) {
  const args = message.content.split(/\s+/);
  const parsedChannel = await botHelper.parseChannel(args[1], client);
  if (parsedChannel && message.member.hasPermission('ADMINISTRATOR')) {
    exports.addChannel(parsedChannel, psqlHelper);
    botHelper.scrapeImages(psqlHelper, message.channel);
  }
}