const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { replyWithEmbed } = require('../../../util/replies');
const { buildHelpMenu } = require('../../../util/help');

module.exports = {
  name: 'help',
  description: 'Show available commands and how to use them.',
  category: 'utility',
  async execute({ message, textCommands, prefix, client }) {
    const menu = buildHelpMenu({
      prefix,
      textCommands,
      slashCommands: client?.slashCommands,
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

    await replyWithEmbed(message, embed, { components });
  },
};
