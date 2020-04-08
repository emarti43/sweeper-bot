require('dotenv').config();

exports.enableImageSweep =  async function (psqlHelper, userId, channelId) {
    psqlHelper.enableImageSweep(userId, channelId);
}

exports.disableImageSweep =  async function (psqlHelper, userId, channelId) {
    psqlHelper.disableImageSweep(userId, channelId);
}