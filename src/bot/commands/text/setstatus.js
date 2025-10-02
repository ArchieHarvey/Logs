const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
} = require('discord.js');
const { createEmbed, replyWithEmbed } = require('../../util/replies');
const { isOwner } = require('../../util/owners');
const {
  PRESENCE_STATUSES,
  ACTIVITY_TYPES,
  buildPresenceDescription,
  getPresenceFromClient,
  normalizePresence,
  applyPresence,
  savePresence,
} = require('../common/presence');

const CUSTOM_IDS = {
  STATUS_BUTTON: 'setstatus:status-button',
  STATUS_SELECT: 'setstatus:status-select',
  ACTIVITY_BUTTON: 'setstatus:activity-button',
  ACTIVITY_SELECT: 'setstatus:activity-select',
  TEXT_BUTTON: 'setstatus:text-button',
};

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_TEXT_TIMEOUT_MS = 60 * 1000;

function buildControlButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.STATUS_BUTTON)
      .setLabel('Status')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.ACTIVITY_BUTTON)
      .setLabel('Activity Type')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TEXT_BUTTON)
      .setLabel('Activity Text')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildStatusSelect(currentStatus) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_IDS.STATUS_SELECT)
      .setPlaceholder('Select a status')
      .addOptions(
        PRESENCE_STATUSES.map(({ name, value }) => ({
          label: name,
          value,
          default: value === currentStatus,
        })),
      ),
  );
}

function buildActivityTypeSelect(currentType) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_IDS.ACTIVITY_SELECT)
      .setPlaceholder('Select an activity type')
      .addOptions(
        ACTIVITY_TYPES.map(({ name, value }) => ({
          label: name,
          value,
          default: value === currentType,
        })),
      ),
  );
}

function buildPresenceEmbed(presence) {
  return createEmbed({
    title: 'Manage Bot Presence',
    description: buildPresenceDescription(presence),
  });
}

