const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildMongoStatusReport } = require('../common/mongoStats');
const { isOwner } = require('../../util/owners');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mongostats')
    .setDescription('Check the MongoDB connection status and database statistics.'),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: 'This command is restricted to bot owners.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mongoService = interaction.client.mongoService;
    const report = await buildMongoStatusReport(mongoService);

    await interaction.editReply({ content: report.content });
  },
};
