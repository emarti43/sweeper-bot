exports.MessageResponse = function MessaeResponse(channel, content) {
    await channel.startTyping();
    await channel.send(content);
    await channel.stopTyping();
}