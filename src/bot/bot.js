const { EventEmitter } = require('node:events');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Collection,
  GatewayIntentBits,
} = require('discord.js');

const logger = require('./util/logger');
const GitMonitor = require('./services/gitMonitor');
const { loadTextCommands, loadSlashCommands } = require('./loaders/commandLoader');
const { createEmbed } = require('./util/replies');

class Bot extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.textCommands = new Collection();
    this.slashCommands = new Collection();

    this.gitMonitor = new GitMonitor({
      repoPath: process.cwd(),
      intervalMinutes: this.config.gitPollIntervalMinutes,
      logger,
    });

    this.pendingUpdateMessageId = null;

    this.registerGitEvents();
    this.registerClientEvents();
  }

  loadCommands() {
    const textPath = path.join(__dirname, 'commands', 'text');
    const slashPath = path.join(__dirname, 'commands', 'slash');

    const textCommands = loadTextCommands(textPath);
    const slashCommands = loadSlashCommands(slashPath);

    this.textCommands.clear();
    for (const [name, command] of textCommands.entries()) {
      this.textCommands.set(name, command);
    }

    this.slashCommands.clear();
    for (const command of slashCommands) {
      this.slashCommands.set(command.data.name, command);
    }

    logger.info(`Loaded ${this.textCommands.size} text commands and ${this.slashCommands.size} slash commands.`);
  }

  registerClientEvents() {
    const readyHandler = require('./events/ready');
    const messageHandler = require('./events/messageCreate');
    const interactionHandler = require('./events/interactionCreate');

    readyHandler({ client: this.client, logger, slashCommands: Array.from(this.slashCommands.values()) });
    messageHandler({
      client: this.client,
      logger,
      textCommands: this.textCommands,
      prefix: this.config.commandPrefix,
    });
    interactionHandler({
      client: this.client,
      logger,
      slashCommands: this.slashCommands,
      gitMonitor: this.gitMonitor,
      requestRestart: () => this.emit('restartRequested'),
      updateChannelId: this.config.updateChannelId,
    });
  }

  registerGitEvents() {
    this.gitMonitor.on('updateAvailable', async (status) => {
      if (!this.client.isReady()) {
        return;
      }

      if (!this.config.updateChannelId) {
        logger.warn('Git updates detected, but UPDATE_CHANNEL_ID is not set.');
        return;
      }

      try {
        const channel = await this.client.channels.fetch(this.config.updateChannelId);
        if (!channel || !channel.isTextBased()) {
          logger.warn('Configured update channel is not accessible or not text-based.');
          return;
        }

        if (this.pendingUpdateMessageId) {
          const existingMessage = await channel.messages.fetch(this.pendingUpdateMessageId).catch(() => null);
          if (existingMessage) {
            return;
          }
          this.pendingUpdateMessageId = null;
        }

        const button = new ButtonBuilder()
          .setCustomId(GitMonitor.UPDATE_BUTTON_ID)
          .setLabel('Pull & Restart')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const notificationEmbed = createEmbed({
          title: '🚨 Repository update detected!',
          description: [
            `The bot is **${status.behind}** commit(s) behind the upstream branch.`,
            'Click the button below to pull the latest changes, push them upstream, and restart the bot.',
          ].join('\n'),
        });

        const message = await channel.send({ embeds: [notificationEmbed], components: [row] });
        this.pendingUpdateMessageId = message.id;
        logger.info(`Update notification sent to channel ${channel.id}.`);
      } catch (error) {
        logger.error('Failed to send update notification message:', error);
      }
    });
  }

  async start() {
    this.loadCommands();

    this.client.once('ready', () => {
      if (this.config.updateChannelId) {
        this.gitMonitor.start();
      } else {
        logger.warn('UPDATE_CHANNEL_ID is not set; git update notifications are disabled.');
      }
    });

    await this.client.login(this.config.token);
  }

  async stop() {
    this.gitMonitor.stop();
    this.client.removeAllListeners();
    await this.client.destroy();
  }
}

module.exports = Bot;
