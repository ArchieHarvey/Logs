const { replyWithEmbed } = require('../../../util/replies');
const { isOwner } = require('../../../util/owners');
const { beginPowerSession, registerSessionMessage, POWER_ACTIONS } = require('../../common/power');

module.exports = {
  name: 'restart',
  description: 'Open a managed restart prompt with confirmation controls.',
  category: 'owner',
  ownerOnly: true,
  async execute({ message }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can request a restart.',
        color: 0xed4245,
      });
      return;
    }

    const result = beginPowerSession({
      action: POWER_ACTIONS.RESTART,
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
