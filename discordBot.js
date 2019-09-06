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


const PURGE_DAY_LIMIT = 400;
const END_OF_PURGE = '0';

let currentDate = new Date();
const client = new Discord.Client();

function attemptCommmand(caller, args) {
  try {
    return caller(...args);
  } catch(e) {
    logger('%o from %o',e.message, caller.name);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function reachedPostLimit(currentDate, lastDateFetched, maxDays, username) {
  let currentDays = Math.round((currentDate.getTime() - lastDateFetched.getTime())/(1000*60*60*24));
  logger('%o days and counting %o', currentDays, username);
  return currentDays <= maxDays;
}

function getTimestampDate(date) {
  let currentdate = date ? date : new Date();
  return "Time: " + currentdate.getDate() + "/"
              + (currentdate.getMonth()+1)  + "/"
              + currentdate.getFullYear() + " @ "
              + currentdate.getHours() + ":"
              + currentdate.getMinutes() + ":"
              + currentdate.getSeconds();
}


async function isValidChannel(message) {
  try {
    var res = await pool.query('SELECT user_id, channel_id FROM imagesweeper WHERE user_id = $1 AND channel_id = $2;', [message.author.id, message.channel.id]);
  } catch(err) {
    console.log(err);
  }
  if (res.rows && res.rows.length > 0) return true;
  return false;
}

async function removeValidImages(message) {
  let isValid = await isValidChannel(message);
  if (message.attachments.size > 0 && isValid) {
    await sleep(1000*60*3);
    let channelName = message.channel.name;
    message.delete();
    logger('message has been deleted in %o', channelName);
  }
}

async function getCheckpoint(serverId, channelId) {
  try {
    var response = await pool.query('SELECT scraping_checkpoint FROM allowedchannels WHERE server_id = $1 AND channel_id = $2;', [serverId, channelId]);
  } catch(err) {
    console.log(err);
  }
  return response.rows && response.rows.length > 0 ? response.rows[0]: undefined;
}

async function updateCheckpoint(serverId, channelId, scrapingCheckpoint) {
  try{
    var res = await pool.query('INSERT INTO allowedchannels(server_id, channel_id, scraping_checkpoint) VALUES($1, $2, $3) ON CONFLICT (server_id, channel_id) DO UPDATE SET scraping_checkpoint = EXCLUDED.scraping_checkpoint;', [serverId, channelId, scrapingCheckpoint]);
  } catch (err) {
    console.log(err);
  }
}

async function removeCheckpoint(targetUser, targetChannel) {
  await pool.query('DELETE FROM checkpoints WHERE checkpoints.user_id = $1 and checkpoints.channel_id = $2;', [targetUser.id, targetChannel.id]);
}

async function configureParams(serverId, channelId) {
  let params = { limit: 100 };
  let row = await getCheckpoint(serverId, channelId);
  if(row && row.scraping_checkpoint) {
    params.before = row.scraping_checkpoint;
  }
  return params;
}

async function storeImage(messageId, channelId, serverId, userId) {
  try {
    await pool.query('INSERT INTO images(message_id, channel_id, server_id, user_id) VALUES($1, $2, $3, $4);', [messageId, channelId, serverId, userId]);
  } catch(err) {
    console.log(err);
  }
}

async function scrapeImages(targetChannel) {
  let serverId = await client.guilds.find(guild => guild.channels.has(targetChannel.id)).id;
  let params = await configureParams(serverId, targetChannel.id);
  let imageCount = 0;
  if (params.before === END_OF_PURGE) return;

  try {
    var messageChunk = await targetChannel.fetchMessages(params);
  } catch (err) {
    console.log(err);
    return;
  }

  logger('Scraping Images from %o [%o]', targetChannel.name, getTimestampDate(messageChunk.last().createdAt));

  while (messageChunk.last()) {
    //setup params for next store and update the checkpoint
    try {
      params.before = messageChunk.last().id;
      updateCheckpoint(serverId, targetChannel.id, params.before);
    } catch (error) {
      logger('Reached End of history');
    }
    //store the messages in the database (only images)
    messageChunk = await messageChunk.filter(message => message.attachments.size > 0);
    imageCount += messageChunk.size;
    let array = await messageChunk.array()
    for (let k = 0; k < array.length; k++) {
      await storeImage(array[k].id, targetChannel.id, serverId, array[k].author.id);
    }
    //wait and fetch the next chunk
    await sleep(250);
    messageChunk = await targetChannel.fetchMessages(params);
    logger('Fetching Images from %o [%o total] %o', targetChannel.name, imageCount, getTimestampDate(messageChunk.last().createdAt));
  }
  logger(`Fetched all messages from ${targetChannel.name}`);
  updateCheckpoint(serverId, targetChannel.id, END_OF_PURGE);
}

async function deleteImages(targetChannel, targetUser, numberOfDays) {
  logger('purge was initiated by %o', targetUser.username);
}

async function setImageSweep(userId, channelId) {
  try {
    await pool.query('INSERT INTO imagesweeper(user_id, channel_id) VALUES($1, $2);');
  } catch (err) {
    console.log(err);
  }
}

function parseChannel(text) {
  try {
    return client.channels.get(text.split('#')[1].split('>')[0]);
  } catch(e) {
    logger(e.message);
    return undefined;
  }
}

//NOTE: not being used
async function continuePurges() {
  try {
    logger('Restarting Purges');
    var res =  await pool.query('SELECT * FROM checkpoints;');
    for(let i = 0; i < res.rows.length; i++) {
      let targetChannel = await client.channels.get(res.rows[i].channel_id);
      let targetUser = await client.fetchUser(res.rows[i].user_id)
      deleteImages(targetChannel, targetUser, PURGE_DAY_LIMIT);
      await(100);
    }
  } catch(err) {
    console.log(err);
  }
}

async function fetchChannels() {
  try {
    var response = await pool.query('SELECT * FROM allowedchannels;');
  } catch(err) {
    console.log(err);
  }
  if (response.rows && response.rows.length > 0) {
    var channels = []
    for(let i = 0; i < response.rows.length; i++) {
      channels.push(client.channels.get(response.rows[i].channel_id));
    }
    return channels;
  }
  return [];
}

async function scrapeChannels() {
  let channels = await fetchChannels();
  for(let i = 0; i < channels.length; i++) {
    await scrapeImages(channels[i]);
  }
}

client.on('ready', () => {
  logger('Starting bot up. Ready to receive connections...');
  logger('Fetching Messages from Allowed Channels');
  scrapeChannels();
});

async function queuePurge(userId, channelId) {
  try {
    var response = await pool.query('SELECT * FROM checkpoints WHERE checkpoints.user_id = $1 AND checkpoints.channel_id = $2;', [userId, channelId]);
  } catch(err) {
    console.log(err);
  }
  if (response.rows && response.rows.length > 0) {
    return false;
  } else {
    try {
      await pool.query('INSERT into checkpoints(user_id, last_checkpoint, channel_id, total_images) VALUES ($1, $2, $3, $4);', [userId, ' ', channelId, 0]);
    } catch(err) {
      console.log(err);
    }
    return true;
  }
}

client.on('message', message => {
  let args = message.content.split(' ');
  switch(args[0]) {
    case '!purge_images':
      if(parseChannel(args[1])) {
        if (attemptCommmand(queuePurge, [message.user.id, parseChannel(args[1]).id])) {
          message.react('⏱');
          attemptCommmand(deleteImages, [parseChannel(args[1]), message.author, 400]);
        } else message.reply("I'm on it 😅");
      }
      break;
    case '!set_sweeper':
      if(parseChannel(args[1])) {
        message.react('🧹');
        attemptCommmand(setImageSweep, [parseChannel(args[1]), message.author.id, message.channel.id]);
      }
    default:
      removeValidImages(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
