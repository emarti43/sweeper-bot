const COMMAND_DESCRIPTIONS = require('../commandDescriptions.js');
const logger = require('debug')('commands::showHelp');
const botHelper = require('./../botHelper.js');

exports.initialize = function(message) {
  let content = '';
  Object.keys(COMMAND_DESCRIPTIONS).forEach(commandName => {
      content += `\`${commandName}\` - ${COMMAND_DESCRIPTIONS[commandName]} \n`;
  });
  botHelper.MessageResponse(message.channel, content);
}