const COMMAND_DESCRIPTIONS = require('../commandDescriptions.js');
const logger = require('debug')('commands::showHelp');

exports.execute = function(message) {
  let content = '';
  Object.keys(COMMAND_DESCRIPTIONS).forEach(commandName => {
      content += `\`${commandName}\` - ${COMMAND_DESCRIPTIONS[commandName]} \n`;
  });
  botHelper.MessageResponse(message.channel, content);
}