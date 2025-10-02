const { MongoClient } = require('mongodb');

class MongoService {
  constructor({ uri, logger }) {
    this.uri = uri;
    this.logger = logger;
    this.client = null;
    this.lastError = null;
    this.warnedAboutConfig = false;
  }

  isConfigured() {
    return Boolean(this.uri);
  }

  async connect() {
    if (!this.isConfigured()) {
      if (!this.warnedAboutConfig) {
        this.logger?.warn?.('MONGODB_URI is not set; MongoDB features are disabled.');
        this.warnedAboutConfig = true;
      }
      return null;
    }

    if (this.client) {
      return this.client;
    }

    const client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await client.connect();
      this.client = client;
      this.lastError = null;
      this.logger?.info?.('Connected to MongoDB.');
      return this.client;
    } catch (error) {
      this.lastError = error;
      this.logger?.error?.('Failed to connect to MongoDB:', error);
      await client.close().catch(() => {});
      throw error;
    }
  }

  async ensureConnection() {
    if (this.client) {
      return this.client;
    }

    try {
      return await this.connect();
    } catch (error) {
      return null;
    }
  }

  getClient() {
    return this.client;
  }

  getLastError() {
    return this.lastError;
  }

  async ping() {
    const client = await this.ensureConnection();
    if (!client) {
      throw new Error('MongoDB client is not configured or connected.');
    }

    const start = Date.now();
    await client.db().command({ ping: 1 });
    return Date.now() - start;
  }

  async getDatabaseStats() {
    const client = await this.ensureConnection();
    if (!client) {
      throw new Error('MongoDB client is not configured or connected.');
    }

    return client.db().stats();
  }

  async disconnect() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.close();
      this.logger?.info?.('Disconnected from MongoDB.');
    } finally {
      this.client = null;
    }
  }
}

module.exports = MongoService;
