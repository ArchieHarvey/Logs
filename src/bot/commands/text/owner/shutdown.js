const { replyWithEmbed } = require('../../../util/replies');
const { isOwner } = require('../../../util/owners');
const { beginPowerSession, registerSessionMessage, POWER_ACTIONS } = require('../../common/power');

module.exports = {
  name: 'shutdown',
  description: 'Initiate a graceful shutdown prompt with confirmations.',
  category: 'owner',
  ownerOnly: true,
  async execute({ message }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can shut down the bot.',
        color: 0xed4245,
      });
      return;
    }

    const result = beginPowerSession({
      action: POWER_ACTIONS.SHUTDOWN,
      userId: message.author.id,
      userTag: message.author.tag,
    });

    if (result.error) {
      await replyWithEmbed(message, result.embed);
      return;
    }

    const responseMessage = await message.reply({
      ...result.prompt,
      allowedMentions: { repliedUser: false },
    });

    registerSessionMessage(result.session.id, responseMessage);
  },
};
