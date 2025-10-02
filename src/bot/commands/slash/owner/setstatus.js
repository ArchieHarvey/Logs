const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createEmbed } = require('../../../util/replies');
const { isOwner } = require('../../../util/owners');
const {
  PRESENCE_STATUSES,
  ACTIVITY_TYPES,
  getPresenceFromClient,
  normalizePresence,
  applyPresence,
  savePresence,
} = require('../../common/presence');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Update the bot\'s status and activity.')
    .addStringOption((option) =>
      option
        .setName('status')
        .setDescription('Presence status to use.')
        .addChoices(...PRESENCE_STATUSES)
    )
    .addStringOption((option) =>
      option
        .setName('activity_type')
        .setDescription('Type of activity to display.')
        .addChoices(...ACTIVITY_TYPES.map(({ name, value }) => ({ name, value })))
    )
    .addStringOption((option) =>
      option
        .setName('activity_text')
        .setDescription('Activity text (e.g. Playing __).')
        .setMaxLength(128)
    ),
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mongoService = interaction.client.mongoService;
    const currentPresence = normalizePresence(getPresenceFromClient(interaction.client));

    const statusInput = interaction.options.getString('status');
    const activityTypeInput = interaction.options.getString('activity_type');
    const activityTextInput = interaction.options.getString('activity_text');

    const nextPresence = {
      status: statusInput ?? currentPresence.status,
      activityType: activityTypeInput ?? currentPresence.activityType,
      activityText: activityTextInput !== null ? activityTextInput?.trim() ?? '' : currentPresence.activityText,
    };

    if (activityTextInput !== null) {
      if (!nextPresence.activityText) {
        nextPresence.activityType = null;
      } else if (!nextPresence.activityType) {
        nextPresence.activityType = 'playing';
      }
    }

    const previousPresence = currentPresence;

    try {
      await applyPresence(interaction.client, nextPresence);
    } catch (error) {
      const errorEmbed = createEmbed({
        title: 'Status update failed',
        description: `Unable to update the bot status: ${error.message}`,
        color: 0xed4245,
      });

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    try {
      await savePresence(mongoService, nextPresence);
    } catch (error) {
      await applyPresence(interaction.client, previousPresence).catch(() => {});

      const errorEmbed = createEmbed({
        title: 'Status update failed',
        description: `Unable to persist the change, so the previous presence has been restored: ${error.message}`,
        color: 0xed4245,
      });

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const descriptionLines = [`Status set to **${nextPresence.status}**.`];

    if (nextPresence.activityText) {
      const activityLabel = nextPresence.activityType ?? 'playing';
      descriptionLines.push(`Activity set to **${activityLabel} ${nextPresence.activityText}**.`);
    } else {
      descriptionLines.push('Activity cleared.');
    }

    const resultEmbed = createEmbed({
      title: 'Status updated',
      description: descriptionLines.join('\n'),
      color: 0x3ba55d,
    });

    await interaction.editReply({ embeds: [resultEmbed] });
  },
};