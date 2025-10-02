module.exports = {
  name: 'ping',
  description: 'Check the bot\'s latency.',
  async execute({ message }) {
    const sent = await message.reply({ content: 'Pinging...' });
    const latency = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit(`Pong! Round-trip latency: ${latency}ms.`);
  },
};
