const { EmbedBuilder } = require('discord.js');

const DEFAULT_COLOR = 0x2b2d31;

function createEmbed(options = {}) {
  const { title, description, fields, color = DEFAULT_COLOR, footer, timestamp = true } = options;
  const embed = new EmbedBuilder();

  if (title) {
    embed.setTitle(title);
  }

  if (description) {
    embed.setDescription(description);
  }

  if (Array.isArray(fields) && fields.length > 0) {
    embed.addFields(fields);
  }

  if (color) {
    embed.setColor(color);
  }

  if (footer) {
    embed.setFooter(footer);
  }

  if (timestamp) {
    embed.setTimestamp(new Date());
  }

  return embed;
}

function ensureEmbed(embedOrOptions) {
  if (embedOrOptions instanceof EmbedBuilder) {
    return embedOrOptions;
  }

  return createEmbed(embedOrOptions);
}

function replyWithEmbed(message, embedOrOptions, extraOptions = {}) {
  const embed = ensureEmbed(embedOrOptions);

  return message.reply({
    embeds: [embed],
    allowedMentions: { repliedUser: false },
    ...extraOptions,
  });
}

module.exports = {
  DEFAULT_COLOR,
  createEmbed,
  replyWithEmbed,
};
