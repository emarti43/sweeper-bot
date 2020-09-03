const logger = require('debug')('commands::removeChannel');
const botHelper = require('./../botHelper.js');

exports.initialize = async function (message, psqlHelper, client) {
   const args = message.content.split(/\s+/);
   const targetChannel = await botHelper.parseChannel(args[1], client);
   if (targetChannel && message.member.hasPermission('ADMINISTRATOR')) {
      try {
         psqlHelper.removeMonitoredChannel(targetChannel.id, targetChannel.guild.id);
         botHelper.MessageResponse(message.channel, `Removed channel #${targetChannel.name}`);
         logger(`Removed channel #${targetChannel.name}`);
      } catch (err) {
         logger("Could not remove Channel");
         logger(`Input ${message.content}`);
         logger(err);
      }
   }
}