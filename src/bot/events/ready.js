const { fetchStoredPresence, applyPresence, buildPresenceDescription } = require('../commands/common/presence');
const { syncOwnersFromDatabase } = require('../util/owners');

module.exports = ({ client, logger, slashCommands, mongoService }) => {
  client.once('clientReady', async () => {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Loaded ${slashCommands.length} slash commands.`);

    if (!mongoService) {
      return;
    }

    if (mongoService?.isConfigured?.()) {
      try {
        const ownerIds = await syncOwnersFromDatabase(mongoService);
        const ownerCount = ownerIds.length;
        logger.info(`Loaded ${ownerCount} owner ${ownerCount === 1 ? 'ID' : 'IDs'} from MongoDB.`);
      } catch (error) {
        logger.warn(`Failed to synchronize owner IDs from MongoDB: ${error.message}`);
      }
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