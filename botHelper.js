const logger = require('debug')('helper');
const CHARACTER_LIMIT = 2000;
const END_OF_SCRAPE = '0';


exports.MessageResponse = async function MessageResponse(channel, content) {
    await channel.startTyping();
    await channel.send(content);
    await channel.stopTyping();
}

exports.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function configureParams(psqlHelper, serverId, channelId) {
    let params = { limit: 100 };
    let row = await psqlHelper.getScrapingCheckpoint(serverId, channelId);
    if (row && row.scraping_checkpoint) {
        params.before = row.scraping_checkpoint;
    }
    return params;
}

exports.reachedPostLimit = function(currentDate, lastDateFetched, maxDays, username) {
    let currentDays = Math.round((currentDate.getTime() - lastDateFetched.getTime()) / (1000 * 60 * 60 * 24));
    logger('%o days and counting %o', currentDays, username);
    return currentDays <= maxDays;
}

exports.getTimestampDate = function(date) {
    let currentdate = date ? date : new Date();
    return "Time: " + currentdate.getDate() + "/"
        + (currentdate.getMonth() + 1) + "/"
        + currentdate.getFullYear() + " @ "
        + currentdate.getHours() + ":"
        + currentdate.getMinutes() + ":"
        + currentdate.getSeconds();
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
exports.parseChannels = function parseChannel(text, client) {
    try {
        return client.channels.get(text.split('#')[1].split('>')[0]);
    } catch(err) {
        logger(err);
        return undefined;
    }
}

exports.scrapeImages = async function (psqlHelper, targetChannel) {
    let serverId = await targetChannel.guild.id;
    let params = await configureParams(psqlHelper, serverId, targetChannel.id);
    let imageCount = 0;

    if (params.before === END_OF_SCRAPE) {
        logger('Images have been scraped');
        return;
    }
    logger('beginning image scrape for %o', targetChannel.name);

    try {
        var messageChunk = await targetChannel.fetchMessages(params);
    } catch (err) {
        logger('%o FAILED TO RETRIEVE MESSAGE CHUNK', targetChannel.name);
        logger(err);
        return;
    }

    let timestamp = messageChunk.last() ? exports.getTimestampDate(messageChunk.last().createdAt) : 'Finished Scrape';

    logger('Scraping Images from %o [%o]', targetChannel.name, timestamp);

    while (messageChunk.last()) {
        //setup params for next store and update the checkpoint
        try {
            params.before = messageChunk.last().id;
            psqlHelper.updateScrapingCheckpoint(serverId, targetChannel.id, params.before);
        } catch (error) {
            logger('Reached End of history');
        }
        //store the messages in the database (only images)
        messageChunk = await messageChunk.filter(message => message.attachments.size > 0 || message.embeds.length > 0);
        imageCount += messageChunk.size;
        let array = await messageChunk.array()
        for (let k = 0; k < array.length; k++) {
            await psqlHelper.storeImage(array[k].id, targetChannel.id, serverId, array[k].author.id);
        }
        //wait and fetch the next chunk
        await exports.sleep(250);
        messageChunk = await targetChannel.fetchMessages(params);
        timestamp = messageChunk.last() ? messageChunk.last().createdAt : undefined;
        logger('Scraping Images from %o [%o total] %o', targetChannel.name, imageCount, exports.getTimestampDate(timestamp));
    }
    logger(`Scraped all messages from ${targetChannel.name}`);
    psqlHelper.updateScrapingCheckpoint(serverId, targetChannel.id, END_OF_SCRAPE);
}