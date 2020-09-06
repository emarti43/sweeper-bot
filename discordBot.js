require('dotenv').config();
const Discord = require('discord.js');
const logger = require('debug')('client');
const botHelper = require('./botHelper.js');


// ****************************************
// COMMANDS
// ****************************************
const PostgresHelper = require('./postgresHelper.js');
const enableImageSweep = require('./commands/enableImageSweep.js');
const disableImageSweep = require('./commands/disableImageSweep.js');
const PurgeImages = require('./commands/purgeImages.js');
const showHelp = require('./commands/showHelp.js');
const serverStats = require('./commands/serverStats.js');
const showMonitoredChannels = require('./commands/showMonitoredChannels.js');
const addChannel = require('./commands/addChannel.js');
const removeChannel = require('./commands/removeChannel.js');


const client = new Discord.Client();
const psqlHelper = new PostgresHelper(client);


function tryCommand(dispatch, args, commandName) {
  try {
    return dispatch(...args);
  } catch(e) {
    logger(`Could not execute ${commandName}`)
    logger(e);
  }
}

async function processMessage(message) {
  try {
    psqlHelper.logActivity(await message.channel.id, await message.channel.guild.id);
    let isSweepable = await psqlHelper.isSweepableChannel(message);
    logger('Retrieved Message from %o', message.channel.name);
    let hasAttachment = message.attachments.size >= 1 || message.embeds.length >= 1;
    if (!hasAttachment) return;
    if (isSweepable) {
      await botHelper.sleep(1000 * 60 * 1);
      message.delete();
      logger('message has been deleted in %o', message.channel.name);
      return;
    } 
    let serverId = await message.channel.guild.id;
    if (await psqlHelper.isMonitoredChannel(message.channel.id, serverId)) {
      logger('Storing message from %o', message.channel.name);
      psqlHelper.storeImage(message.id, message.channel.id, serverId, message.author.id);
    }
  } catch(err) {
    logger("Could not process message:");
    logger(err);
  }
}

async function continuePurges() {
  try {
    if (process.env.NO_PURGES) {
      logger('Purges are turned off');
    } else {
      logger('Restarting Purges');
      var res = await psqlHelper.getAllCheckpoints();
      for(let i = 0; i < res.rows.length; i++) {
        let targetUser = await client.fetchUser(res.rows[i].user_id);
        let targetChannel = await client.channels.get(res.rows[i].channel_id);
        PurgeImages.startPurge(targetUser, targetChannel, psqlHelper);
        await botHelper.sleep(10000);
      }
    }
  } catch(err) {
    logger(err);
  }
}

async function scrapeChannels() {
  let channels = await psqlHelper.fetchChannels();
  for(let i = 0; i < channels.length; i++) {
    await botHelper.scrapeImages(psqlHelper, channels[i]);
  }
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
  let args = message.content.split(/\s+/);
  switch(args[0]) {
    case '!purge_images':
      tryCommand(PurgeImages.initialize, [message, psqlHelper, client], '!purge_images');
      break;
    case '!enable_sweeper':
      tryCommand(enableImageSweep.initialize, [message, psqlHelper, client], '!enable_sweeper');
      break;
    case '!disable_sweeper':
      tryCommand(disableImageSweep.initialize, [message, psqlHelper, client], '!disable_sweeper');
      break;
    case '!add_channel':
      tryCommand(addChannel.initialize, [message, psqlHelper, client], '!add_channel');
      break;
    case '!remove_channel':
      tryCommand(removeChannel.initialize, [message, psqlHelper, client], '!remove_channel');
      break;
    case '!show_monitored_channels':
      tryCommand(showMonitoredChannels.initialize, [psqlHelper, message], '!show_monitored_channels');
      break;
    case '!server_stats':
      tryCommand(serverStats.initialize, [message, psqlHelper], '!server_stats')
      break;
    case '!help':
      tryCommand(showHelp.initialize, [message], '!help')
      break;
    default:
      processMessage(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
