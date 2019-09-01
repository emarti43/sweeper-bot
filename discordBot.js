const Discord = require('discord.js');
const logger = require('debug')('logs');

const DEFAULT_DAY_LIMIT = 15;
let haltQueue = [];
let deletionQueue = [];

let currentDate = new Date();
const client = new Discord.Client();


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeUserFromQueues(userName) {
  await sleep(500);
  haltQueue = haltQueue.filter(name => name !== userName);
  deletionQueue = deletionQueue.filter(name => name !== userName);
}
async function asyncRemoveAttachments(message) {
  if (message.attachments.size > 0) {
    logger('awaiting delete');
    await sleep(1000*60*3);
    let channelName = message.channel.name;
    message.delete();
    logger('message has been deleted in %o', channelName);
  }
}

function awfulChannelParse(text) {
  try {
    return client.channels.get(text.split('#')[1].split('>')[0]);
  } catch(e) {
    logger(e.message);
  }
}

function attemptCommmand(caller, args) {
  try {
    caller(...args);
  } catch(e) {
    logger('%o from %o',e.message, caller.name);
  }
}

function reachedPostLimit(currentDate, lastDateFetched, maxDays, username) {
  let currentDays = Math.round((currentDate.getTime() - lastDateFetched.getTime())/(1000*60*60*24));
  logger('%o days and counting %o', currentDays, username);
  return currentDays <= maxDays;
}

logger('Starting bot up. Ready to receive connections...');

async function deleteImages(targetChannel, targetUser, numberOfDays) {
  logger(haltQueue.in);
  logger('%o Deleting images by %o', arguments.callee, targetUser.username);
  deletionQueue.push(targetUser.username);
  let deleteCount = 0;
  let params = { limit: 100 };
  let targetMessages = await targetChannel.fetchMessages(params);

  while (reachedPostLimit(currentDate, targetMessages.last().createdAt, numberOfDays, targetUser.username) && !haltQueue.includes(targetUser.username)) {
    try {
      params.before = targetMessages.last().id;
    } catch (error) {
      logger(`${arguments.callee} Reached End of history`);
      return;
    }
    targetMessages = targetMessages.filter(m => m.author.id === targetUser.id && m.attachments.size > 0);
    deleteCount += targetMessages.array().length;
    targetMessages.deleteAll();
    logger('%o %o images deleted for %o (%o total)',
            arguments.callee,
            targetMessages.size,
            targetUser.username,
            deleteCount
          );
    targetMessages = await targetChannel.fetchMessages(params);
    await sleep(500);
  }
  logger('%o Images deleted for %o %o',
          arguments.callee,
          targetUser.username,
          haltQueue.includes(targetUser.username) ? '(task stopped by user)' : '(task completed)'
        );
  await removeUserFromQueues(targetUser.username);
  targetUser.send(`Hi ${targetUser.username}, I deleted ${deleteCount} images/attachments from the past ${numberOfDays} days. Please note that these are not all the images/attachments on the server itself.`);
}

client.on('message', message => {
  let args = message.content.split(' ');
  switch(args[0]) {
    case '!delete_images':
      if(args[2]) {
        attemptCommmand(deleteImages, [awfulChannelParse(args[1]), message.author, parseInt(args[2])]);
      } else {
        attemptCommmand(deleteImages, [awfulChannelParse(args[1]), message.author, DEFAULT_DAY_LIMIT]);
      }
      break;
    case '!stop':
      if (deletionQueue.includes(message.author.username)) {
        haltQueue.push(message.author.username);
        deletionQueue = deletionQueue.filter(element => element !== message.author.username);
        logger('Stopping delete_images task for %o', message.author.username);
      }
      break;
    case '!purge_images':
      attemptCommmand(deleteImages, [awfulChannelParse(args[1]), message.author, 4000]);
      break;
    default:
      asyncRemoveAttachments(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
