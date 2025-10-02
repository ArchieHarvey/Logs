const path = require('node:path');
const { REST, Routes } = require('discord.js');

const config = require('./src/config');
const { loadSlashCommands } = require('./src/bot/loaders/commandLoader');
const logger = require('./src/bot/util/logger');

(async () => {
  if (!config.token || !config.clientId) {
    logger.error('BOT_TOKEN and CLIENT_ID must be set before deploying slash commands.');
    process.exit(1);
    return;
  }

  const slashDirectory = path.join(__dirname, 'src', 'bot', 'commands', 'slash');
  const slashCommands = loadSlashCommands(slashDirectory).map((command) => command.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Deploying ${slashCommands.length} slash commands...`);

    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: slashCommands });
      logger.info('Slash commands registered for guild testing.');
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), { body: slashCommands });
      logger.info('Slash commands registered globally.');
    }
  } catch (error) {
    logger.error('Failed to deploy slash commands:', error);
    process.exit(1);
  }
})();
