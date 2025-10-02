const { EventEmitter } = require('node:events');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');

const logger = require('./util/logger');
const GitMonitor = require('./services/gitMonitor');
const MongoService = require('./services/mongoService');
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

    this.client.commandPrefix = this.config.commandPrefix;
    this.client.textCommands = this.textCommands;
    this.client.slashCommands = this.slashCommands;

    this.gitMonitor = new GitMonitor({
      repoPath: process.cwd(),
      intervalMinutes: this.config.gitPollIntervalMinutes,
      logger,
    });

    this.mongoService = new MongoService({ uri: this.config.mongoUri, logger });

    this.pendingUpdateMessageId = null;

    this.registerGitEvents();
    this.registerClientEvents();

    this.client.mongoService = this.mongoService;
    this.client.reloadSlashCommands = this.reloadSlashCommands.bind(this);
  }

  refreshCommandCollections() {
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

    return { slashCommands };
  }

  loadCommands() {
    return this.refreshCommandCollections();
  }

  async reloadSlashCommands({ guildOnly = true } = {}) {
    const { slashCommands } = this.refreshCommandCollections();

    if (!this.config.token || !this.config.clientId) {
      throw new Error('BOT_TOKEN and CLIENT_ID must be configured to reload slash commands.');
    }

    const rest = new REST({ version: '10' }).setToken(this.config.token);
    const payload = slashCommands.map((command) => command.data.toJSON());

    if (guildOnly) {
      if (!this.config.guildId) {
        throw new Error('GUILD_ID must be configured to reload guild commands.');
      }

      await rest.put(Routes.applicationGuildCommands(this.config.clientId, this.config.guildId), { body: payload });
    } else {
      await rest.put(Routes.applicationCommands(this.config.clientId), { body: payload });
    }

    return { count: payload.length, scope: guildOnly ? 'guild' : 'global' };
  }

  registerClientEvents() {
    const readyHandler = require('./events/ready');
    const messageHandler = require('./events/messageCreate');
    const interactionHandler = require('./events/interactionCreate');

    readyHandler({
      client: this.client,
      logger,
      slashCommands: Array.from(this.slashCommands.values()),
      mongoService: this.mongoService,
    });
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
      clearUpdatePrompt: () => {
        this.pendingUpdateMessageId = null;
      },
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

        const confirmButton = new ButtonBuilder()
          .setCustomId(GitMonitor.UPDATE_CONFIRM_BUTTON_ID)
          .setLabel('Apply Update & Restart')
          .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
          .setCustomId(GitMonitor.UPDATE_DECLINE_BUTTON_ID)
          .setLabel('Dismiss')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, declineButton);

        const behindCount = status.behind ?? 0;
        const commitLabel = behindCount === 1 ? 'commit' : 'commits';

        const commitSummaries = await this.gitMonitor.getPendingCommitSummaries(status);

        const pendingChangesField = commitSummaries.length
          ? {
              name: 'Pending Changes',
              value: commitSummaries.join('\n'),
            }
          : {
              name: 'Pending Changes',
              value: 'Unable to load commit summaries.',
            };

        const notificationEmbed = createEmbed({
          title: 'Repository Update Available',
          color: 0x1f6feb,
          description: [
            'An update for the bot repository has been detected.',
            'Review the summary below and choose how you would like to proceed.',
          ].join('\n\n'),
          fields: [
            {
              name: 'Behind',
              value: `**${behindCount}** ${commitLabel}`,
              inline: true,
            },
            {
              name: 'Current Branch',
              value: status.current || 'Unknown',
              inline: true,
            },
            {
              name: 'Upstream Tracking',
              value: status.tracking || 'Not configured',
              inline: true,
            },
            pendingChangesField,
          ],
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

    try {
      await this.mongoService.connect();
    } catch (error) {
      logger.error('Failed to connect to MongoDB during startup:', error);
    }

    this.client.once('clientReady', () => {
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
    await this.mongoService.disconnect().catch((error) => {
      logger.warn('Failed to close MongoDB connection cleanly:', error);
    });
    await this.client.destroy();
  }
}

module.exports = Bot;