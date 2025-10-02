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

const SESSION_TIMEOUT_MS = 60 * 1000;
const ACTIVITY_TEXT_TIMEOUT_MS = 60 * 1000;

const EMBED_COLORS = {
  primary: 0x5865f2,
  warning: 0xfee75c,
  success: 0x57f287,
  danger: 0xed4245,
  neutral: 0x2b2d31,
};

function formatRelativeTimestamp(timestampMs) {
  const seconds = Math.floor(timestampMs / 1000);
  return `<t:${seconds}:R>`;
}

function buildPresenceEmbed(presence, { expiresAt, expired = false, notice } = {}) {
  const descriptionParts = [buildPresenceDescription(presence)];

  if (notice) {
    descriptionParts.push(notice);
  }

  if (expiresAt) {
    const relative = formatRelativeTimestamp(expiresAt);
    descriptionParts.push(
      expired ? `This session expired ${relative}.` : `This session will expire ${relative}.`,
    );
  }

  return createEmbed({
    title: 'Manage Bot Presence',
    description: descriptionParts.join('\n\n'),
    color: expired ? EMBED_COLORS.danger : EMBED_COLORS.primary,
  });
}

function buildEmbed(options = {}) {
  const { timestamp = false, ...rest } = options;
  return createEmbed({ timestamp, ...rest });
}

async function sendEphemeralEmbed(interaction, embedOptions, { followUp = false } = {}) {
  const payload = {
    embeds: [buildEmbed(embedOptions)],
    ephemeral: true,
  };

  if (followUp || interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => {});
  }

  return interaction.reply(payload).catch(() => {});
}

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

