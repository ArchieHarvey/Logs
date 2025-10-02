const { SlashCommandBuilder } = require('discord.js');
const { buildHelpEmbed } = require('../../util/help');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands.'),
  async execute(interaction) {
    const embed = buildHelpEmbed({
      prefix: interaction.client?.commandPrefix,
      textCommands: interaction.client?.textCommands,
      slashCommands: interaction.client?.slashCommands,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
