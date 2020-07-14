require('dotenv').config();
const botHelper = require('../botHelper.js');
const logger = require('debug')('commands::purgeImages');

async function purgeIsAlreadyQueued(psqlHelper, userId, channelId) {
  let response = await psqlHelper.getUserCheckpoint(userId, channelId);
  if (response.rows && response.rows.length > 0) return true;
  return false;
}

async function hasAdminPerms(message) {
  return message.guild.members.get(message.author.id).permissions.has('ADMINISTRATOR');
}

exports.startPurge = async function(targetUser, targetChannel, psqlHelper) {
  logger('Purge initiated for %o', targetUser.username);
  try {
      var serverId = await targetChannel.guild.id;
      var response = await psqlHelper.fetchImages(targetUser.id, targetChannel.id, serverId);
  } catch (error) {
      logger(error);
  }

  let imageCount = 0;
  if (response.rows) {
      imageCount = response.rows.length;
      for (let i = 0; i < response.rows.length; i++) {
          try {
              var message = await targetChannel.fetchMessage(response.rows[i].message_id);
          } catch (err) {
              logger('fetched nonexistent key');
              psqlHelper.deleteImage(response.rows[i].message_id, targetChannel.id, serverId);
              continue;
          }
          if (message) {
              message.delete();
              logger('Deleting image for %o (%o out of %o).', targetUser.username, (i + 1), imageCount);
              psqlHelper.deleteImage(message.id, targetChannel.id, serverId);
          }
          await botHelper.sleep(1000);
      }
  }
  try {
      await psqlHelper.removeUserCheckpoint(targetUser.id, targetChannel.id);
  } catch (err) {
      logger('failed to remove checkpoint');
      logger(error);
  }
  targetUser.send(
    `Hi ${targetUser.username}. I've deleted ${imageCount} images and links from ${targetChannel.name}.`
  );
}

exports.initialize = async function(message, psqlHelper, client) {
  if (process.env.NO_PURGES) {
    logger('Purge denied (NO_PURGES is active)');
    botHelper.MessageResponse(
      message.channel,
      'Purges are currently disabled ☠️, please try again some other time'
    );
    return;
  }
  let invoker = message.author;
  let isAdmin = await hasAdminPerms(message);
  let args = message.content.split(/\s+/);
  let targetUser = message.author;
  let targetChannel = botHelper.parseChannel(args[1], client);
  let startedByAdmin = false;

  if (!targetChannel && isAdmin) {
    targetChannel = botHelper.parseChannel(args[2], client);
    targetUser = message.guild.members.get(args[1].slice(3, args[1].length - 1));
    startedByAdmin = true;
  }

  if(!targetChannel) {
    botHelper.MessageResponse(
      message.channel,
      `Channel does not exist (Or I don't have permission to access it 😳).\nUsage:\n\`!purge_images #channel-name\`\n\`!purge_images @username #channel-name\` (for admins)`
    );
    return;
  }
  let canBePurged = await psqlHelper.isMonitoredChannel(
    targetChannel.id,
    targetChannel.guild.id
  );

  if (!canBePurged) {
    botHelper.MessageResponse(
      message.channel,
      `Images on #${targetChannel.name} cannot be purged. Please contact your moderator to make #${targetChannel.name} purgeable. Make them type this:\n\`!add_channel #${targetChannel.name}\``
    );
    return;
  }

  if (await purgeIsAlreadyQueued(psqlHelper, targetUser.id, targetChannel.id)) {
    botHelper.MessageResponse(message.channel, "I'm on it 😅 (purge is queued)");
    return;
  }

  psqlHelper.insertUserCheckpoint(targetUser.id, targetChannel.id);

  botHelper.MessageResponse(
    message.channel,
    `⏱ Starting Purge for ${targetChannel.name}. You will be messaged when the purge is done (hopefully) ⏱`
  );

  try {
    exports.startPurge(targetUser, targetChannel, psqlHelper);
  } catch (err) {
    logger('Could not complete Purge!\n', err);
    invoker.send(
      `Hi ${invoker.username}. ${startedByAdmin ? `The purge for ${targetUser.username}` : `Your purge` } has failed to finish 💀. Please message binko and ask him what went wrong 👺.`
    );
  }
}
