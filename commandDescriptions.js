const COMMAND_DESCRIPTIONS = {
  "!purge_images #channel_name": "removes all images/links in #channel_name",
  "!set_sweeper #channel_name": "removes images from user 6 minutes after posting from #chanel_name",
  "!add_channel #channel_name": "used to add channels to purge (admin only)",
  "!remove_channel #channel_name": "used to remove channels to purge (admin only)",
  "!show_monitored_channels": "displays current channels being monitored for purging",
  "!server_stats": "displays server statistics (work in progress)"
};
module.exports = COMMAND_DESCRIPTIONS;
