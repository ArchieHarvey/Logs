const { replyWithEmbed } = require('../../util/replies');
const { buildGitStatusEmbed } = require('../common/gitStatus');

module.exports = {
  name: 'gitstatus',
  description: 'Show the current Git synchronization status.',
  async execute({ message }) {
    try {
      const embed = await buildGitStatusEmbed();
      await replyWithEmbed(message, embed);
    } catch (error) {
      await replyWithEmbed(message, {
        title: 'Git status error',
        description: `Failed to read git status: ${error.message}`,
        color: 0xed4245,
      });
    }
  },
};
