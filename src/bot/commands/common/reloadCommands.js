const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const GUILD_RELOAD_BUTTON_ID = 'commands:reload:guild';
const GLOBAL_RELOAD_BUTTON_ID = 'commands:reload:global';

function buildReloadActionRow({ disableGuild = false, disableGlobal = true } = {}) {
  const guildButton = new ButtonBuilder()
    .setCustomId(GUILD_RELOAD_BUTTON_ID)
    .setLabel('Reload Guild Commands')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disableGuild);

  const globalButton = new ButtonBuilder()
    .setCustomId(GLOBAL_RELOAD_BUTTON_ID)
    .setLabel('Reload Global Commands')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disableGlobal);

  return new ActionRowBuilder().addComponents(guildButton, globalButton);
}

module.exports = {
  GUILD_RELOAD_BUTTON_ID,
  GLOBAL_RELOAD_BUTTON_ID,
  buildReloadActionRow,
};
