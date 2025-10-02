const { SlashCommandBuilder, MessageFlags, ActivityType } = require('discord.js');
const { createEmbed } = require('../../util/replies');
const { isOwner } = require('../../util/owners');

const PRESENCE_STATUSES = [
  { name: 'Online', value: 'online' },
  { name: 'Idle', value: 'idle' },
  { name: 'Do Not Disturb', value: 'dnd' },
  { name: 'Invisible', value: 'invisible' },
];

const ACTIVITY_TYPES = [
  { name: 'Playing', value: 'playing', type: ActivityType.Playing },
  { name: 'Listening', value: 'listening', type: ActivityType.Listening },
  { name: 'Watching', value: 'watching', type: ActivityType.Watching },
  { name: 'Competing', value: 'competing', type: ActivityType.Competing },
];

const activityTypeMap = ACTIVITY_TYPES.reduce((map, activity) => {
  map.set(activity.value, activity.type);
  return map;
}, new Map());

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
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: 'This command is restricted to bot owners.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const status = interaction.options.getString('status') ?? interaction.client?.user?.presence?.status ?? 'online';
    const activityTypeValue = interaction.options.getString('activity_type');
    const activityText = interaction.options.getString('activity_text')?.trim();

    const activities = [];

    if (activityText) {
      const resolvedType = activityTypeValue ? activityTypeMap.get(activityTypeValue) : ActivityType.Playing;
      activities.push({ name: activityText, type: resolvedType });
    }

    try {
      await interaction.client.user.setPresence({
        status,
        activities,
      });
    } catch (error) {
      const errorEmbed = createEmbed({
        title: 'Status update failed',
        description: `Unable to update the bot status: ${error.message}`,
        color: 0xed4245,
      });

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const descriptionLines = [`Status set to **${status}**.`];

    if (activityText) {
      const activityLabel = activityTypeValue ?? 'playing';
      descriptionLines.push(`Activity set to **${activityLabel} ${activityText}**.`);
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
