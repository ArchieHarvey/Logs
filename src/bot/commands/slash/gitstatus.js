const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const simpleGit = require('simple-git');
const path = require('node:path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gitstatus')
    .setDescription('Show the current Git synchronization status.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const git = simpleGit({ baseDir: path.resolve(process.cwd()) });
      const status = await git.status();

      const embed = new EmbedBuilder()
        .setTitle('Repository status')
        .setDescription('Current git synchronization summary')
        .addFields(
          { name: 'Branch', value: status.current || 'Unknown', inline: true },
          { name: 'Tracking', value: status.tracking || 'None', inline: true },
          { name: 'Ahead', value: String(status.ahead || 0), inline: true },
          { name: 'Behind', value: String(status.behind || 0), inline: true },
          { name: 'Changes', value: status.files.length.toString(), inline: true },
        )
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `Failed to read git status: ${error.message}`,
      });
    }
  },
};
