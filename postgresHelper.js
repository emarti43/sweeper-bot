const  { Pool, Client } = require('pg');
class PostgresHelper {
  constructor(postgresPool, discordClient) {
    this.pool = postgresPool;
    this.client = discordClient;
  }

  async isSweepableChannel(message) {
    try {
      var res = await this.pool.query('SELECT user_id, channel_id FROM imagesweeper WHERE user_id = $1 AND channel_id = $2;', [message.author.id, message.channel.id]);
    } catch(err) {
      console.log(err);
    }
    if (res.rows && res.rows.length > 0) return true;
    return false;
  }

  async isAllowedChannel(channelId, serverId) {
    try {
      var response = await this.pool.query('SELECT * FROM allowedchannels WHERE channel_id = $1 AND server_id = $2;', [channelId, serverId]);
    } catch (error) {
      console.log(error);
    }
    if (response.rows && response.rows.length > 0) return true;
    return false;
  }

  async getScrapingCheckpoint(serverId, channelId) {
    try {
      var response = await this.pool.query('SELECT scraping_checkpoint FROM allowedchannels WHERE server_id = $1 AND channel_id = $2;', [serverId, channelId]);
    } catch(err) {
      console.log(err);
    }
    return response.rowCount > 0 ? response.rows[0]: undefined;
  }

  async getUserCheckpoint(userId, channelId) {
    try {
      var response = await pool.query('SELECT * FROM checkpoints WHERE checkpoints.user_id = $1 AND checkpoints.channel_id = $2;', [userId, channelId]);
    } catch(err) {
      console.log(err);
    }
    return response;
  }

  async insertUserCheckpoint(userId, channelId) {
    try {
      await pool.query('INSERT into checkpoints(user_id, last_checkpoint, channel_id, total_images) VALUES ($1, $2, $3, $4);', [userId, ' ', channelId, 0]);
    } catch(err) {
      console.log(err);
    }
  }

  async updateScrapingCheckpoint(serverId, channelId, scrapingCheckpoint) {
    try{
      var res = await this.pool.query('INSERT INTO allowedchannels(server_id, channel_id, scraping_checkpoint) VALUES($1, $2, $3) ON CONFLICT (server_id, channel_id) DO UPDATE SET scraping_checkpoint = EXCLUDED.scraping_checkpoint;', [serverId, channelId, scrapingCheckpoint]);
    } catch (err) {
      console.log(err);
    }
  }

  async removeUserCheckpoint(targetUser, targetChannel) {
    await this.pool.query('DELETE FROM checkpoints WHERE checkpoints.user_id = $1 and checkpoints.channel_id = $2;', [targetUser.id, targetChannel.id]);
  }

  async storeImage(messageId, channelId, serverId, userId) {
    try {
      await this.pool.query('INSERT INTO images(message_id, channel_id, server_id, user_id) VALUES($1, $2, $3, $4);', [messageId, channelId, serverId, userId]);
    } catch(err) {
      console.log(err);
    }
  }

  async fetchImages(userId, channelId, serverId) {
    try {
      var response = await this.pool.query('SELECT message_id FROM images WHERE user_id = $1 AND channel_id = $2 AND server_id = $3;', [userId, channelId, serverId]);
    } catch (err) {
      console.log(error);
    }
    return response;
  }

  async deleteImage(messageId, channelId, serverId) {
    try {
      await this.pool.query('DELETE FROM images WHERE message_id = $1 AND channel_id = $2 AND server_id = $3;', [messageId, channelId, serverId]);
    }catch(err) {
      console.log(error)
    }
  }

  async setImageSweep(userId, channelId) {
    try {
      await this.pool.query('INSERT INTO imagesweeper(user_id, channel_id) VALUES($1, $2);');
    } catch (err) {
      console.log(err);
    }
  }

  async fetchChannels(serverId) {
    try {
      if (serverId) {
        var response = await this.pool.query('SELECT * FROM allowedchannels WHERE server_id = $1;', [serverId]);
      } else {
        var response = await this.pool.query('SELECT * FROM allowedchannels;');
      }
    } catch(err) {
      console.log(err);
    }
    var channels = []
    if (response.rows && response.rows.length > 0) {
      for(let i = 0; i < response.rows.length; i++) {
        channels.push(this.client.channels.get(response.rows[i].channel_id));
      }
      return channels;
    }
    return channels;
  }

  async addAllowedChannel(targetChannel) {
    try {
      await this.pool.query('INSERT INTO allowedchannels(server_id, user_id) VALUES($1, $2);', [targetChannel.id, await getServer(targetChannel).id]);
    } catch(err) {
      console.log(err);
    }
    scrapeImages(targetChannel);
  }
}
module.exports = PostgresHelper;
