const fs = require('node:fs');
const path = require('node:path');

function discoverCommandFiles(directory) {
  const discovered = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      discovered.push(...discoverCommandFiles(entryPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    discovered.push(entryPath);
  }

  return discovered;
}

function loadCommands(directory) {
  const commands = new Map();

  if (!fs.existsSync(directory)) {
    return commands;
  }

  const files = discoverCommandFiles(directory);

  for (const filepath of files) {
    delete require.cache[require.resolve(filepath)];
    const command = require(filepath);

    if (!command || !command.name || typeof command.execute !== 'function') {
      continue;
    }

    commands.set(command.name, command);
  }

  return commands;
}

function loadSlashCommands(directory) {
  const commands = [];

  if (!fs.existsSync(directory)) {
    return commands;
  }

  const files = discoverCommandFiles(directory);

  for (const filepath of files) {
    delete require.cache[require.resolve(filepath)];
    const command = require(filepath);

    if (!command || !command.data || typeof command.execute !== 'function') {
      continue;
    }

    commands.push(command);
  }

  return commands;
}

module.exports = {
  loadTextCommands: loadCommands,
  loadSlashCommands,
};
