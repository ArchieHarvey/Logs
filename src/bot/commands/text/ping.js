const { createEmbed, replyWithEmbed } = require('../../util/replies');

module.exports = {
  name: 'ping',
  description: "Check the bot's latency.",
  async execute({ message }) {
    const sent = await replyWithEmbed(message, {
      description: 'Pinging... ⏱️',
    });

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const resultEmbed = createEmbed({
      description: `Pong! Round-trip latency: **${latency}ms**.`,
    });

    await sent.edit({ embeds: [resultEmbed] });
  },
};