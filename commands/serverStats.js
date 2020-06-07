require('dotenv').config();
const clientAddress = process.env.CLIENT_ADDRESS;
const axios = require('axios');
const botHelper = require('../botHelper.js');
const logger = require('debug')('commands::serverStats');

exports.serverStats = async function(channel, psqlHelper) {
  logger("Posting logging activity on client server")
  let response = await psqlHelper.getChannelActivity(channel.guild.id);
  response.forEach(element => {
      element.channels.forEach(channelLog => {
          let existingChannel = channel.guild.channels.get(channelLog.id);
          channelLog.name = existingChannel ? '#' + existingChannel.name : '#Deleted Channel';
      });
  });
  try {
    logger("sending stats to web server");
    logger(response);
    response = await axios({
      method: 'post',
      url: `http://${clientAddress}/servers/logs/${channel.guild.id}`,
      data: {
          name: channel.guild.name,
          logs: response
      }
    });
    if (response.status !== 200) throw `Expected 200, got ${response.status}\n ${response.data}`
  } catch (err) {
    logger('Could not post server stats');
    logger(err);
  }
  botHelper.MessageResponse(channel, 'http://' + clientAddress + '/servers/' + channel.guild.id);
}

exports.initialize = async function(message, psqlHelper) {
  exports.serverStats(message.channel, psqlHelper);
}