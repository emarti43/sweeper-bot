require('dotenv').config();
const botHelper = require('./botHelper.js');
const logger = require('debug')('logs');

function parseChannel(text) {
  try {
    return client.channels.get(text.split('#')[1].split('>')[0]);
  } catch(e) {
    logger(e.message);
    return undefined;
  }
}
// adds a purge checkpoint for a user:
// returns:
//          false if already added
//          true if new
async function newQueue(psqlHelper, userId, channelId) {
  let response = await psqlHelper.getUserCheckpoint(userId, channelId);
  if (response.rows && response.rows.length > 0) return false;
  psqlHelper.insertUserCheckpoint(userId, channelId);
  return true;
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
  targetUser.send(`Hi ${targetUser.username}. I've deleted ${imageCount} images from ${targetChannel.name}. Please check if any recent images you've uploaded are not deleted.`);
}

exports.purge = async function(message, psqlHelper) {
  if (process.env.NO_PURGES) {
    logger('Purge queued up for later (NO_PURGES)');
    botHelper.MessageResponse(message.channel, 'Purges are currently disabled, your purge will start when purges are enabled again');
  }
  logger('checking args for purge...');
  let args = message.content.split(/\s+/);
  let targetChannel = parseChannel(args[1]);
  if (targetChannel) {
    if (newQueue(psqlHelper, message.author.id, targetChannel.id)) {
      botHelper.MessageResponse(message.channel, '⏱ Starting Purge. You will be messaged when the purge is done (hopefully) ⏱');
      try {
        if (!process.env.NO_PURGES) exports.startPurge(message.author, targetChannel, psqlHelper);
      } catch (err) {
        console.error("Could not complete Purge!\n", err);
      }
    } else botHelper.MessageResponse(message.channel, "I'm on it 😅(Your Purge is queued)");
  } else {
    targetChannel = parseChannel(args[2]);
    let user = message.guild.members.get(args[1].slice(3, args[1].length - 1));
    if (message.guild.members.get(message.author.id).permissions.has('ADMINISTRATOR')) {
        if (targetChannel && newQueue(psqlHelper, user.id, targetChannel.id)) {
          botHelper.MessageResponse(message.channel, '⏱ Starting Purge. the user will be messaged when the purge is done (hopefully) ⏱');
          try {
            if (!process.env.NO_PURGES) exports.startPurge(user.user, targetChannel, psqlHelper);
          } catch (err) {
            console.error("Could not complete Purge!\n", err);
          }
        }
    }
  }
}