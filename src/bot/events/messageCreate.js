const { createEmbed, replyWithEmbed } = require('../util/replies');

module.exports = ({ client, logger, textCommands, prefix }) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) {
      return;
    }

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) {
      return;
    }

    const command = textCommands.get(commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute({ message, args, client, logger, textCommands, prefix });
    } catch (error) {
      logger.error(`Error executing text command ${commandName}:`, error);
      if (message.channel) {
        const errorEmbed = createEmbed({
          title: 'Command error',
          description: 'There was an error while executing that command.',
        });

        await replyWithEmbed(message, errorEmbed);
      }
    }
  });
};
