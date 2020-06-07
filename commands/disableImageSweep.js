const botHelper = require('./../botHelper.js');

exports.disableImageSweep =  async function (psqlHelper, userId, channelId) {
  psqlHelper.disableImageSweep(userId, channelId);
}

exports.initialize = async function (message, psqlHelper, client) {
  let args = message.content.split(/\s+/);
  let parsedChannel = await botHelper.parseChannel(args[1], client);
  if (parsedChannel) {
    botHelper.disableImageSweep(psqlHelper, message.author.id, parsedChannel.id);
  } else botHelper.MessageResponse(message.channel, 'Please provide a channel to disable sweeping');
}