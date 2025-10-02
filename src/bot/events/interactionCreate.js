const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../util/replies');
const GitMonitor = require('../services/gitMonitor');

module.exports = ({ client, logger, slashCommands, gitMonitor, requestRestart, updateChannelId }) => {
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

    if (interaction.isButton() && interaction.customId === GitMonitor.UPDATE_BUTTON_ID) {
      if (updateChannelId && interaction.channelId !== updateChannelId) {
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        const permissionEmbed = createEmbed({
          title: 'Permission required',
          description: 'You need the **Manage Server** permission to confirm updates.',
        });

        await interaction.reply({
          embeds: [permissionEmbed],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const { pullResult, pushResult } = await gitMonitor.applyRemoteUpdates();
        const changeCount = pullResult?.summary?.changes ?? 0;
        const pushStatus = pushResult?.pushed?.length ? 'pushed' : 'up-to-date';

        const successEmbed = createEmbed({
          title: 'Update applied',
          description: `Pull complete (**${changeCount}** changes). Push status: **${pushStatus}**. Restarting...`,
        });

        await interaction.editReply({
          embeds: [successEmbed],
        });

        if (interaction.message?.components?.length) {
          const [row] = interaction.message.components;
          const [button] = row.components;
          if (button) {
            const disabledButton = ButtonBuilder.from(button)
              .setDisabled(true)
              .setStyle(ButtonStyle.Success)
              .setLabel('Updated');

            const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
            await interaction.message.edit({ components: [disabledRow] });
          }
        }

        requestRestart();
      } catch (error) {
        logger.error('Failed to apply git updates:', error);
        const failureEmbed = createEmbed({
          title: 'Update failed',
          description: `Failed to update: ${error.message}`,
        });

        await interaction.editReply({
          embeds: [failureEmbed],
        });
      }
    }
  });
};
