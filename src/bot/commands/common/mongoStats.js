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

async function buildMongoStatusReport(mongoService) {
  if (!mongoService || typeof mongoService.isConfigured !== 'function') {
    return {
      success: false,
      content:
        '**MongoDB not available**\nThe MongoDB service is not configured for this bot instance.',
    };
  }

  if (!mongoService.isConfigured()) {
    return {
      success: false,
      content:
        '**MongoDB not configured**\nSet the **MONGODB_URI** environment variable to enable MongoDB features.',
    };
  }

  try {
    await mongoService.connect();
  } catch (error) {
    return {
      success: false,
      content: ['**MongoDB connection failed**', '```', error.message, '```'].join('\n'),
    };
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

    return {
      success: true,
      content: lines.join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      content: [
        '**MongoDB status error**',
        'Failed to retrieve MongoDB statistics.',
        '```',
        error.message,
        '```',
      ].join('\n'),
    };
  }
}

module.exports = {
  buildMongoStatusReport,
};
