const { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildHelpMenu } = require('../../../util/help');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands.'),
  category: 'utility',
  async execute(interaction) {
    const menu = buildHelpMenu({
      prefix: interaction.client?.commandPrefix,
      textCommands: interaction.client?.textCommands,
      slashCommands: interaction.client?.slashCommands,
    });

    const embed = menu.embedsByValue.get(menu.overviewValue);
    const components = [];

    if (menu.options.length) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(menu.customId)
        .setPlaceholder(menu.placeholder)
        .addOptions(menu.options.map((option) => ({ ...option })));

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    await interaction.reply({ embeds: [embed], components });
  },
};
