const { fetchStoredPresence, applyPresence, buildPresenceDescription } = require('../commands/common/presence');

module.exports = ({ client, logger, slashCommands, mongoService }) => {
  client.once('clientReady', async () => {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Loaded ${slashCommands.length} slash commands.`);

    if (!mongoService) {
      return;
    }

    try {
      const storedPresence = await fetchStoredPresence(mongoService);
      if (!storedPresence) {
        return;
      }

      await applyPresence(client, storedPresence);
      logger.info(`Restored presence from MongoDB: ${buildPresenceDescription(storedPresence)}`);
    } catch (error) {
      logger.warn(`Failed to restore presence from MongoDB: ${error.message}`);
    }
  });
};
