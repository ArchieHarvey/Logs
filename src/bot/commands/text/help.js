const { createEmbed, replyWithEmbed } = require('../../util/replies');

module.exports = {
  name: 'help',
  description: 'List available text commands.',
  async execute({ message, textCommands, prefix }) {
    const commandList = Array.from(textCommands.values())
      .map((command) => `${prefix}${command.name} - ${command.description || 'No description provided.'}`)
      .join('\n');

    const embed = createEmbed({
      title: 'Available text commands',
      description: commandList || 'No commands are currently available.',
    });

    await replyWithEmbed(message, embed);
  },
};
