const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../util/replies');
const { buildLatencyEmbed } = require('../../util/ping');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency.'),
  async execute(interaction) {
    const sent = await interaction.reply({
      embeds: [createEmbed({ description: 'Pinging... ⏱️' })],
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client?.ws?.ping;
    await interaction.editReply({
      embeds: [buildLatencyEmbed({ roundTrip: latency, wsPing })],
    });
  },
};