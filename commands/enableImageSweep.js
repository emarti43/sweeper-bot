const botHelper = require('./../botHelper.js');

exports.enableImageSweep =  async function (psqlHelper, userId, channelId) {
  psqlHelper.enableImageSweep(userId, channelId);
}

exports.initialize = async function (message, psqlHelper, client) {
  let args = message.content.split(/\s+/);
  const parsedChannel = await botHelper.parseChannel(args[1], client);
  if (parsedChannel) {
    botHelper.MessageResponse(message.channel, '🧹 Cleaning up your mess! 🧹');
    exports.enableImageSweep(psqlHelper, message.author.id, parsedChannel.id);
  } else botHelper.MessageResponse(message.channel, 'Please provide a channel to sweep');
}