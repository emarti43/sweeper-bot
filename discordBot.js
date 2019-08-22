const Discord = require('discord.js');
let logger = require('debug')('Bot');
const client = new Discord.Client();

const PAGE_DEPTH = 1000;
let currentDate = new Date();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function awfulChannelParse(text) {
  try {
    return text.split('#')[1].split('>')[0]
  } catch(e) {
    logger(e.message);
  }
}

function attemptCommmand(caller, args) {
  try {
    caller(...args);
  } catch(e) {
    logger(e.message);
  }
}

logger('Starting bot up. Ready to receive connections...');

async function deleteImages(targetChannel, targetUser) {
  logger('%o Deleting images by %o', arguments.callee, targetUser.username);
  let deleteCount = 0;
  let params = { limit: 100 };
  let targetMessages;
  targetMessages = await targetChannel.fetchMessages(params);

  while (Math.round((currentDate.getTime() - targetMessages.last().createdAt.getTime())/(1000*60*60*24)) <= 15) {
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
  logger('%o Images deleted for %o', arguments.callee, targetUser.username);
  targetUser.send(`Hi ${targetUser.username}, I deleted ${deleteCount} images/attachments from your history. Please note that these are not all the images/attachments on the server itself.`);
}

client.on('message', message => {
  let args = message.content.split(' ');
  switch(args[0]) {
    case '!delete_images':
      attemptCommmand(deleteImages, [client.channels.get(awfulChannelParse(args[1])), message.author, true]);
      break;
    default:
      break;
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
