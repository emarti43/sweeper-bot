const  { Pool, Client } = require('pg');
require('dotenv').config();
class PostgresHelper {
  constructor(discordClient) {
    this.pool = new Pool(
      {
        connectionString: process.env.DATABASE_URL,
        ssl: true,
      }
    );
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

  async initActivity(channelId, serverId) {
    try {
      let date = new Date();
      this.pool.query('INSERT INTO channel_logs(channel_id, server_id, message_count, last_cycle) VALUES($1, $2, $3, $4) ON CONFLICT (server_id, channel_id, last_cycle) DO UPDATE SET message_count = channel_logs.message_count + 1;', [channelId, serverId, 0, '' + date.getMonth() + '/' + date.getFullYear()]);
    } catch (error) {
      console.log(error);
    }
  }

  async removeChannel(channelId, serverId) {
    try {
      this.pool.query('DELETE FROM channel_logs WHERE channel_id = $1 AND server_id = $2', [channelId, serverId]);
    } catch(error) {
      console.log(error)
    }
  }

  async logActivity(channelId, serverId) {
    try {
      let date = new Date();
      this.pool.query('INSERT INTO channel_logs(channel_id, server_id, message_count, last_cycle) VALUES($1, $2, $3, $4) ON CONFLICT (server_id, channel_id, last_cycle) DO UPDATE SET message_count = channel_logs.message_count + 1;', [channelId, serverId, 1, '' + date.getMonth() + '/' + date.getFullYear()]);
    } catch (error) {
      console.log(error);
    }
  }

  // RESPONSE FORMAT
  // [
  //   {
  //     month: "November",
  //     year: "2019",
  //     channelCounts: [
  //       {
  //         id: "237894572038290",
  //         count: 45
  //       },
  //       {
  //         id: "237894572038290",
  //         count: 45
  //       }
  //     ]
  //   }
  // ]

  async getChannelActivity(serverId) {
    try {
      var queryResponse = await this.pool.query('SELECT * FROM channel_logs WHERE server_id = $1 ORDER BY last_cycle DESC, message_count DESC;', [serverId])
    } catch (error) {
      console.log(error);
    }
    if (queryResponse.rowCount <= 0) return [];
    else {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let response = [];
      let temp = null;
      queryResponse.rows.forEach( element => {
        let [month, year] = element.last_cycle.split('/');
        month = monthNames[month];
        if (temp === null || month !== temp.month || year !== temp.year) {
          if (temp !== null) response.push(temp);
          temp = {
            month: month,
            year: year,
            channels: []
          };
        }
        temp.channels.push({id: element.channel_id, count: element.message_count});
      });
      response.push(temp);
      return response;
    }
  }

  async isMonitoredChannel(channelId, serverId) {
    try {
      var response = await this.pool.query('SELECT * FROM monitored_channels WHERE channel_id = $1 AND server_id = $2;', [channelId, serverId]);
    } catch (error) {
      console.log(error);
    }
    if (response.rows && response.rows.length > 0) return true;
    return false;
  }

  async getScrapingCheckpoint(serverId, channelId) {
    try {
      var response = await this.pool.query('SELECT scraping_checkpoint FROM monitored_channels WHERE server_id = $1 AND channel_id = $2;', [serverId, channelId]);
    } catch(err) {
      console.log(err);
    }
    return response.rowCount > 0 ? response.rows[0]: undefined;
  }

  async getUserCheckpoint(userId, channelId) {
    try {
      var response = await this.pool.query('SELECT * FROM checkpoints WHERE checkpoints.user_id = $1 AND checkpoints.channel_id = $2;', [userId, channelId]);
    } catch(err) {
      console.log(err);
    }
    return response;
  }
  async getAllCheckpoints() {
    try {
      var res = await this.pool.query('SELECT * FROM checkpoints;');
    } catch(error) {
      console.log(error);
    }
    return res;
    
  }

  async insertUserCheckpoint(userId, channelId) {
    try {
      await this.pool.query('INSERT into checkpoints(user_id, last_checkpoint, channel_id, total_images) VALUES ($1, $2, $3, $4);', [userId, ' ', channelId, 0]);
    } catch(err) {
      console.log(err);
    }
  }

  async updateScrapingCheckpoint(serverId, channelId, scrapingCheckpoint) {
    try{
      var res = await this.pool.query('INSERT INTO monitored_channels(server_id, channel_id, scraping_checkpoint) VALUES($1, $2, $3) ON CONFLICT (server_id, channel_id) DO UPDATE SET scraping_checkpoint = EXCLUDED.scraping_checkpoint;', [serverId, channelId, scrapingCheckpoint]);
    } catch (err) {
      console.log(err);
    }
  }

  async removeUserCheckpoint(userId, channelId) {
    try {
      await this.pool.query('DELETE FROM checkpoints WHERE user_id = $1 and channel_id = $2;', [userId, channelId]);
    } catch (err) {
      console.log(err);
    }
    
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

  async enableImageSweep(userId, channelId) {
    try {
      await this.pool.query('INSERT INTO imagesweeper(user_id, channel_id) VALUES($1, $2);', [userId, channelId]);
    } catch (err) {
      console.log(err);
    }
  }

  async disableImageSweep(userId, channelId) {
    try {
      await this.pool.query('DELETE FROM imagesweeper WHERE user_id = $1 AND channel_id = $2;', [userId, channelId]);
    } catch (err) {
      console.log(err);
    }
  }

  async fetchChannels(serverId) {
    try {
      if (serverId) {
        var response = await this.pool.query('SELECT * FROM monitored_channels WHERE server_id = $1;', [serverId]);
      } else {
        var response = await this.pool.query('SELECT * FROM monitored_channels;');
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

  async addMonitoredChannel(serverId, channelId) {
    try {
      await this.pool.query('INSERT INTO monitored_channels(server_id, channel_id) VALUES($1, $2);', [serverId, channelId]);
    } catch(err) {
      console.log(err);
    }
  }
}
module.exports = PostgresHelper;