module.exports = {
  name: 'setstatus',
  description: 'Interactively update the bot\'s presence.',
  async execute({ message }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can use this command.',
        color: 0xed4245,
      });
      return;
    }

    const mongoService = message.client.mongoService;
    let currentPresence = normalizePresence(getPresenceFromClient(message.client));

    const responseMessage = await replyWithEmbed(
      message,
      buildPresenceEmbed(currentPresence),
      { components: [buildControlButtons()] },
    );

    let activeMenu = null;
    let textCollector = null;
    const collector = responseMessage.createMessageComponentCollector({
      time: SESSION_TIMEOUT_MS,
      filter: (interaction) => interaction.user.id === message.author.id && isOwner(interaction.user.id),
    });

    collector.on('end', async () => {
      if (!responseMessage.editable) {
        return;
      }

      const baseRow = buildControlButtons();
      const disabledButtons = new ActionRowBuilder().addComponents(
        ...baseRow.components.map((component) => ButtonBuilder.from(component).setDisabled(true)),
      );

      await responseMessage.edit({ components: [disabledButtons] }).catch(() => {});
    });

    const refreshMessage = async () => {
      if (!responseMessage.editable) {
        return;
      }

      const components = [buildControlButtons()];

      if (activeMenu === CUSTOM_IDS.STATUS_SELECT) {
        components.push(buildStatusSelect(currentPresence.status));
      } else if (activeMenu === CUSTOM_IDS.ACTIVITY_SELECT) {
        components.push(buildActivityTypeSelect(currentPresence.activityType));
      }

      await responseMessage.edit({
        embeds: [buildPresenceEmbed(currentPresence)],
        components,
      });
    };

    const persistPresence = async (nextPresence) => {
      if (
        nextPresence.status === currentPresence.status &&
        nextPresence.activityType === currentPresence.activityType &&
        nextPresence.activityText === currentPresence.activityText
      ) {
        return { success: true, updated: false };
      }

      const previousPresence = currentPresence;

      try {
        await applyPresence(message.client, nextPresence);
      } catch (error) {
        return { success: false, error: `Failed to update Discord presence: ${error.message}` };
      }

      try {
        await savePresence(mongoService, nextPresence);
      } catch (error) {
        await applyPresence(message.client, previousPresence).catch(() => {});
        return {
          success: false,
          error: `Unable to persist the change; the previous presence was restored: ${error.message}`,
        };
      }

      currentPresence = normalizePresence(nextPresence);
      return { success: true, updated: true };
    };

    collector.on('collect', async (interaction) => {
      try {
        if (interaction.customId === CUSTOM_IDS.STATUS_BUTTON) {
          activeMenu = activeMenu === CUSTOM_IDS.STATUS_SELECT ? null : CUSTOM_IDS.STATUS_SELECT;
          const components = [buildControlButtons()];
          if (activeMenu === CUSTOM_IDS.STATUS_SELECT) {
            components.push(buildStatusSelect(currentPresence.status));
          }

          await interaction.update({
            embeds: [buildPresenceEmbed(currentPresence)],
            components,
          });
          return;
        }

        if (interaction.customId === CUSTOM_IDS.ACTIVITY_BUTTON) {
          activeMenu = activeMenu === CUSTOM_IDS.ACTIVITY_SELECT ? null : CUSTOM_IDS.ACTIVITY_SELECT;
          const components = [buildControlButtons()];
          if (activeMenu === CUSTOM_IDS.ACTIVITY_SELECT) {
            components.push(buildActivityTypeSelect(currentPresence.activityType));
          }

          await interaction.update({
            embeds: [buildPresenceEmbed(currentPresence)],
            components,
          });
          return;
        }

        if (interaction.customId === CUSTOM_IDS.STATUS_SELECT && interaction.componentType === ComponentType.StringSelect) {
          const selectedStatus = interaction.values[0];

          const nextPresence = {
            ...currentPresence,
            status: selectedStatus,
          };

          const result = await persistPresence(nextPresence);
          if (!result.success) {
            await interaction.reply({ content: result.error, ephemeral: true }).catch(() => {});
            return;
          }

          activeMenu = null;
          await interaction.update({
            embeds: [buildPresenceEmbed(currentPresence)],
            components: [buildControlButtons()],
          });
          return;
        }

        if (interaction.customId === CUSTOM_IDS.ACTIVITY_SELECT && interaction.componentType === ComponentType.StringSelect) {
          const selectedType = interaction.values[0];

          const nextPresence = {
            ...currentPresence,
            activityType: selectedType,
          };

          const result = await persistPresence(nextPresence);
          if (!result.success) {
            await interaction.reply({ content: result.error, ephemeral: true }).catch(() => {});
            return;
          }

          activeMenu = null;
          await interaction.update({
            embeds: [buildPresenceEmbed(currentPresence)],
            components: [buildControlButtons()],
          });
          return;
        }

        if (interaction.customId === CUSTOM_IDS.TEXT_BUTTON) {
          activeMenu = null;

          if (textCollector) {
            textCollector.stop('replaced');
            textCollector = null;
          }

          await interaction.deferUpdate();
          await interaction.followUp({
            content:
              'Send the new activity text within 60 seconds. Reply with `clear` to remove the activity or `cancel` to abort.',
            ephemeral: true,
          });

          const filter = (msg) => msg.author.id === message.author.id;
          textCollector = message.channel.createMessageCollector({ filter, time: ACTIVITY_TEXT_TIMEOUT_MS, max: 1 });

          textCollector.on('collect', async (msg) => {
            const submitted = msg.content.trim();

            if (!submitted || submitted.toLowerCase() === 'cancel') {
              await interaction.followUp({ content: 'Activity update cancelled.', ephemeral: true }).catch(() => {});
              return;
            }

            const nextPresence = { ...currentPresence };

            if (submitted.toLowerCase() === 'clear') {
              nextPresence.activityText = '';
              nextPresence.activityType = null;
            } else {
              nextPresence.activityText = submitted.slice(0, 128);
              if (!nextPresence.activityType) {
                nextPresence.activityType = 'playing';
              }
            }

            const result = await persistPresence(nextPresence);
            if (!result.success) {
              await refreshMessage();
              await interaction.followUp({ content: result.error, ephemeral: true }).catch(() => {});
              return;
            }

            await refreshMessage();
            const confirmation = result.updated ? 'Activity updated.' : 'Activity left unchanged.';
            await interaction.followUp({ content: confirmation, ephemeral: true }).catch(() => {});
          });

          textCollector.on('end', async (collected, reason) => {
            if (reason === 'replaced') {
              return;
            }

            textCollector = null;

            if (collected.size === 0) {
              await interaction.followUp({
                content: 'No activity text received in time; keeping the previous value.',
                ephemeral: true,
              }).catch(() => {});
            }
          });

          return;
        }
      } catch (error) {
        const payload = {
          content: `Something went wrong: ${error.message}`,
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
    });
  },
};