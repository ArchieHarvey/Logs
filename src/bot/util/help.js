const { createEmbed } = require('./replies');

function formatCommandList(commands, formatter, emptyFallback) {
  if (!commands || commands.size === 0) {
    return emptyFallback;
  }

  return Array.from(commands.values())
    .map(formatter)
    .join('\n');
}

function buildHelpEmbed({ prefix = '!', textCommands, slashCommands }) {
  const textValue = formatCommandList(
    textCommands,
    (command) => `\`${prefix}${command.name}\` - ${command.description || 'No description provided.'}`,
    'No text commands are currently available.'
  );

  const slashValue = formatCommandList(
    slashCommands,
    (command) => {
      const name = command.data?.name ?? command.name;
      const description = command.data?.description ?? command.description;
      return `\`/${name}\` - ${description || 'No description provided.'}`;
    },
    'No slash commands are currently available.'
  );

  return createEmbed({
    title: 'Help menu',
    description: 'Here\'s a list of commands you can use with the bot.',
    fields: [
      { name: 'Text commands', value: textValue },
      { name: 'Slash commands', value: slashValue },
    ],
  });
}

module.exports = {
  buildHelpEmbed,
};
