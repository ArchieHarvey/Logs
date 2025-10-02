const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../../config');

const ownerIdSet = new Set(config.ownerIds || []);
const numberFormatter = new Intl.NumberFormat('en-US');

function formatBytes(value) {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 'Unknown';
  }

  if (numericValue === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = numericValue;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 || unitIndex === 0 ? 0 : 2;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mongostats')
    .setDescription('Check the MongoDB connection status and database statistics.'),
  async execute(interaction) {
    if (!ownerIdSet.has(interaction.user.id)) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.deleteReply().catch(() => {});
      }

      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mongoService = interaction.client.mongoService;

    if (!mongoService || !mongoService.isConfigured()) {
      await interaction.editReply({
        content:
          '**MongoDB not configured**\nSet the **MONGODB_URI** environment variable to enable MongoDB features.',
      });
      return;
    }

    try {
      await mongoService.connect();
    } catch (error) {
      await interaction.editReply({
        content: ['**MongoDB connection failed**', '```', error.message, '```'].join('\n'),
      });
      return;
    }

    try {
      const pingMs = await mongoService.ping();
      const stats = await mongoService.getDatabaseStats();
      const lines = [
        '**MongoDB status**',
        '',
        'Connection: Connected ✅',
        `Ping: ${pingMs} ms`,
        `Database: ${stats.db || 'Unknown'}`,
        `Collections: ${numberFormatter.format(stats.collections ?? 0)}`,
        `Documents: ${numberFormatter.format(stats.objects ?? 0)}`,
        `Indexes: ${numberFormatter.format(stats.indexes ?? 0)}`,
        `Data Size: ${formatBytes(stats.dataSize)}`,
        `Storage Size: ${formatBytes(stats.storageSize)}`,
        `Index Size: ${formatBytes(stats.indexSize)}`,
      ];

      await interaction.editReply({ content: lines.join('\n') });
    } catch (error) {
      await interaction.editReply({
        content: ['**MongoDB status error**', 'Failed to retrieve MongoDB statistics.', '```', error.message, '```'].join('\n'),
      });
    }
  },
};
