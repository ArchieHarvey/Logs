const { replyWithEmbed } = require('../../util/replies');
const { buildMongoStatusReport } = require('../common/mongoStats');
const { isOwner } = require('../../util/owners');

module.exports = {
  name: 'mongostats',
  description: 'Check the MongoDB connection status and database statistics.',
  async execute({ message }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can use this command.',
        color: 0xed4245,
      });
      return;
    }

    const mongoService = message.client.mongoService;
    const report = await buildMongoStatusReport(mongoService);

    await replyWithEmbed(message, {
      description: report.content,
    });
  },
};
