const Discord = require('discord.js');
const logger = require('debug')('logs');
const  { Pool, Client } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});


const DEFAULT_DAY_LIMIT = 15;
let haltQueue = [];
let deletionQueue = [];

let currentDate = new Date();
const client = new Discord.Client();


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTimestampDate() {
  let currentdate = new Date();
  return "Time: " + currentdate.getDate() + "/"
              + (currentdate.getMonth()+1)  + "/"
              + currentdate.getFullYear() + " @ "
              + currentdate.getHours() + ":"
              + currentdate.getMinutes() + ":"
              + currentdate.getSeconds();
}

async function removeUserFromQueues(userName) {
  await sleep(500);
  haltQueue = haltQueue.filter(name => name !== userName);
  deletionQueue = deletionQueue.filter(name => name !== userName);
}

async function isValidChannel(message) {
  try {
    var res = await pool.query('SELECT channel_id FROM allowedchannels;');
  } catch(err) {
    console.log(err);
  }
  for(let i = 0; i < res.rows.length; i++) {
    if (res.rows[i].channel_id === message.channel.id) return true;
  }
  return false;
}

async function getCheckpoint(user, channel_id) {
  try {
    var res = await pool.query('SELECT last_checkpoint FROM checkpoints WHERE user_id = $1 AND channel_id = $2;', [user.id, channel_id]);
  } catch(err) {
    console.log(err);
  }
  return res.rows.length > 0 ? res.rows[0].last_checkpoint: undefined;
}

async function updateCheckpoint(user, message_id, channel_id) {
  try{
    var res = await pool.query('INSERT INTO checkpoints(user_id, last_checkpoint, channel_id) VALUES($1, $2, $3) ON CONFLICT (user_id, channel_id) DO UPDATE SET last_checkpoint = EXCLUDED.last_checkpoint;', [user.id, message_id, channel_id]);
  } catch (err) {
    console.log(err);
  }
}

async function asyncRemoveAttachments(message) {
  let isValid = await isValidChannel(message);
  if (message.attachments.size > 0 && isValid) {
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
  params.before = await getCheckpoint(targetUser, targetChannel.id);
  console.log(params);
  let targetMessages = await targetChannel.fetchMessages(params);
  if(!targetMessages.last()) {
    logger(`Reached End of history for %o`, targetUser.username);
    return;
  }

  while (reachedPostLimit(currentDate, targetMessages.last().createdAt, numberOfDays, targetUser.username) && !haltQueue.includes(targetUser.username)) {
    try {
      params.before = targetMessages.last().id;
      updateCheckpoint(targetUser, params.before, targetChannel.id);
    } catch (error) {
      logger(`${arguments.callee} Reached End of history`);
      return;
    }
    targetMessages = targetMessages.filter(m => m.author.id === targetUser.id && m.attachments.size > 0);
    deleteCount += targetMessages.array().length;
    targetMessages.deleteAll();
    let datetime = getTimestampDate();
    logger('%o %o %o images deleted for %o in %o (%o total)',
            datetime,
            arguments.callee,
            targetMessages.size,
            targetUser.username,
            targetChannel.name,
            deleteCount
          );
    targetMessages = await targetChannel.fetchMessages(params);
    await sleep(1000);
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
      message.react('⏱');
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
      message.react('⏱');
      attemptCommmand(deleteImages, [awfulChannelParse(args[1]), message.author, 4000]);
      break;
    default:
      break;
      //asyncRemoveAttachments(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
