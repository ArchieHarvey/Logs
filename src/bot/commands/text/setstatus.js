const { ActivityType } = require('discord.js');
const { replyWithEmbed } = require('../../util/replies');
const { isOwner } = require('../../util/owners');

const VALID_STATUSES = new Map([
  ['online', 'online'],
  ['idle', 'idle'],
  ['dnd', 'dnd'],
  ['do-not-disturb', 'dnd'],
  ['invisible', 'invisible'],
]);

const ACTIVITY_TYPES = new Map([
  ['playing', ActivityType.Playing],
  ['listening', ActivityType.Listening],
  ['watching', ActivityType.Watching],
  ['competing', ActivityType.Competing],
]);

function buildUsage(prefix) {
  return [
    `Usage: \`${prefix}setstatus <status> [activity] [message]\``,
    'Statuses: online, idle, dnd, invisible',
    'Activities: playing, listening, watching, competing',
    'Example: `setstatus dnd playing Maintaining the server`',
  ].join('\n');
}

module.exports = {
  name: 'setstatus',
  description: 'Update the bot\'s status and activity.',
  async execute({ message, args, prefix }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can use this command.',
        color: 0xed4245,
      });
      return;
    }

    if (!args.length) {
      await replyWithEmbed(message, {
        title: 'Set status',
        description: buildUsage(prefix),
      });
      return;
    }

    const statusArg = args.shift().toLowerCase();
    const resolvedStatus = VALID_STATUSES.get(statusArg);

    if (!resolvedStatus) {
      await replyWithEmbed(message, {
        title: 'Invalid status',
        description: buildUsage(prefix),
        color: 0xed4245,
      });
      return;
    }

    let activityTypeArg = args.length > 0 ? args[0].toLowerCase() : null;
    let activityText = '';

    if (activityTypeArg && ACTIVITY_TYPES.has(activityTypeArg)) {
      args.shift();
      activityText = args.join(' ').trim();
    } else {
      activityText = [activityTypeArg, ...args.slice(1)].filter(Boolean).join(' ').trim();
      activityTypeArg = null;
    }

    const activities = [];

    if (activityText) {
      const resolvedActivity = ACTIVITY_TYPES.get(activityTypeArg) || ActivityType.Playing;
      activities.push({ name: activityText, type: resolvedActivity });
    }

    try {
      await message.client.user.setPresence({
        status: resolvedStatus,
        activities,
      });
    } catch (error) {
      await replyWithEmbed(message, {
        title: 'Status update failed',
        description: `Unable to update the bot status: ${error.message}`,
        color: 0xed4245,
      });
      return;
    }

    const descriptionLines = [`Status set to **${resolvedStatus}**.`];

    if (activityText) {
      const activityLabel = activityTypeArg ?? 'playing';
      descriptionLines.push(`Activity set to **${activityLabel} ${activityText}**.`);
    } else {
      descriptionLines.push('Activity cleared.');
    }

    await replyWithEmbed(message, {
      title: 'Status updated',
      description: descriptionLines.join('\n'),
      color: 0x3ba55d,
    });
  },
};
