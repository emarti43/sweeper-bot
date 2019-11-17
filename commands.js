const COMMAND_DESCRIPTIONS = require('./commandDescriptions.js');
const botHelper = require('./botHelper.js');
exports.showHelp = function(channel) {
    let content = ''
    Object.keys(COMMAND_DESCRIPTIONS).forEach(commandName => {
        content += `\`${commandName}\` - ${COMMAND_DESCRIPTIONS[commandName]} \n`;
    });
    botHelper.MessageResponse(channel, content);
}
