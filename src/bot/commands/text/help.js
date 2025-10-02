const { replyWithEmbed } = require('../../util/replies');
const { buildHelpEmbed } = require('../../util/help');

module.exports = {
  name: 'help',
  description: 'Show available commands and how to use them.',
  async execute({ message, textCommands, prefix, client }) {
    const embed = buildHelpEmbed({
      prefix,
      textCommands,
      slashCommands: client?.slashCommands,
    });

    await replyWithEmbed(message, embed);
  },
};
