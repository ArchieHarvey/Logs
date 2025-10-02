const { EventEmitter } = require('node:events');
const path = require('node:path');
const simpleGit = require('simple-git');

const UPDATE_CONFIRM_BUTTON_ID = 'git-update-confirm';
const UPDATE_DECLINE_BUTTON_ID = 'git-update-decline';

class GitMonitor extends EventEmitter {
  constructor({ repoPath = process.cwd(), intervalMinutes = 5, logger }) {
    super();
    this.repoPath = path.resolve(repoPath);
    this.intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
    this.logger = logger;
    this.git = simpleGit({ baseDir: this.repoPath });
    this.timer = null;
    this.notified = false;
  }

  async checkForRemoteChanges() {
    try {
      await this.git.fetch();
      const status = await this.git.status();

      if ((status.behind || 0) > 0 && !this.notified) {
        this.notified = true;
        this.logger.info('Remote updates detected.');
        this.emit('updateAvailable', status);
      } else if ((status.behind || 0) === 0) {
        this.notified = false;
      }
    } catch (error) {
      this.logger.error('Failed to check for remote git updates:', error);
    }
  }

  start() {
    if (this.timer) {
      return;
    }

    this.logger.info(`Starting Git monitor for ${this.repoPath} (every ${this.intervalMs / 60000} minutes).`);
    this.timer = setInterval(() => {
      void this.checkForRemoteChanges();
    }, this.intervalMs);

    void this.checkForRemoteChanges();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async applyRemoteUpdates() {
    try {
      await this.git.fetch();
      const pullResult = await this.git.pull();
      const pushResult = await this.git.push();
      this.notified = false;
      return { pullResult, pushResult };
    } catch (error) {
      this.logger.error('Failed to apply remote git updates:', error);
      throw error;
    }
  }

  async getPendingCommitSummaries(status) {
    const trackingRef = status?.tracking;
    const currentRef = status?.current;

    if (!trackingRef || !status || (status.behind ?? 0) === 0) {
      return [];
    }

    try {
      const log = await this.git.log({ from: currentRef || 'HEAD', to: trackingRef });
      return log.all.map((entry) => `• ${entry.hash.slice(0, 7)} — ${entry.message}`).slice(0, 5);
    } catch (error) {
      this.logger.warn('Failed to load pending commit summaries:', error);
      return [];
    }
  }
}

GitMonitor.UPDATE_CONFIRM_BUTTON_ID = UPDATE_CONFIRM_BUTTON_ID;
GitMonitor.UPDATE_DECLINE_BUTTON_ID = UPDATE_DECLINE_BUTTON_ID;

module.exports = GitMonitor;
