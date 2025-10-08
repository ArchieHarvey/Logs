const { createEmbed, replyWithEmbed } = require('../../../util/replies');
const {
  ownerManagerId,
  isOwnerManager,
  syncOwnersFromDatabase,
  getOwnerIds,
  addOwner,
  removeOwner,
  formatOwnerList,
  parseUserIdInput,
} = require('../../../util/owners');

const EMBED_COLORS = {
  info: 0x5865f2,
  success: 0x3ba55d,
  warning: 0xffa500,
  danger: 0xed4245,
};

module.exports = {
  name: 'owners',
  description: 'Manage the list of bot owners (restricted to the owner manager).',
  usage: '!owners <list|add|remove> [user]',
  category: 'owner',
  async execute({ message, args }) {
    if (!ownerManagerId) {
      await replyWithEmbed(message, {
        title: 'Owner manager not configured',
        description: 'Set `BOT_OWNER_MANAGER_ID` in the environment before using this command.',
        color: EMBED_COLORS.danger,
      });
      return;
    }

    if (!isOwnerManager(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Access denied',
        description: 'Only the designated owner manager can update the owner list.',
        color: EMBED_COLORS.danger,
      });
      return;
    }

    const mongoService = message.client.mongoService;
    if (!mongoService?.isConfigured?.()) {
      await replyWithEmbed(message, {
        title: 'MongoDB required',
        description: 'Configure MongoDB before attempting to manage owners.',
        color: EMBED_COLORS.warning,
      });
      return;
    }

    try {
      await syncOwnersFromDatabase(mongoService);
    } catch (error) {
      await replyWithEmbed(message, {
        title: 'Owner sync failed',
        description: `Unable to load owners from MongoDB: ${error.message}`,
        color: EMBED_COLORS.danger,
      });
      return;
    }

    const subcommandInput = args.shift();
    const subcommand = subcommandInput ? subcommandInput.toLowerCase() : 'list';

    if (subcommand === 'list') {
      const owners = getOwnerIds();
      await replyWithEmbed(message, {
        title: 'Configured bot owners',
        description: formatOwnerList(owners),
        color: EMBED_COLORS.info,
      });
      return;
    }

    if (subcommand === 'add') {
      const mention = message.mentions.users.first();
      const rawInput = mention ? mention.id : args.shift();
      const userId = mention ? mention.id : parseUserIdInput(rawInput);

      if (!userId) {
        await replyWithEmbed(message, {
          title: 'Invalid user',
          description: 'Provide a valid Discord user ID or mention to add as an owner.',
          color: EMBED_COLORS.warning,
        });
        return;
      }

      const result = await addOwner(mongoService, userId, { addedBy: message.author.id });

      await replyWithEmbed(message, {
        title: result.alreadyOwner ? 'Owner already exists' : 'Owner added',
        description: result.alreadyOwner
          ? `<@${userId}> is already listed as a bot owner.`
          : `<@${userId}> has been added to the bot owner list.`,
        color: result.alreadyOwner ? EMBED_COLORS.warning : EMBED_COLORS.success,
      });
      return;
    }

    if (subcommand === 'remove') {
      const mention = message.mentions.users.first();
      const rawInput = mention ? mention.id : args.shift();
      const userId = mention ? mention.id : parseUserIdInput(rawInput);

      if (!userId) {
        await replyWithEmbed(message, {
          title: 'Invalid user',
          description: 'Provide a valid Discord user ID or mention to remove.',
          color: EMBED_COLORS.warning,
        });
        return;
      }

      const result = await removeOwner(mongoService, userId);

      let embed;
      if (result.isManager) {
        embed = createEmbed({
          title: 'Cannot remove manager',
          description: 'The owner manager cannot remove their own access.',
          color: EMBED_COLORS.danger,
        });
      } else if (result.notOwner) {
        embed = createEmbed({
          title: 'Owner not found',
          description: `No owner entry was found for ID \`${userId}\`.`,
          color: EMBED_COLORS.warning,
        });
      } else {
        embed = createEmbed({
          title: 'Owner removed',
          description: `User ID \`${userId}\` has been removed from the owner list.`,
          color: EMBED_COLORS.danger,
        });
      }

      await replyWithEmbed(message, embed);
      return;
    }

    await replyWithEmbed(message, {
      title: 'Unknown subcommand',
      description: 'Use `list`, `add`, or `remove` when managing owners.',
      color: EMBED_COLORS.warning,
    });
  },
};
