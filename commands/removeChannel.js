const logger = require('debug')('commands::removeChannel');
const botHelper = require('./../botHelper.js');

exports.initialize = async function (message, psqlHelper, client) {
   const args = message.content.split(/\s+/);
   const targetChannel = await botHelper.parseChannel(args[1], client);
   if (targetChannel && message.member.hasPermission('ADMINISTRATOR')) {
      try {
         psqlHelper.removeMonitoredChannel(targetChannel.id, channel.guild.id);
      } catch (err) {
         logger("Could not remove Channel");
         logger(`Input ${message.content}`);
         logger(err);
      }
   }
}