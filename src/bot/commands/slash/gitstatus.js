const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildGitStatusEmbed } = require('../common/gitStatus');
const { createEmbed } = require('../../util/replies');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gitstatus')
    .setDescription('Show the current Git synchronization status.'),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const embed = await buildGitStatusEmbed();
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorEmbed = createEmbed({
        title: 'Git status error',
        description: `Failed to read git status: ${error.message}`,
      });

      await interaction.editReply({
        embeds: [errorEmbed],
      });
    }
  },
};