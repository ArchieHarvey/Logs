const { PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../util/replies');
const GitMonitor = require('../services/gitMonitor');

module.exports = ({ client, logger, slashCommands, gitMonitor, requestRestart, updateChannelId, clearUpdatePrompt }) => {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = slashCommands.get(interaction.commandName);
      if (!command) {
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing slash command ${interaction.commandName}:`, error);
        const errorEmbed = createEmbed({
          title: 'Command error',
          description: 'There was an error while executing this command.',
        });
        const replyContent = { embeds: [errorEmbed], ephemeral: true };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyContent);
        } else {
          await interaction.reply(replyContent);
        }
      }
      return;
    }

    if (!interaction.isButton()) {
      return;
    }

    const isConfirm = interaction.customId === GitMonitor.UPDATE_CONFIRM_BUTTON_ID;
    const isDecline = interaction.customId === GitMonitor.UPDATE_DECLINE_BUTTON_ID;

    if (!isConfirm && !isDecline) {
      return;
    }

    if (updateChannelId && interaction.channelId !== updateChannelId) {
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      const permissionEmbed = createEmbed({
        title: 'Permission required',
        description: 'You need the **Manage Server** permission to manage repository updates.',
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [permissionEmbed],
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          embeds: [permissionEmbed],
          ephemeral: true,
        });
      }

      return;
    }

    if (isDecline) {
      await interaction.deferUpdate();

      const dismissedEmbed = createEmbed({
        title: 'Update dismissed',
        description: `The pending repository update was dismissed by **${interaction.user.tag}**.`,
        color: 0xffa500,
      });

      await interaction.message.edit({
        embeds: [dismissedEmbed],
        components: [],
      });

      await interaction.followUp({
        embeds: [
          createEmbed({
            title: 'Update dismissed',
            description: 'You can rerun the git monitor when you are ready to update.',
            color: 0xffa500,
          }),
        ],
        ephemeral: true,
      });

      clearUpdatePrompt?.();
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { pullResult, pushResult } = await gitMonitor.applyRemoteUpdates();
      const changeCount = pullResult?.summary?.changes ?? 0;
      const pushStatus = pushResult?.pushed?.length ? 'pushed' : 'up-to-date';
      const changeLabel = changeCount === 1 ? 'change' : 'changes';

      const successEmbed = createEmbed({
        title: 'Update approved',
        color: 0x3ba55d,
        description: [
          `Pulled **${changeCount}** ${changeLabel}.`,
          `Push status: **${pushStatus}**.`,
          'The bot is restarting to apply the latest changes.',
        ].join('\n'),
      });

      await interaction.editReply({
        embeds: [successEmbed],
      });

      const resolvedEmbed = createEmbed({
        title: 'Update scheduled',
        description: `Update approved by **${interaction.user.tag}**. The bot will restart shortly.`,
        color: 0x3ba55d,
      });

      await interaction.message.edit({
        embeds: [resolvedEmbed],
        components: [],
      });

      requestRestart();
      clearUpdatePrompt?.();
    } catch (error) {
      logger.error('Failed to apply git updates:', error);
      const failureEmbed = createEmbed({
        title: 'Update failed',
        description: `Failed to update: ${error.message}`,
        color: 0xed4245,
      });

      await interaction.editReply({
        embeds: [failureEmbed],
      });

      const failureNoticeEmbed = createEmbed({
        title: 'Update attempt failed',
        description: 'The automated pull could not be completed. Please resolve the issue manually before retrying.',
        color: 0xed4245,
      });

      await interaction.message.edit({
        embeds: [failureNoticeEmbed],
        components: [],
      });

      clearUpdatePrompt?.();
    }
  });
};