module.exports = {
  name: 'setstatus',
  description: 'Interactively update the bot\'s presence.',
  async execute({ message }) {
    if (!isOwner(message.author.id)) {
      await replyWithEmbed(message, {
        title: 'Owner only',
        description: 'Only bot owners can use this command.',
        color: EMBED_COLORS.danger,
      });
      return;
    }

    const mongoService = message.client.mongoService;
    let currentPresence = normalizePresence(getPresenceFromClient(message.client));
    const sessionExpiresAt = Date.now() + SESSION_TIMEOUT_MS;

    const responseMessage = await replyWithEmbed(
      message,
      buildPresenceEmbed(currentPresence, { expiresAt: sessionExpiresAt }),
      { components: [buildControlButtons()] },
    );

    let activeMenu = null;
    let textCollector = null;
    let activePrompt = null;
    let statusNotice = null;
    const buildMainMessagePayload = ({ expired = false } = {}) => {
      const components = [buildControlButtons()];

      if (activeMenu === CUSTOM_IDS.STATUS_SELECT) {
        components.push(buildStatusSelect(currentPresence.status));
      } else if (activeMenu === CUSTOM_IDS.ACTIVITY_SELECT) {
        components.push(buildActivityTypeSelect(currentPresence.activityType));
      }

      return {
        embeds: [
          buildPresenceEmbed(currentPresence, {
            expiresAt: sessionExpiresAt,
            expired,
            notice: statusNotice,
          }),
        ],
        components,
      };
    };

    const collector = responseMessage.createMessageComponentCollector({
      time: SESSION_TIMEOUT_MS,
      filter: (interaction) => interaction.user.id === message.author.id && isOwner(interaction.user.id),
    });

    collector.on('end', async () => {
      if (textCollector) {
        textCollector.stop('session-ended');
        textCollector = null;
      }
      activePrompt = null;

      if (!responseMessage.editable) {
        return;
      }

      const baseRow = buildControlButtons();
      const disabledButtons = new ActionRowBuilder().addComponents(
        ...baseRow.components.map((component) => ButtonBuilder.from(component).setDisabled(true)),
      );

      await responseMessage
        .edit({
          embeds: [
            buildPresenceEmbed(currentPresence, {
              expiresAt: sessionExpiresAt,
              expired: true,
              notice: statusNotice,
            }),
          ],
          components: [disabledButtons],
        })
        .catch(() => {});
    });

    const refreshMessage = async ({ notice } = {}) => {
      if (notice !== undefined) {
        statusNotice = notice;
      }

      if (!responseMessage.editable) {
        return;
      }

      await responseMessage.edit(buildMainMessagePayload()).catch(() => {});
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
          await interaction.update(buildMainMessagePayload());
          return;
        }

        if (interaction.customId === CUSTOM_IDS.ACTIVITY_BUTTON) {
          activeMenu = activeMenu === CUSTOM_IDS.ACTIVITY_SELECT ? null : CUSTOM_IDS.ACTIVITY_SELECT;
          await interaction.update(buildMainMessagePayload());
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
            await sendEphemeralEmbed(interaction, {
              title: 'Presence Update Failed',
              description: result.error,
              color: EMBED_COLORS.danger,
            });
            return;
          }

          activeMenu = null;
          await interaction.update(buildMainMessagePayload());
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
            await sendEphemeralEmbed(interaction, {
              title: 'Presence Update Failed',
              description: result.error,
              color: EMBED_COLORS.danger,
            });
            return;
          }

          activeMenu = null;
          await interaction.update(buildMainMessagePayload());
          return;
        }

        if (interaction.customId === CUSTOM_IDS.TEXT_BUTTON) {
          activeMenu = null;

          if (textCollector) {
            textCollector.stop('replaced');
            textCollector = null;
          }

          await interaction.deferUpdate();
          const promptExpiresAt = Date.now() + ACTIVITY_TEXT_TIMEOUT_MS;
          const promptContext = { expiresAt: promptExpiresAt };
          activePrompt = promptContext;
          statusNotice = null;

          const promptDescription = [
            'Send the new activity text within the next 60 seconds.',
            `This prompt will expire ${formatRelativeTimestamp(promptExpiresAt)}.`,
            'Reply with **clear** to remove the activity or **cancel** to abort.',
            '',
            '**Current Presence**',
            buildPresenceDescription(currentPresence),
            '',
            `The management session will expire ${formatRelativeTimestamp(sessionExpiresAt)}.`,
          ].join('\n');

          await responseMessage
            .edit({
              embeds: [
                buildEmbed({
                  title: 'Update Activity Text',
                  description: promptDescription,
                  color: EMBED_COLORS.warning,
                }),
              ],
              components: [buildControlButtons()],
            })
            .catch(() => {});

          const filter = (msg) => msg.author.id === message.author.id;
          textCollector = message.channel.createMessageCollector({
            filter,
            time: ACTIVITY_TEXT_TIMEOUT_MS,
            max: 1,
          });

          textCollector.on('collect', async (msg) => {
            const submitted = msg.content.trim();

            if (!submitted || submitted.toLowerCase() === 'cancel') {
              await refreshMessage({ notice: 'Activity update cancelled. No changes were applied.' });
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
              await refreshMessage({ notice: `**Error:** ${result.error}` });
              return;
            }

            const confirmation = result.updated
              ? 'The activity has been updated successfully.'
              : 'The activity remains unchanged.';
            await refreshMessage({ notice: confirmation });
          });

          textCollector.on('end', async (collected, reason) => {
            if (activePrompt === promptContext) {
              activePrompt = null;
            }

            if (reason === 'replaced' || reason === 'session-ended') {
              return;
            }

            textCollector = null;

            if (collected.size === 0) {
              await refreshMessage({
                notice: `No activity text was received before the prompt expired ${formatRelativeTimestamp(
                  promptContext.expiresAt,
                )}. The previous activity has been kept.`,
              });
            }
          });

          return;
        }
      } catch (error) {
        await sendEphemeralEmbed(
          interaction,
          {
            title: 'Unexpected Error',
            description: `Something went wrong: ${error.message}`,
            color: EMBED_COLORS.danger,
          },
        );
      }
    });
  },
};