const logger = require('debug')('commands::showMonitoredChannels');

exports.execute = async function (psqlHelper, channel) {
  logger("showing Monitored Channels");
  let server = await channel.guild;
  let channels = await psqlHelper.fetchChannels(server.id);
  if (channels.length > 0) {
      channel.send(await botHelper.formatChannels(channels));
  } else {
      channel.send('No channels are being tracked. Please use !add_channel to begin tracking a channel\'s history');
  }
}