const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../../config');
const { createEmbed } = require('../../util/replies');

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
      const embed = createEmbed({
        title: 'MongoDB not configured',
        description: 'Set the **MONGODB_URI** environment variable to enable MongoDB features.',
        color: 0xffa500,
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    try {
      await mongoService.connect();
    } catch (error) {
      const embed = createEmbed({
        title: 'MongoDB connection failed',
        description: `Unable to connect to MongoDB.\n\n\`\`\`${error.message}\`\`\``,
        color: 0xed4245,
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    try {
      const pingMs = await mongoService.ping();
      const stats = await mongoService.getDatabaseStats();

      const embed = createEmbed({
        title: 'MongoDB status',
        color: 0x1f6feb,
        fields: [
          {
            name: 'Connection',
            value: 'Connected ✅',
            inline: true,
          },
          {
            name: 'Ping',
            value: `${pingMs} ms`,
            inline: true,
          },
          {
            name: 'Database',
            value: stats.db || 'Unknown',
            inline: true,
          },
          {
            name: 'Collections',
            value: numberFormatter.format(stats.collections ?? 0),
            inline: true,
          },
          {
            name: 'Documents',
            value: numberFormatter.format(stats.objects ?? 0),
            inline: true,
          },
          {
            name: 'Indexes',
            value: numberFormatter.format(stats.indexes ?? 0),
            inline: true,
          },
          {
            name: 'Data Size',
            value: formatBytes(stats.dataSize),
            inline: true,
          },
          {
            name: 'Storage Size',
            value: formatBytes(stats.storageSize),
            inline: true,
          },
          {
            name: 'Index Size',
            value: formatBytes(stats.indexSize),
            inline: true,
          },
        ],
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = createEmbed({
        title: 'MongoDB status error',
        description: `Failed to retrieve MongoDB statistics.\n\n\`\`\`${error.message}\`\`\``,
        color: 0xed4245,
      });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
