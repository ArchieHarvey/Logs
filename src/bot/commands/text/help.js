module.exports = {
  name: 'help',
  description: 'List available text commands.',
  async execute({ message, textCommands, prefix }) {
    const commandList = Array.from(textCommands.values())
      .map((command) => `${prefix}${command.name} - ${command.description || 'No description provided.'}`)
      .join('\n');

    await message.reply({
      content: commandList || 'No commands are currently available.',
    });
  },
};
