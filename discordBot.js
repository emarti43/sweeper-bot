require('dotenv').config();
const Discord = require('discord.js');
const logger = require('debug')('client');
const PostgresHelper = require('./postgresHelper.js');
const SweeperCommands = require('./commands.js');
const PurgeImages = require('./commands/purgeImages.js');
const showHelp = require('./commands/showHelp.js');
const serverStats = require('./commands/serverStats.js');
const showMonitoredChannels = require('./commands/showMonitoredChannels.js');
const botHelper = require('./botHelper.js');

const client = new Discord.Client();
const psqlHelper = new PostgresHelper(client);


function tryCommand(dispatch, args) {
  try {
    return dispatch(...args);
  } catch(e) {
    logger(`Could not execute ${dispatch.name}`)
    logger(e);
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

async function processMessage(message) {
  psqlHelper.logActivity(message.channel.id, await message.channel.guild.id);
  let isSweepable = await psqlHelper.isSweepableChannel(message);
  logger('Retrieved Message from %o  %o', message.channel.name, botHelper.getTimestampDate());
  if (message.attachments.size > 0 || message.embeds.length > 0) {
    if (isSweepable) {
      await botHelper.sleep(1000*60*1);
      let channelName = message.channel.name;
      message.delete();
      logger('message has been deleted in %o', channelName);
    } else {
      let serverId = await message.channel.guild.id;
      if (await psqlHelper.isMonitoredChannel(message.channel.id, serverId)) {
        logger('storing message %o from %o', botHelper.getTimestampDate(), message.channel.name);
        psqlHelper.storeImage(message.id, message.channel.id, serverId, message.author.id);
      }
    }
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
        Purging.startPurge(targetUser, targetChannel, psqlHelper);
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
  let args = message.content.split(/\s+/);
  switch(args[0]) {
    case '!purge_images':
      try {
        PurgeImages.execute(message, psqlHelper, client);
      } catch (err) {
        logger("Could not execute !purge_images");
        logger(err);
      }
      break;
    case '!enable_sweeper':
      if (parseChannel(args[1])) {
        botHelper.MessageResponse(message.channel, '🧹 Cleaning up after your mess! 🧹');
        tryCommand(botHelper.enableImageSweep,  a [psqlHelper, message.author.id, parseChannel(args[1]).id]);
      } else botHelper.MessageResponse(message.channel, 'Please provide a channel to enable sweeping');
      break;
    case '!disable_sweeper':
      if (parseChannel(args[1])) {
        tryCommand(botHelper.disableImageSweep, [psqlHelper, message.author.id, parseChannel(args[1]).id]);
      } else botHelper.botHelper.MessageResponse(message.channel, 'Please provide a channel to disable sweeping');
      break;
    case '!add_channel':
      if (parseChannel(args[1]) && message.member.hasPermission('ADMINISTRATOR')) {
        tryCommand(addChannel, [parseChannel(args[1])]);
        tryCommand(botHelper.scrapeImages, [psqlHelper, message.channel]);
      }
      break;
    case '!show_monitored_channels':
      try {
        showMonitoredChannels(psqlHelper, message);
      } catch (err) {
        logger('Could not execute !show_monitored_channels');
        logger(err);
      }
      break;
    case '!server_stats':
      try {
        serverStats.execute(message, psqlHelper);
      } catch (err) {
        logger('Could not execute !server_stats');
        logger(err)
      }
      break;
    case '!help':
      try {
        showHelp.execute(message);
      } catch (err) {
        logger('Could not execute !help');
        logger(err);
      }
      break;
    default:
      processMessage(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
