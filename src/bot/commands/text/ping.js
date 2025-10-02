const { replyWithEmbed } = require('../../util/replies');
const { buildLatencyEmbed } = require('../../util/ping');

module.exports = {
  name: 'ping',
  description: "Check the bot's latency.",
  async execute({ message }) {
    const sent = await replyWithEmbed(message, {
      description: 'Pinging... ⏱️',
    });

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const wsPing = message.client?.ws?.ping;
    const resultEmbed = buildLatencyEmbed({ roundTrip: latency, wsPing });

    await sent.edit({ embeds: [resultEmbed] });
  },
};