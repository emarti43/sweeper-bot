const PostgresHelper = require('./postgresHelper.js');
require('dotenv').config()
const Discord = require('discord.js');
const logger = require('debug')('logs');

const SweeperCommands = require('./commands.js');
const botHelper = require('./botHelper.js');


const END_OF_PURGE = '0';
const COMMAND_DESCRIPTIONS = require('./commandDescriptions.js');
const client = new Discord.Client();
const psqlHelper = new PostgresHelper(client);
const CHARACTER_LIMIT = 2000;


function attemptCommand(caller, args) {
  try {
    return caller(...args);
  } catch(e) {
    logger('COMMAND HAS FAILED %o : %o', caller.name, e.message);
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


async function processMessage(message) {
  psqlHelper.logActivity(message.channel.id, await message.channel.guild.id);
  let isSweepable = await psqlHelper.isSweepableChannel(message);
  logger('Retrieved Message from %o  %o', message.channel.name, getTimestampDate());
  if (message.attachments.size > 0) {
    if (isSweepable) {
      await sleep(1000*60*3);
      let channelName = message.channel.name;
      message.delete();
      logger('message has been deleted in %o', channelName);
    } else {
      let serverId = await message.channel.guild.id;
      if (await psqlHelper.isMonitoredChannel(message.channel.id, serverId)) {
        logger('storing message %o from %o', getTimestampDate(), message.channel.name);
        psqlHelper.storeImage(message.id, message.channel.id, serverId, message.author.id);
      }
    }
  }
}

async function configureParams(serverId, channelId) {
  let params = { limit: 100 };
  let row = await psqlHelper.getScrapingCheckpoint(serverId, channelId);
  if (row && row.scraping_checkpoint) {
    params.before = row.scraping_checkpoint;
  }
  return params;
}

async function purgeImages(targetUser, targetChannel) {
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
    for(let i = 0; i < response.rows.length; i++) {
      try {
        var message = await targetChannel.fetchMessage(response.rows[i].message_id);
      } catch (err) {
        logger('fetched nonexistent key');
        psqlHelper.deleteImage(response.rows[i].message_id, targetChannel.id, serverId);
        continue;
      }
      if (message) {
        message.delete();
        logger('Deleting image for %o (%o out of %o).', targetUser.username, (i+1), imageCount);
        psqlHelper.deleteImage(message.id, targetChannel.id, serverId);
      }
      await sleep(1000);
    }
  }
  await psqlHelper.removeUserCheckpoint(targetUser, targetChannel);
  targetUser.send(`Hi ${targetUser.username}. I've deleted ${imageCount} images from ${targetChannel.name}. Please check if any recent images you've uploaded are not deleted.`);
}

function parseChannel(text) {
  try {
    return client.channels.get(text.split('#')[1].split('>')[0]);
  } catch(e) {
    logger(e.message);
    return undefined;
  }
}

async function continuePurges() {
  try {
    logger('Restarting Purges');
    var res = await psqlHelper.getAllCheckpoints();
    for(let i = 0; i < res.rows.length; i++) {
      let targetUser = await client.fetchUser(res.rows[i].user_id);
      let targetChannel = await client.channels.get(res.rows[i].channel_id);
      purgeImages(targetUser, targetChannel);
      await sleep(10000);
    }
  } catch(err) {
    logger(err);
  }
}

async function scrapeImages(targetChannel) {
  let serverId = await targetChannel.guild.id;
  let params = await configureParams(serverId, targetChannel.id);
  let imageCount = 0;

  if (params.before === END_OF_PURGE) {
    logger('Images have been scraped');
    return;
  }
  logger('Beginning logging task for %o', targetChannel.name);

  try {
    var messageChunk = await targetChannel.fetchMessages(params);
  } catch (err) {
    logger('%o FAILED TO RETRIEVE MESSAGE CHUNK', targetChannel.name);
    logger(err);
    return;
  }

  let timestamp = messageChunk.last() ? getTimestampDate(messageChunk.last().createdAt) : 'Finished Scrape';

  logger('Scraping Images from %o [%o]', targetChannel.name, timestamp);

  while (messageChunk.last()) {
    //setup params for next store and update the checkpoint
    try {
      params.before = messageChunk.last().id;
      psqlHelper.updateScrapingCheckpoint(serverId, targetChannel.id, params.before);
    } catch (error) {
      logger('Reached End of history');
    }
    //store the messages in the database (only images)
    messageChunk = await messageChunk.filter(message => message.attachments.size > 0);
    imageCount += messageChunk.size;
    let array = await messageChunk.array()
    for (let k = 0; k < array.length; k++) {
      await psqlHelper.storeImage(array[k].id, targetChannel.id, serverId, array[k].author.id);
    }
    //wait and fetch the next chunk
    await sleep(250);
    messageChunk = await targetChannel.fetchMessages(params);
    timestamp = messageChunk.last() ? messageChunk.last().createdAt : undefined;
    logger('Scraping Images from %o [%o total] %o', targetChannel.name, imageCount, getTimestampDate(timestamp));
  }
  logger(`Scraped all messages from ${targetChannel.name}`);
  psqlHelper.updateScrapingCheckpoint(serverId, targetChannel.id, END_OF_PURGE);
}

async function scrapeChannels() {
  let channels = await psqlHelper.fetchChannels();
  for(let i = 0; i < channels.length; i++) {
    await scrapeImages(channels[i]);
  }
}

async function queuePurge(userId, channelId) {
  let response = await psqlHelper.getUserCheckpoint(userId, channelId)
  if (response.rows && response.rows.length > 0) return false;
  psqlHelper.insertUserCheckpoint(userId, channelId);
  return true;
}

async function setSweeper(userId, channel) {
  psqlHelper.setImageSweep(userId, channel.id);
}
async function addChannel(channel) {
  psqlHelper.addMonitoredChannel(channel.guild.id, channel.id);
}

// BOT COMMANDS AND EVENTS

client.on('ready', () => {
  logger('Starting bot up. Ready to receive connections...');
  scrapeChannels();
  continuePurges();
});

client.on('channelCreate', channel => {
  try {
    logger(`[${channel.guild.name}] Channel ${channel.name} is created`);
    psqlHelper.initActivity(channel.id, channel.guild.id);
  } catch (error) {
    logger("Error on channelCreate event:");
    logger(error);
  }
  
});

client.on('channelDelete', channel => {
  try {
    logger(`[${channel.guild.name}] Channel ${channel.name} is deleted`);
  } catch (error) {
    logger("Error on channelDelete event:");
    logger(error);
  }
})


client.on('message', message => {
  let args = message.content.split(' ');
  switch(args[0]) {
    case '!purge_images':
      if (parseChannel(args[1])) {
        if (attemptCommand(queuePurge, [message.author.id, parseChannel(args[1]).id])) {
          botHelper.MessageResponse(message.channel, '⏱ Starting Purge. You will be messaged when the purge is done (hopefully) ⏱');
          attemptCommand(purgeImages, [message.author, parseChannel(args[1])]);
        } else botHelper.MessageResponse(message.channel, "I'm on it 😅");
      }
      break;
    case '!set_sweeper':
      if (parseChannel(args[1])) {
        botHelper.MessageResponse(message.channel, '🧹 Cleaning up after your mess! 🧹');
        attemptCommand(setSweeper, [message.author.id, parseChannel(args[1]).id]);
      }
      break;
    case '!add_channel':
      if (parseChannel(args[1]) && message.member.hasPermission('ADMINISTRATOR')) {
        attemptCommand(addChannel, [parseChannel(args[1])]);
        attemptCommand(scrapeImages, [message.channel]);
      }
      break;
    case '!show_monitored_channels':
      attemptCommand(SweeperCommands.showMonitoredChannels, [psqlHelper, message.channel]);
      break;
    case '!show_channel_activity':
      attemptCommand(SweeperCommands.showChannelActivity, [psqlHelper, message.channel]);
      break;
    case '!help':
      attemptCommand(SweeperCommands.showHelp, [message.channel]);
      break;
    default:
      processMessage(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
