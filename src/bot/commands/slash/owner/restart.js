const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../../util/owners');
const { beginPowerSession, registerSessionMessage, POWER_ACTIONS } = require('../../common/power');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Request a controlled bot restart with confirmation.'),
  category: 'owner',
  ownerOnly: true,
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: 'This command is restricted to bot owners.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = beginPowerSession({
      action: POWER_ACTIONS.RESTART,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
    });

    if (result.error) {
      await interaction.reply({
        embeds: [result.embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply(result.prompt);
    const message = await interaction.fetchReply();
    registerSessionMessage(result.session.id, message);
  },
};
