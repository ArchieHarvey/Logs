const Bot = require('./bot/bot');
const config = require('./config');
const logger = require('./bot/util/logger');

const RESTART_CODE = 5;

(async () => {
  if (!config.token) {
    logger.error('BOT_TOKEN is not set. Please configure your environment variables.');
    process.exit(1);
    return;
  }

  const bot = new Bot(config);

  const shutdown = async (exitCode = 0) => {
    try {
      await bot.stop();
    } catch (error) {
      logger.error('Error while stopping the bot:', error);
    } finally {
      process.exit(exitCode);
    }
  };

  bot.on('restartRequested', async () => {
    logger.info('Restart requested. Exiting worker so launcher can restart.');
    await shutdown(RESTART_CODE);
  });

  bot.on('shutdownRequested', async () => {
    logger.info('Shutdown requested. Stopping bot without restart.');
    await shutdown(0);
  });

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  try {
    await bot.start();
  } catch (error) {
    logger.error('Failed to start the bot:', error);
    await shutdown(1);
  }
})();
