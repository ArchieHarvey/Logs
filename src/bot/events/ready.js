module.exports = ({ client, logger, slashCommands }) => {
  client.once('clientReady', async () => {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Loaded ${slashCommands.length} slash commands.`);
  });
};