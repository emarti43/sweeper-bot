const COMMAND_DESCRIPTIONS = {
  "!purge_images #channel_name": "used to remove all images from user in specified channel",
  "!set_sweeper #channel_name": "tracks to channel to remove images from user 6 minutes after posting",
  "!add_channel #channel_name": "used to add channels that users can make purges from (admin only)",
  "!list_channels": "displays current channels being monitored for image purging purposes",
  "!show_channel_activity": "displays number of messages posted on public channels each month (a work in progress)"
};
module.exports = COMMAND_DESCRIPTIONS;
