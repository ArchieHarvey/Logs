const {
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
} = require('discord.js');
const { createEmbed } = require('../util/replies');
const GitMonitor = require('../services/gitMonitor');
const { GUILD_RELOAD_BUTTON_ID, GLOBAL_RELOAD_BUTTON_ID } = require('../commands/common/reloadCommands');
const { isOwner } = require('../util/owners');
const {
  parseCustomId: parsePowerCustomId,
  resolvePowerSession,
  cancelPowerSession,
} = require('../commands/common/power');

function disableInteractionButtons(message) {
  if (!message?.components?.length) {
    return null;
  }

  let hasButton = false;
  const disabledRows = message.components.map((row) => {
    const disabledRow = ActionRowBuilder.from(row);
    disabledRow.setComponents(
      disabledRow.components.map((component) => {
        if (component.data?.type !== ComponentType.Button) {
          return component;
        }

        hasButton = true;
        return ButtonBuilder.from(component).setDisabled(true);
      }),
    );
    return disabledRow;
  });

  return hasButton ? disabledRows : null;
}

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
        const replyContent = { embeds: [errorEmbed], flags: MessageFlags.Ephemeral };

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

    if (interaction.customId === GUILD_RELOAD_BUTTON_ID) {
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({
          content: 'Only bot owners can reload slash commands.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (typeof interaction.client.reloadSlashCommands !== 'function') {
        await interaction.reply({
          embeds: [
            createEmbed({
              title: 'Reload unavailable',
              description: 'The bot is not configured to reload commands automatically.',
              color: 0xed4245,
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const { count } = await interaction.client.reloadSlashCommands({ guildOnly: true });
        await interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Slash commands reloaded',
              description: `Reloaded **${count}** slash ${count === 1 ? 'command' : 'commands'} for this guild.`,
              color: 0x3ba55d,
            }),
          ],
        });

        const disabledComponents = disableInteractionButtons(interaction.message);
        if (disabledComponents) {
          try {
            await interaction.message.edit({
              embeds: [
                createEmbed({
                  title: 'Reload complete',
                  description: `Guild slash commands reloaded by **${interaction.user.tag}**.`,
                  color: 0x3ba55d,
                }),
              ],
              components: disabledComponents,
            });
          } catch (error) {
            logger.warn('Failed to update reload command message:', error);
          }
        }
      } catch (error) {
        logger.error('Failed to reload slash commands:', error);
        await interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Reload failed',
              description: `Unable to reload slash commands: ${error.message}`,
              color: 0xed4245,
            }),
          ],
        });
      }

      return;
    }

    if (interaction.customId === GLOBAL_RELOAD_BUTTON_ID) {
      await interaction.reply({
        content: 'Global reloads are currently disabled.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const powerAction = parsePowerCustomId(interaction.customId);
    if (powerAction) {
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({
          content: 'Only bot owners can manage power controls.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (powerAction.decision === 'confirm') {
        const resolution = await resolvePowerSession(powerAction.sessionId, {
          approved: true,
          actor: interaction.user,
          client: interaction.client,
        });

        if (resolution?.error === 'expired') {
          await interaction.reply({
            content: 'This power action request has already expired.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (resolution?.error) {
          await interaction.reply({
            content: 'This power action request could not be found.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          embeds: [resolution.embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const cancellation = await cancelPowerSession(powerAction.sessionId, {
        actor: interaction.user,
        reason: `Cancelled by ${interaction.user.tag}.`,
      });

      if (cancellation?.error) {
        await interaction.reply({
          content: 'This power action request has already been resolved.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        embeds: [cancellation.embed],
        flags: MessageFlags.Ephemeral,
      });
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
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [permissionEmbed],
          flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
      });

      clearUpdatePrompt?.();
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const disabledComponents = disableInteractionButtons(interaction.message);
      if (disabledComponents) {
        await interaction.message.edit({ components: disabledComponents });
      }
    } catch (error) {
      logger.warn('Failed to disable update buttons after confirmation:', error);
    }

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
