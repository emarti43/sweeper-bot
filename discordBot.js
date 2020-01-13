require('dotenv').config();
const Discord = require('discord.js');
const logger = require('debug')('logs');
const PostgresHelper = require('./postgresHelper.js');
const SweeperCommands = require('./commands.js');
const botHelper = require('./botHelper.js');

const client = new Discord.Client();
const psqlHelper = new PostgresHelper(client);


function attemptCommand(caller, args) {
  try {
    return caller(...args);
  } catch(e) {
    logger('COMMAND HAS FAILED %o : %o', caller.name, e.message);
  }
}

async function processMessage(message) {
  psqlHelper.logActivity(message.channel.id, await message.channel.guild.id);
  let isSweepable = await psqlHelper.isSweepableChannel(message);
  logger('Retrieved Message from %o  %o', message.channel.name, botHelper.getTimestampDate());
  if (message.attachments.size > 0) {
    if (isSweepable) {
      await botHelper.sleep(1000*60*3);
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
      SweeperCommands.purgeImages(psqlHelper, targetUser, targetChannel);
      await botHelper.sleep(10000);
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
  logger('parsing command arguments', args)
  switch(args[0]) {
    case '!purge_images':
      let channelTarget = parseChannel(args[1]);
      if (channelTarget) {
        if (attemptCommand(queuePurge, [message.author.id, channelTarget.id])) {
          botHelper.MessageResponse(message.channel, '⏱ Starting Purge. You will be messaged when the purge is done (hopefully) ⏱');
          attemptCommand(SweeperCommands.purgeImages, [psqlHelper, message.author, channelTarget]);
        } else botHelper.MessageResponse(message.channel, "I'm on it 😅");
      } else {
        //Syntax for purging for a user !purge_images <user> <channel>
        channelTarget = parseChannel(args[2]);
        let user = message.guild.members.get(args[1].slice(3, args[1].length - 1));
        if (message.guild.members.get(message.author.id).permissions.has('ADMINISTRATOR')) {
            if (channelTarget && attemptCommand(queuePurge, [message.author.id, channelTarget.id])) {
              botHelper.MessageResponse(message.channel, '⏱ Starting Purge. the user will be messaged when the purge is done (hopefully) ⏱');
              attemptCommand(SweeperCommands.purgeImages, [psqlHelper, user, channelTarget]);
            }
        }
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
        attemptCommand(botHelper.scrapeImages, [psqlHelper, message.channel]);
      }
      break;
    case '!show_monitored_channels':
      attemptCommand(SweeperCommands.showMonitoredChannels, [psqlHelper, message.channel]);
      break;
    case '!server_stats':
      attemptCommand(SweeperCommands.serverStats, [psqlHelper, message.channel]);
      break;
    case '!help':
      attemptCommand(SweeperCommands.showHelp, [message.channel]);
      break;
    default:
      processMessage(message);
  }
});

client.login(process.env.DISCORD_BOT_AUTH);
