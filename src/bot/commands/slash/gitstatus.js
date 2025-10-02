const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const simpleGit = require('simple-git');
const path = require('node:path');
const { createEmbed } = require('../../util/replies');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gitstatus')
    .setDescription('Show the current Git synchronization status.'),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const git = simpleGit({ baseDir: path.resolve(process.cwd()) });
      const status = await git.status();

      const embed = createEmbed({
        title: 'Repository status',
        description: 'Current git synchronization summary',
        fields: [
          { name: 'Branch', value: status.current || 'Unknown', inline: true },
          { name: 'Tracking', value: status.tracking || 'None', inline: true },
          { name: 'Ahead', value: String(status.ahead || 0), inline: true },
          { name: 'Behind', value: String(status.behind || 0), inline: true },
          { name: 'Changes', value: status.files.length.toString(), inline: true },
        ],
      });

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