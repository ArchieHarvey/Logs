const { replyWithEmbed, createEmbed } = require('../../util/replies');
const { isOwner } = require('../../util/owners');
const { buildReloadActionRow } = require('../common/reloadCommands');

module.exports = {
  name: 'reloadcommands',
  description: 'Reload the bot\'s slash commands for this guild.',
  async execute({ message }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can use this command.',
        color: 0xed4245,
      });
      return;
    }

    const embed = createEmbed({
      title: 'Reload slash commands',
      description: [
        'Choose how you would like to reload slash commands.',
        'Guild reload updates commands for this server only. Global reloads are currently disabled.',
      ].join('\n\n'),
    });

    await message.reply({
      embeds: [embed],
      components: [buildReloadActionRow()],
      allowedMentions: { repliedUser: false },
    });
  },
};
