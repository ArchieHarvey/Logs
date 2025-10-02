const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createEmbed } = require('../../util/replies');
const { isOwner } = require('../../util/owners');
const { buildReloadActionRow } = require('../common/reloadCommands');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reloadcommands')
    .setDescription('Reload the bot\'s slash commands.'),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: 'This command is restricted to bot owners.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = createEmbed({
      title: 'Reload slash commands',
      description: [
        'Choose how you would like to reload slash commands.',
        'Guild reload updates commands for this server only. Global reloads are currently disabled.',
      ].join('\n\n'),
    });

    await interaction.reply({
      embeds: [embed],
      components: [buildReloadActionRow()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
