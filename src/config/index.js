const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  token: process.env.BOT_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  updateChannelId: process.env.UPDATE_CHANNEL_ID || '',
  commandPrefix: process.env.COMMAND_PREFIX || '!',
  gitPollIntervalMinutes: numberFromEnv(process.env.GIT_POLL_INTERVAL_MINUTES, 5),
};

module.exports = config;
