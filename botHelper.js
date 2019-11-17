exports.MessageResponse = async function MessageResponse(channel, content) {
    await channel.startTyping();
    await channel.send(content);
    await channel.stopTyping();
}