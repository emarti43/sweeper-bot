const Discord = require('discord.js');
const logger = require('debug')('logs');

const DEFAULT_DAY_LIMIT = 15;
let haltQueue = [];

let currentDate = new Date();
const client = new Discord.Client();


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeUser(userName) {
  await sleep(500);
  haltQueue = haltQueue.filter(name => name !== userName);
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

function checkDayDifference(currentDate, lastDateFetched, dayDifference) {
  return Math.round((currentDate.getTime() - lastDateFetched.getTime())/(1000*60*60*24)) <= dayDifference;
}

logger('Starting bot up. Ready to receive connections...');

async function deleteImages(targetChannel, targetUser, numberOfDays) {
  logger('%o Deleting images by %o', arguments.callee, targetUser.username);
  let deleteCount = 0;
  let params = { limit: 100 };
  let targetMessages;
  targetMessages = await targetChannel.fetchMessages(params);

  while (checkDayDifference(currentDate, targetMessages.last().createdAt, numberOfDays) && !haltQueue.includes(targetUser.username)) {
    try {
      params.before = targetMessages.last().id;
    } catch (error) {
      logger('%o Reached End of history', arguments.callee);
      return;
    }
    targetMessages = targetMessages.filter(m => m.author.id === targetUser.id && m.attachments.size > 0);
    deleteCount += targetMessages.array().length;
    targetMessages.deleteAll();
    logger('%o %o images deleted for %o (%o total)', arguments.callee, targetMessages.size, targetUser.username, deleteCount);
    targetMessages = await targetChannel.fetchMessages(params);
    await sleep(500);
  }
  await removeUser(targetUser.username);
  logger('%o Images deleted for %o %o', arguments.callee, targetUser.username, haltQueue.includes(targetUser.username) ? '(task stopped by user)' : '(task completed)');
  targetUser.send(`Hi ${targetUser.username}, I deleted ${deleteCount} images/attachments from the past ${numberOfDays} days. Please note that these are not all the images/attachments on the server itself.`);
}

client.on('message', message => {
  let args = message.content.split(' ');
  switch(args[0]) {
    case '!delete_images':
      if(args[2]) {
        attemptCommmand(deleteImages, [awfulChannelParse(args[1]), message.author, true, parseInt(args[2])]);
      } else {
        attemptCommmand(deleteImages, [awfulChannelParse(args[1]), message.author, true, DEFAULT_DAY_LIMIT]);
      }
      break;
    case '!stop':
      haltQueue.push(message.author.username);
      logger('Stopping deleting task for %o', message.author.username);
      break;
    default:
      break;
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
