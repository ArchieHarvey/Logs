const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createEmbed } = require('../../util/replies');
const {
  isOwnerManager,
  ownerManagerId,
  addOwner,
  removeOwner,
  syncOwnersFromDatabase,
  getOwnerIds,
  formatOwnerList,
  parseUserIdInput,
} = require('../../util/owners');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owners')
    .setDescription('Manage the list of bot owners.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a Discord user as a bot owner.')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to grant owner access to.').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a Discord user from the bot owner list.')
        .addStringOption((option) =>
          option
            .setName('userid')
            .setDescription('The Discord user ID to remove.')
            .setMinLength(4)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('Display all Discord user IDs with owner access.'),
    ),
  async execute(interaction) {
    if (!ownerManagerId) {
      await interaction.reply({
        content: 'An owner manager has not been configured. Set `BOT_OWNER_MANAGER_ID` before using this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!isOwnerManager(interaction.user.id)) {
      await interaction.reply({
        content: 'Only the designated owner manager can update owner access.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mongoService = interaction.client.mongoService;
    if (!mongoService?.isConfigured?.()) {
      await interaction.reply({
        content: 'MongoDB must be configured before owners can be managed via commands.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await syncOwnersFromDatabase(mongoService);
    } catch (error) {
      await interaction.reply({
        embeds: [
          createEmbed({
            title: 'Owner sync failed',
            description: `Unable to load owners from MongoDB: ${error.message}`,
            color: 0xed4245,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user', true);

      const result = await addOwner(mongoService, user.id, { addedBy: interaction.user.id });

      const embed = createEmbed({
        title: result.alreadyOwner ? 'Owner already exists' : 'Owner added',
        description: result.alreadyOwner
          ? `<@${user.id}> is already listed as a bot owner.`
          : `<@${user.id}> has been added to the bot owner list.`,
        color: result.alreadyOwner ? 0xffa500 : 0x3ba55d,
      });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'remove') {
      const rawInput = interaction.options.getString('userid', true);
      const userId = parseUserIdInput(rawInput);
      if (!userId) {
        await interaction.reply({
          embeds: [
            createEmbed({
              title: 'Invalid user ID',
              description: 'Provide a valid Discord user ID or mention.',
              color: 0xffa500,
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const result = await removeOwner(mongoService, userId);

      let embed;

      if (result.isManager) {
        embed = createEmbed({
          title: 'Cannot remove manager',
          description: 'The owner manager cannot remove their own access.',
          color: 0xed4245,
        });
      } else if (result.notOwner) {
        embed = createEmbed({
          title: 'Owner not found',
          description: `No owner entry was found for ID \`${userId}\`.`,
          color: 0xffa500,
        });
      } else {
        embed = createEmbed({
          title: 'Owner removed',
          description: `User ID \`${userId}\` has been removed from the owner list.`,
          color: 0xed4245,
        });
      }

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'list') {
      const owners = getOwnerIds();
      const embed = createEmbed({
        title: 'Configured bot owners',
        description: formatOwnerList(owners),
        color: 0x5865f2,
      });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
