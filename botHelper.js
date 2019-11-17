exports.MessageResponse = async function MessageResponse(channel, content) {
    await channel.startTyping();
    await channel.send(content);
    await channel.stopTyping();
}

exports.sendChunkedMessage = function(channel, content) {
    messageChunker = content => {
        let start = 0;
        let chunks = [];
        let lookahead = 0;
        for (let i = 0; i < content.length; i = lookahead) {
            lookahead = i + 1;
            while (content[lookahead] !== '\n' && lookahead < content.length) lookahead++;
            if (lookahead - start > CHARACTER_LIMIT) {
                let chunk = content.slice(start, i);
                chunks.push(chunk)
                start = i;
            }
        }
        chunks.push(content.slice(start, content.length - 1));
        return chunks;
    }
    let chunks = messageChunker(content);
    chunks.forEach(chunk => {
        botHelper.MessageResponse(channel, chunk);
    });
}

exports.formatChannels = async function(channels) {
    let result = '**Monitored Channels:**\n'
    for (let i = 0; i < channels.length; i++) {
        result += `${channels[i]} \n`;
    }
    result += 'Call \`!add_channel <Channel>\` to add another channel \n(requires admin permission)'
    return result;
}